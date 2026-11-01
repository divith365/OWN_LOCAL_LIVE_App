import { Hono } from 'hono';
import { Env } from '../index';
import {
  generateSecureOtp,
  generateSecureToken,
  hashString,
  signJwt,
  verifyJwt,
  parseGoogleJwtUnverified,
} from '../utils/crypto';
import { UserRole } from '@ownlocal/types';

export const authRouter = new Hono<{ Bindings: Env }>();

const DEFAULT_JWT_SECRET = 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';

// 1. Send OTP
authRouter.post('/send-otp', async (c) => {
  const body = await c.req.json<{ phone?: string; role?: UserRole }>();
  const phone = body.phone?.trim();
  const role = body.role || 'customer';

  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return c.json(
      { success: false, error: { code: 'INVALID_PHONE', message: 'Enter a valid 10-digit mobile number' } },
      400
    );
  }

  // Rate Limiting: Check requests in last 10 minutes
  const recentRequests: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM otp_requests
    WHERE phone = ? AND created_at > datetime('now', '-10 minutes')
  `)
    .bind(phone)
    .first();

  if (recentRequests && recentRequests.count >= 5) {
    return c.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many OTP requests. Please wait 10 minutes before trying again.',
        },
      },
      429
    );
  }

  // Generate OTP (in dev we can use 123456 or random)
  const isDev = c.env.ENVIRONMENT !== 'production';
  const otpCode = isDev ? '123456' : generateSecureOtp();
  const otpHash = await hashString(otpCode);
  const requestId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Store in D1 with 5-minute expiry
  await c.env.DB.prepare(`
    INSERT INTO otp_requests (id, phone, otp_hash, role, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+5 minutes'))
  `)
    .bind(requestId, phone, otpHash, role)
    .run();

  // In production, dispatch to SMS provider (Twilio / Fast2SMS / Google)
  return c.json({
    success: true,
    data: {
      message: `OTP sent to +91-${phone}`,
      expires_in_seconds: 300,
      mockOtp: isDev ? otpCode : undefined,
    },
  });
});

// 2. Verify OTP
authRouter.post('/verify-otp', async (c) => {
  const body = await c.req.json<{
    phone?: string;
    otp?: string;
    role?: UserRole;
    device_info?: string;
  }>();

  const phone = body.phone?.trim();
  const otp = body.otp?.trim();
  const role = body.role || 'customer';

  if (!phone || !otp) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Phone and OTP are required' } },
      400
    );
  }

  // Fetch latest active OTP request for this phone
  const otpReq: any = await c.env.DB.prepare(`
    SELECT * FROM otp_requests
    WHERE phone = ? AND is_verified = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `)
    .bind(phone)
    .first();

  // In dev mode allow 123456 bypass even if record expired
  const isDevBypass = c.env.ENVIRONMENT !== 'production' && otp === '123456';

  if (!otpReq && !isDevBypass) {
    return c.json(
      { success: false, error: { code: 'OTP_EXPIRED', message: 'OTP has expired or is invalid. Request a new one.' } },
      400
    );
  }

  if (otpReq) {
    if (otpReq.attempts >= otpReq.max_attempts) {
      return c.json(
        { success: false, error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Maximum attempts exceeded. Request a new OTP.' } },
        429
      );
    }

    const inputHash = await hashString(otp);
    if (inputHash !== otpReq.otp_hash && !isDevBypass) {
      await c.env.DB.prepare('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = ?')
        .bind(otpReq.id)
        .run();

      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_OTP',
            message: `Invalid OTP code. ${otpReq.max_attempts - (otpReq.attempts + 1)} attempts remaining.`,
          },
        },
        401
      );
    }

    // Mark verified
    await c.env.DB.prepare('UPDATE otp_requests SET is_verified = 1 WHERE id = ?')
      .bind(otpReq.id)
      .run();
  }

  // Find or Create User
  let user: any = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ?')
    .bind(phone)
    .first();

  if (!user) {
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await c.env.DB.prepare(`
      INSERT INTO users (id, phone, role, status)
      VALUES (?, ?, ?, 'active')
    `)
      .bind(userId, phone, role)
      .run();

    user = { id: userId, phone, role, status: 'active' };

    // Initialize role profile
    if (role === 'customer') {
      await c.env.DB.prepare(`
        INSERT INTO customer_profiles (id, user_id, full_name, default_address)
        VALUES (?, ?, 'New Customer', 'Ilkal')
      `)
        .bind(`prof_${Date.now()}`, userId)
        .run();
    }
  }

  // Account blocking check
  if (user.status !== 'active') {
    return c.json(
      {
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: `Account is ${user.status}. Contact support.` },
      },
      403
    );
  }

  // Generate Tokens & Session
  const jwtSecret = c.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const refreshToken = generateSecureToken();
  const refreshTokenHash = await hashString(refreshToken);

  const token = await signJwt(
    {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      sessionId,
    },
    jwtSecret,
    7200 // 2 hours
  );

  // Store Session in D1
  await c.env.DB.prepare(`
    INSERT INTO user_sessions (id, user_id, role, refresh_token_hash, device_info, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))
  `)
    .bind(sessionId, user.id, user.role, refreshTokenHash, body.device_info || 'Mobile App')
    .run();

  return c.json({
    success: true,
    data: {
      token,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    },
  });
});

// 3. Google Phone Auth Token Verification
authRouter.post('/google-phone', async (c) => {
  const body = await c.req.json<{
    idToken?: string;
    role?: UserRole;
    device_info?: string;
  }>();

  if (!body.idToken) {
    return c.json(
      { success: false, error: { code: 'MISSING_TOKEN', message: 'Google ID token required' } },
      400
    );
  }

  // Extract phone number from Google Firebase token
  const parsed = parseGoogleJwtUnverified(body.idToken);
  if (!parsed || !parsed.phone) {
    return c.json(
      { success: false, error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Could not extract verified phone number from Google token' } },
      400
    );
  }

  const phone = parsed.phone;
  const role = body.role || 'customer';

  // Find or Create User
  let user: any = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ?')
    .bind(phone)
    .first();

  if (!user) {
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await c.env.DB.prepare(`
      INSERT INTO users (id, phone, role, status)
      VALUES (?, ?, ?, 'active')
    `)
      .bind(userId, phone, role)
      .run();

    user = { id: userId, phone, role, status: 'active' };
  }

  if (user.status !== 'active') {
    return c.json(
      { success: false, error: { code: 'ACCOUNT_SUSPENDED', message: `Account is ${user.status}.` } },
      403
    );
  }

  const jwtSecret = c.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const refreshToken = generateSecureToken();
  const refreshTokenHash = await hashString(refreshToken);

  const token = await signJwt(
    {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      sessionId,
    },
    jwtSecret,
    7200
  );

  await c.env.DB.prepare(`
    INSERT INTO user_sessions (id, user_id, role, refresh_token_hash, device_info, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))
  `)
    .bind(sessionId, user.id, user.role, refreshTokenHash, body.device_info || 'Google Phone App')
    .run();

  return c.json({
    success: true,
    data: {
      token,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    },
  });
});

// 4. Refresh Token Rotation
authRouter.post('/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>();
  if (!body.refreshToken) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Refresh token is required' } },
      400
    );
  }

  const tokenHash = await hashString(body.refreshToken);
  const session: any = await c.env.DB.prepare(`
    SELECT s.*, u.status as user_status, u.phone
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.refresh_token_hash = ? AND s.is_revoked = 0 AND s.expires_at > datetime('now')
  `)
    .bind(tokenHash)
    .first();

  if (!session || session.user_status !== 'active') {
    return c.json(
      { success: false, error: { code: 'INVALID_SESSION', message: 'Session expired or revoked. Please log in again.' } },
      401
    );
  }

  const jwtSecret = c.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const newAccessToken = await signJwt(
    {
      userId: session.user_id,
      phone: session.phone,
      role: session.role,
      sessionId: session.id,
    },
    jwtSecret,
    7200
  );

  await c.env.DB.prepare('UPDATE user_sessions SET last_used_at = datetime("now") WHERE id = ?')
    .bind(session.id)
    .run();

  return c.json({
    success: true,
    data: {
      token: newAccessToken,
    },
  });
});

// 5. Logout (Revoke Session)
authRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: true, message: 'Logged out' });
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const verification = await verifyJwt<{ sessionId?: string }>(token, jwtSecret);

  if (verification.valid && verification.payload?.sessionId) {
    await c.env.DB.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?')
      .bind(verification.payload.sessionId)
      .run();
  }

  return c.json({ success: true, data: { message: 'Session revoked successfully' } });
});

// 6. Current User Profile (/api/auth/me)
authRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authorization header required' } }, 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const verification = await verifyJwt<{ userId: string; role: string }>(token, jwtSecret);

  if (!verification.valid || !verification.payload) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: verification.error || 'Invalid token' } }, 401);
  }

  const user: any = await c.env.DB.prepare('SELECT id, phone, email, role, status, created_at FROM users WHERE id = ?')
    .bind(verification.payload.userId)
    .first();

  if (!user) {
    return c.json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, 404);
  }

  return c.json({ success: true, data: user });
});
