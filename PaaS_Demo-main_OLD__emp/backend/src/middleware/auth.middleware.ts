import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app.config.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthPayload } from '../types/common.types.js';

/**
 * JWT verification middleware.
 * Extracts token from Authorization header (Bearer <token>), verifies it,
 * and attaches the decoded payload to req.user.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed authorization header');
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, appConfig.jwt.secret) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}
