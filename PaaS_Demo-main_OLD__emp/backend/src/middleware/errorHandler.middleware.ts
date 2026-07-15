import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { appConfig } from '../config/app.config.js';
import type { ApiErrorResponse } from '../types/common.types.js';

/**
 * Global Express error handler.
 * Catches all thrown errors (including ApiError) and returns a consistent response.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    const body: ApiErrorResponse = { success: false, error: err.message };
    if (err.details) body.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error
  logger.error('Unhandled error', {
    method: req.method,
    path: req.path,
    error: appConfig.isDev ? err.stack : err.message,
  });

  const body: ApiErrorResponse = {
    success: false,
    error: appConfig.isDev ? err.message : 'Internal server error',
  };
  res.status(500).json(body);
}
