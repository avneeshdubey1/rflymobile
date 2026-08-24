const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('../services/loggerService');

function isAllowedOrigin(origin, config) {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  if (config.capacitorOriginsEnabled && origin === 'capacitor://localhost') return true;
  return false;
}

function requestContext(req, res, next) {
  const supplied = String(req.get('x-request-id') || '').trim();
  req.id = /^[A-Za-z0-9._:-]{1,80}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function securityHeaders(config) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        frameSrc: config.mapFrameOrigins.length ? config.mapFrameOrigins : ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: false } : false,
  });
}

function corsPolicy(config) {
  return cors({
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token', 'X-Request-Id', 'X-Form-Webhook-Secret', 'X-UPI-Webhook-Secret', 'X-Webhook-Id', 'X-Webhook-Timestamp'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
    origin(origin, callback) {
      if (isAllowedOrigin(origin, config)) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.status = 403;
      error.code = 'CORS_ORIGIN_DENIED';
      return callback(error);
    },
  });
}

function requireHttps(config) {
  return (req, res, next) => {
    if (!config.enforceHttps || req.secure) return next();
    return res.status(426).json({ error: 'HTTPS is required', code: 'HTTPS_REQUIRED', requestId: req.id });
  };
}

function requireJsonContentType(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const hasBody = Number(req.get('content-length') || 0) > 0 || Boolean(req.get('transfer-encoding'));
  if (!hasBody || req.is('application/json')) return next();
  return res.status(415).json({ error: 'Content-Type must be application/json', code: 'UNSUPPORTED_MEDIA_TYPE', requestId: req.id });
}

function createRateLimiters(_config) {
  const unrestricted = (_req, _res, next) => next();
  return {
    // Emergency demo policy: request throttling is intentionally disabled.
    general: unrestricted,
    login: unrestricted,
    recovery: unrestricted,
    publicIntake: unrestricted,
    webhook: unrestricted,
  };
}

function notFound(req, res) {
  return res.status(404).json({ error: 'API route not found', code: 'NOT_FOUND', requestId: req.id });
}

function errorHandler(error, req, res, _next) {
  const payload = { requestId: req.id, method: req.method, path: req.path, errorType: error?.name || 'Error' };
  if (error?.code === 'CORS_ORIGIN_DENIED') {
    logger.warn('http.origin_denied', payload);
    return res.status(403).json({ error: 'Request origin is not allowed', code: 'CORS_ORIGIN_DENIED', requestId: req.id });
  }
  if (error?.type === 'entity.too.large') {
    logger.warn('http.body_too_large', payload);
    return res.status(413).json({ error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE', requestId: req.id });
  }
  if (error instanceof SyntaxError && error.status === 400 && Object.prototype.hasOwnProperty.call(error, 'body')) {
    return res.status(400).json({ error: 'Request body contains invalid JSON', code: 'INVALID_JSON', requestId: req.id });
  }
  logger.error('http.unhandled_error', payload);
  if (res.headersSent) return res.end();
  return res.status(Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 500)
    .json({ error: 'The request could not be completed', code: 'REQUEST_FAILED', requestId: req.id });
}

module.exports = {
  corsPolicy,
  createRateLimiters,
  errorHandler,
  isAllowedOrigin,
  notFound,
  requestContext,
  requireHttps,
  requireJsonContentType,
  securityHeaders,
};
