import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/middleware/error.middleware';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
