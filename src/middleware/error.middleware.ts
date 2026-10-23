import type { NextFunction, Request, Response } from 'express';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';

export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly isOperational = true,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(msg, 400, true, details);
export const notFound = (what: string) => new AppError(`${what} not found`, 404);
export const conflict = (msg: string) => new AppError(msg, 409);

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // express.json() parse failures arrive as SyntaxError with a 400 status.
  const bodyParseError = err instanceof SyntaxError && 'status' in err;
  const status = err instanceof AppError ? err.statusCode : bodyParseError ? 400 : 500;
  const message =
    err instanceof AppError || bodyParseError
      ? err.message
      : config.isProd
        ? 'Internal server error'
        : err.message;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, {
      error: err.message,
      stack: err.stack,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(err instanceof AppError && err.details ? { details: err.details } : {}),
    ...(config.isProd || status < 500 ? {} : { stack: err.stack }),
  });
}
