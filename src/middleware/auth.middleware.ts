import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/config';
import { AppError } from '@/middleware/error.middleware';
import type { Role } from '@/models/user.model';

export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (typeof decoded === 'string' || !decoded.sub || !decoded.role) {
    throw new AppError('Invalid token', 401);
  }
  return { sub: decoded.sub, email: decoded.email, role: decoded.role };
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

/** Restricts a route to the given roles. Must run after `authenticate`. */
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do that', 403));
    }
    next();
  };
