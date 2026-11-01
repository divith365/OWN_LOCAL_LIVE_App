// Web Crypto API helpers for Cloudflare Workers (native, fast, no external dependencies)

export async function hashString(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateSecureOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // 6-digit number between 100000 and 999999
  const otp = 100000 + (array[0] % 900000);
  return otp.toString();
}

export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Base64URL encoding/decoding
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

// JWT Sign (HS256)
export async function signJwt(
  payload: Record<string, any>,
  secret: string,
  expiresInSeconds: number = 7200 // default 2 hours
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureString = String.fromCharCode(...signatureArray);
  const encodedSignature = base64UrlEncode(signatureString);

  return `${dataToSign}.${encodedSignature}`;
}

// JWT Verify (HS256)
export async function verifyJwt<T = any>(
  token: string,
  secret: string
): Promise<{ valid: boolean; payload?: T; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT structure' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(base64UrlDecode(encodedSignature), (c) =>
      c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(dataToVerify)
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid JWT signature' };
    }

    const payload: any = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'JWT token expired' };
    }

    return { valid: true, payload: payload as T };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to verify JWT' };
  }
}

// Google / Firebase Phone Auth ID Token parser & extractor
export function parseGoogleJwtUnverified(idToken: string): { phone?: string; sub?: string } | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return {
      phone: payload.phone_number ? payload.phone_number.replace(/^\+91/, '').replace(/\D/g, '') : undefined,
      sub: payload.sub,
    };
  } catch {
    return null;
  }
}
