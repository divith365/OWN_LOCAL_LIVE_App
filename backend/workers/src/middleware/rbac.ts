import { Context, Next } from 'hono';
import { verifyJwt } from '../utils/crypto';
import { UserRole } from '@ownlocal/types';
import { Env } from '../index';

const DEFAULT_JWT_SECRET = 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';

export interface AuthContext {
  userId: string;
  phone: string;
  role: UserRole;
  sessionId: string;
}

export async function requireAuth(c: Context<{ Bindings: Env; Variables: { user: AuthContext } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' } },
      401
    );
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const result = await verifyJwt<AuthContext>(token, jwtSecret);

  if (!result.valid || !result.payload) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: result.error || 'Invalid or expired token' } },
      401
    );
  }

  c.set('user', result.payload);
  await next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (c: Context<{ Bindings: Env; Variables: { user: AuthContext } }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
    }

    if (!allowedRoles.includes(user.role) && user.role !== 'admin') {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Role '${user.role}' is not authorized. Requires: ${allowedRoles.join(', ')}`,
          },
        },
        403
      );
    }

    await next();
  };
}
