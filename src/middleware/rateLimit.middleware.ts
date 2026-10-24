import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken, type AuthPayload } from '@/middleware/auth.middleware';
import type { Role } from '@/models/user.model';

export type RoleLimits = Record<Role | 'anonymous', number>;

/** Requests per minute. A busy till fires many reads; anonymous callers get the least. */
export const DEFAULT_ROLE_LIMITS: RoleLimits = {
  anonymous: 120,
  cashier: 600,
  manager: 900,
  admin: 1200,
};

/** Reads the bearer token without rejecting the request; route auth still runs later. */
function caller(req: Request): AuthPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.slice(7));
  } catch {
    return null;
  }
}

/**
 * Per-role rate limiting. Signed-in users are counted per account (so a shop
 * with many terminals behind one IP is not throttled as a single client) and
 * get a budget that matches their role. Everyone else is counted per IP.
 */
export function roleRateLimit(limits: RoleLimits = DEFAULT_ROLE_LIMITS, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit: (req) => limits[caller(req)?.role ?? 'anonymous'],
    keyGenerator: (req) => {
      const user = caller(req);
      return user ? `user:${user.sub}` : `ip:${req.ip ?? 'unknown'}`;
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please slow down' },
  });
}
