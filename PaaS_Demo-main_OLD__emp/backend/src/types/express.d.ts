import type { AuthPayload } from './common.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
