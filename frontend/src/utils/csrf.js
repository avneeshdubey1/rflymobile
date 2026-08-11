const CSRF_COOKIE_NAMES = ['__Host-daas_csrf', 'daas_csrf'];

function readCookie(name) {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : '';
}

export function csrfToken() {
  return CSRF_COOKIE_NAMES.map(readCookie).find(Boolean) || '';
}

export function csrfHeaders() {
  const token = csrfToken();
  return token ? { 'x-csrf-token': token } : {};
}
