export type ErrorState = 
  | 'VALIDATION' 
  | 'AUTHENTICATION' 
  | 'FORBIDDEN' 
  | 'NOT_FOUND' 
  | 'CONFLICT' 
  | 'RATE_LIMITED' 
  | 'UPGRADE_REQUIRED' 
  | 'SERVICE_FAILURE' 
  | 'OFFLINE'
  | 'UNKNOWN';

export class ApiError extends Error {
  status: number;
  state: ErrorState;
  data: any;

  constructor(status: number, state: ErrorState, data: any, message: string) {
    super(message);
    this.status = status;
    this.state = state;
    this.data = data;
    this.name = 'ApiError';
  }
}

export function classifyError(status: number, data: any): ApiError {
  if (status === 0 || !status) {
    return new ApiError(0, 'OFFLINE', data, 'Network offline');
  }
  switch (status) {
    case 400: return new ApiError(400, 'VALIDATION', data, data?.error?.message || 'Validation Failed');
    case 401: return new ApiError(401, 'AUTHENTICATION', data, data?.error?.message || 'Authentication Failed');
    case 403: return new ApiError(403, 'FORBIDDEN', data, data?.error?.message || 'Access Denied');
    case 404: return new ApiError(404, 'NOT_FOUND', data, data?.error?.message || 'Not Found');
    case 409: return new ApiError(409, 'CONFLICT', data, data?.error?.message || 'Conflict');
    case 426: return new ApiError(426, 'UPGRADE_REQUIRED', data, data?.error?.message || 'Upgrade Required');
    case 429: return new ApiError(429, 'RATE_LIMITED', data, data?.error?.message || 'Rate Limited');
    case 500:
    case 502:
    case 503:
    case 504: return new ApiError(status, 'SERVICE_FAILURE', data, data?.error?.message || 'Service Failure');
    default: return new ApiError(status, 'UNKNOWN', data, data?.error?.message || 'Unknown Error');
  }
}
