import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** Wraps an async handler so rejections reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(res: Response, message: string, statusCode = 400): Response {
  return res.status(statusCode).json({ success: false, error: message });
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: Request['query'], maxLimit = 100): Pagination {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const rawLimit = Number.parseInt(String(query.limit ?? '20'), 10) || 20;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

export function paginatedResponse<T>(
  res: Response,
  items: T[],
  total: number,
  { page, limit }: Pagination,
): Response {
  return res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

/** Clamps an optional numeric query param into [min, max]. */
export function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Uppercase base32 token without ambiguous characters (no 0/O, 1/I/L). */
export function randomToken(length: number): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** SQL LIKE pattern with %, _ and \ escaped. Use with ESCAPE '\'. */
export const likePattern = (term: string): string => `%${term.replace(/[\\%_]/g, '\\$&')}%`;
