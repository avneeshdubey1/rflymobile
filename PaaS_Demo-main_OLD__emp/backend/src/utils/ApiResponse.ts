import type { Response } from 'express';
import type { ApiSuccessResponse } from '../types/common.types.js';

/**
 * Standardized API response helper.
 * Enforces the { success, data, message } shape on all responses.
 */
export class ApiResponse {
  static success<T>(res: Response, data: T, message?: string, statusCode = 200): void {
    const body: ApiSuccessResponse<T> = { success: true, data };
    if (message) body.message = message;
    res.status(statusCode).json(body);
  }

  static created<T>(res: Response, data: T, message = 'Created successfully'): void {
    ApiResponse.success(res, data, message, 201);
  }

  static noContent(res: Response): void {
    res.status(204).end();
  }
}
