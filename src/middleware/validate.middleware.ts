import type { NextFunction, Request, Response } from 'express';
import type Joi from 'joi';
import { AppError } from '@/middleware/error.middleware';

/**
 * Validates and normalizes `req.body` against a Joi schema. Unknown keys are
 * stripped and all errors are reported together.
 */
export const validateBody =
  (schema: Joi.ObjectSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { value, error } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      return next(new AppError('Validation failed', 400, true, details));
    }
    req.body = value;
    next();
  };
