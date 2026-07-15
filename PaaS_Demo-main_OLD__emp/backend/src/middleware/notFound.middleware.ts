import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '../types/common.types.js';

/**
 * 404 handler — catches any unmatched routes.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiErrorResponse = { success: false, error: 'Endpoint not found' };
  res.status(404).json(body);
}
