import type { UserRole } from './enums.js';

/** Standard API success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

/** Union of success and error response */
export type ApiEnvelope<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Authenticated user payload attached to req.user */
export interface AuthPayload {
  userId: string;
  role: UserRole;
  name: string;
  phone: string;
}

/** Pagination params */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Paginated response wrapper */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
