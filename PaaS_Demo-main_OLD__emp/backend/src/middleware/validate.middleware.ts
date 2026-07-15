import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Zod schema validation middleware factory.
 * Validates req.body (or req.query / req.params if specified) against a Zod schema.
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      throw ApiError.badRequest('Validation failed', errors);
    }
    // Replace with parsed (cleaned) data
    if (source === 'body') {
      req.body = result.data;
    }
    next();
  };
}
