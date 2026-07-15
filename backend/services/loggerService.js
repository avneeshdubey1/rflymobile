const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'secret', 'token', 'authorization', 'farmerPhone', 'phone']);

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitize(item)]));
}

function log(level, event, context = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(context) });
  if (level === 'error') console.error(entry);
  else console.log(entry);
}

module.exports = { info: (event, context) => log('info', event, context), warn: (event, context) => log('warn', event, context), error: (event, context) => log('error', event, context) };
