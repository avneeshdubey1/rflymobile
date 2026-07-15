import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to forward errors to Express error handler.
 * Eliminates the need for try/catch in every controller method.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
