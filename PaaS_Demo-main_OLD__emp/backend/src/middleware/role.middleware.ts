import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/enums.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Role-based access guard factory.
 * Usage: roleGuard('Admin', 'Ops') — allows only Admin and Ops roles.
 */
export function roleGuard(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(`Role '${req.user.role}' does not have access to this resource`);
    }
    next();
  };
}
