import { API_URL } from '../config';

export const AUTH_EXPIRED_EVENT = 'daas:auth-expired';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_COOKIE_NAMES = ['__Host-daas_csrf', 'daas_csrf'];

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}

export function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const entry = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return '';
  const value = entry.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getCsrfToken() {
  for (const name of CSRF_COOKIE_NAMES) {
    const value = readCookie(name);
    if (value) return value;
  }
  return '';
}

function notifyAuthenticationExpired(url) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { url } }));
}

export async function apiFetch(path, options = {}) {
  const {
    authFailure = 'notify',
    headers: suppliedHeaders,
    ...requestOptions
  } = options;
  const method = String(requestOptions.method || 'GET').toUpperCase();
  const headers = new Headers(suppliedHeaders || {});
  const url = apiUrl(path);
  const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const apiBase = new URL(API_URL || browserOrigin, browserOrigin);
  const requestUrl = new URL(url, browserOrigin);
  if (requestUrl.origin !== apiBase.origin || !requestUrl.pathname.startsWith('/api/')) {
    throw new Error('The API client cannot send credentials to a non-API URL.');
  }
  const csrfToken = getCsrfToken();

  if (!SAFE_METHODS.has(method) && csrfToken && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const response = await fetch(url, {
    ...requestOptions,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && authFailure !== 'ignore') notifyAuthenticationExpired(url);
  return response;
}

export async function readJson(response) {
  return response.json().catch(() => ({}));
}
