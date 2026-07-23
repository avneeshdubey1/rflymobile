import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { getCsrfToken } from './apiClient';

export function createAuthenticatedSocket(options = {}) {
  const endpoint = API_URL || window.location.origin;
  return io(endpoint, {
    ...options,
    withCredentials: true,
    auth: (done) => done({ csrfToken: getCsrfToken() }),
  });
}
