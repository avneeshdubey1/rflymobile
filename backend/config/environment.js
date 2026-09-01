const LOCAL_DEVELOPMENT_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
]);

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function integer(value, fallback, name, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ConfigurationError(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function boolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  throw new ConfigurationError(`${name} must be true or false`);
}

function semanticVersion(value, fallback, name) {
  const resolved = String(value || fallback).trim();
  if (!/^\d+\.\d+\.\d+$/.test(resolved)) throw new ConfigurationError(`${name} must use major.minor.patch format`);
  return resolved;
}

function currencyCode(value, fallback, name) {
  const resolved = String(value || fallback || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(resolved)) throw new ConfigurationError(`${name} must be a three-letter ISO currency code`);
  return resolved;
}

function origins(value, nodeEnv, { name = 'CORS_ALLOWED_ORIGINS', developmentDefaults = LOCAL_DEVELOPMENT_ORIGINS, requiredInProduction = true } = {}) {
  const configured = String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const values = configured.length ? configured : (nodeEnv === 'production' ? [] : [...developmentDefaults]);
  if (values.some((origin) => origin === '*')) throw new ConfigurationError(`${name} cannot contain a wildcard`);
  for (const origin of values) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new ConfigurationError(`${name} contains an invalid origin: ${origin}`); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new ConfigurationError(`${name} must contain origins only, without paths: ${origin}`);
    }
    if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
      throw new ConfigurationError(`${name} must contain HTTPS origins in production`);
    }
  }
  if (nodeEnv === 'production' && requiredInProduction && !values.length) {
    throw new ConfigurationError(`${name} is required in production`);
  }
  return Object.freeze([...new Set(values)]);
}

function loadEnvironment(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new ConfigurationError('NODE_ENV must be development, test, or production');
  }

  const trustProxyHops = integer(env.TRUST_PROXY_HOPS, nodeEnv === 'production' ? null : 0, 'TRUST_PROXY_HOPS', { min: 0, max: 10 });
  if (nodeEnv === 'production' && (!Number.isInteger(trustProxyHops) || trustProxyHops < 1)) {
    throw new ConfigurationError('TRUST_PROXY_HOPS must be at least 1 in production so HTTPS can be verified behind the deployment proxy');
  }

  const enforceHttps = boolean(env.ENFORCE_HTTPS, nodeEnv === 'production', 'ENFORCE_HTTPS');
  if (nodeEnv === 'production' && !enforceHttps) {
    throw new ConfigurationError('ENFORCE_HTTPS cannot be disabled in production');
  }

  const allowedOrigins = origins(env.CORS_ALLOWED_ORIGINS, nodeEnv);
  const mapFrameOrigins = origins(env.MAP_FRAME_ORIGINS, nodeEnv, {
    name: 'MAP_FRAME_ORIGINS',
    developmentDefaults: ['https://www.openstreetmap.org'],
    requiredInProduction: false,
  });

  const rateLimitsEnabled = boolean(env.RATE_LIMITS_ENABLED, nodeEnv !== 'test', 'RATE_LIMITS_ENABLED');
  if (nodeEnv === 'production' && !rateLimitsEnabled) {
    throw new ConfigurationError('RATE_LIMITS_ENABLED cannot be disabled in production');
  }
  const upiWebhookSecret = String(env.UPI_WEBHOOK_SECRET || '').trim();
  const recoveryHashSecret = String(env.RECOVERY_HASH_SECRET || '').trim();
  const otpHashSecret = String(env.OTP_HASH_SECRET || '').trim();
  const otpDeliveryProvider = String(env.OTP_DELIVERY_PROVIDER || (nodeEnv === 'production' ? 'disabled' : 'cli')).trim().toLowerCase();
  if (nodeEnv === 'production' && upiWebhookSecret && upiWebhookSecret.length < 32) {
    throw new ConfigurationError('UPI_WEBHOOK_SECRET must contain at least 32 characters in production');
  }
  if (nodeEnv === 'production' && recoveryHashSecret.length < 32) {
    throw new ConfigurationError('RECOVERY_HASH_SECRET must contain at least 32 characters in production');
  }
  if (!['disabled', 'test', 'cli'].includes(otpDeliveryProvider)) {
    throw new ConfigurationError('OTP_DELIVERY_PROVIDER must be disabled, test, or cli');
  }
  if (nodeEnv === 'production' && ['test', 'cli'].includes(otpDeliveryProvider)) {
    throw new ConfigurationError('OTP_DELIVERY_PROVIDER cannot be test or cli in production');
  }
  if (nodeEnv === 'production' && otpDeliveryProvider !== 'disabled' && otpHashSecret.length < 32) {
    throw new ConfigurationError('OTP_HASH_SECRET must contain at least 32 characters in production when OTP delivery is enabled');
  }

  const sessionIdleTimeoutMs = integer(env.SESSION_IDLE_TIMEOUT_MS, 30 * 60_000, 'SESSION_IDLE_TIMEOUT_MS', { min: 60_000, max: 24 * 60 * 60_000 });
  const sessionAbsoluteTimeoutMs = integer(env.SESSION_ABSOLUTE_TIMEOUT_MS, 8 * 60 * 60_000, 'SESSION_ABSOLUTE_TIMEOUT_MS', { min: sessionIdleTimeoutMs, max: 30 * 24 * 60 * 60_000 });
  const mobileSessionIdleTimeoutMs = integer(env.MOBILE_SESSION_IDLE_TIMEOUT_MS, 30 * 60_000, 'MOBILE_SESSION_IDLE_TIMEOUT_MS', { min: 60_000, max: 24 * 60 * 60_000 });
  const mobileSessionAbsoluteTimeoutMs = integer(env.MOBILE_SESSION_ABSOLUTE_TIMEOUT_MS, 8 * 60 * 60_000, 'MOBILE_SESSION_ABSOLUTE_TIMEOUT_MS', { min: mobileSessionIdleTimeoutMs, max: 30 * 24 * 60 * 60_000 });

  const operatingTimeZone = String(env.OPERATING_TIME_ZONE || (nodeEnv === 'production' ? '' : 'UTC')).trim();
  if (!operatingTimeZone) throw new ConfigurationError('OPERATING_TIME_ZONE is required in production');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: operatingTimeZone }).format(new Date(0));
  } catch {
    throw new ConfigurationError('OPERATING_TIME_ZONE must be a valid IANA timezone');
  }
  const b2cCashCollectionEnabled = boolean(
    env.B2C_CASH_COLLECTION_ENABLED,
    nodeEnv !== 'production',
    'B2C_CASH_COLLECTION_ENABLED',
  );
  const configuredCashCurrency = String(env.B2C_CASH_CURRENCY_CODE || '').trim();
  const b2cCashCurrencyCode = b2cCashCollectionEnabled
    ? currencyCode(configuredCashCurrency, nodeEnv === 'production' ? '' : 'INR', 'B2C_CASH_CURRENCY_CODE')
    : (configuredCashCurrency ? currencyCode(configuredCashCurrency, '', 'B2C_CASH_CURRENCY_CODE') : null);

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: integer(env.PORT, 5000, 'PORT', { min: 1, max: 65535 }),
    operatingTimeZone,
    allowedOrigins,
    capacitorOriginsEnabled: boolean(env.CAPACITOR_ORIGINS_ENABLED, false, 'CAPACITOR_ORIGINS_ENABLED'),
    mapFrameOrigins,
    trustProxyHops,
    enforceHttps,
    jsonBodyLimitBytes: integer(env.JSON_BODY_LIMIT_BYTES, 128 * 1024, 'JSON_BODY_LIMIT_BYTES', { min: 1024, max: 10 * 1024 * 1024 }),
    rateLimits: Object.freeze({
      enabled: rateLimitsEnabled,
      windowMs: integer(env.RATE_LIMIT_WINDOW_MS, 15 * 60_000, 'RATE_LIMIT_WINDOW_MS', { min: 1000, max: 24 * 60 * 60_000 }),
      generalMax: integer(env.RATE_LIMIT_GENERAL_MAX, 300, 'RATE_LIMIT_GENERAL_MAX', { min: 1, max: 100_000 }),
      loginMax: integer(env.RATE_LIMIT_LOGIN_MAX, 10, 'RATE_LIMIT_LOGIN_MAX', { min: 1, max: 10_000 }),
      recoveryMax: integer(env.RATE_LIMIT_RECOVERY_MAX, 5, 'RATE_LIMIT_RECOVERY_MAX', { min: 1, max: 10_000 }),
      publicIntakeMax: integer(env.RATE_LIMIT_PUBLIC_INTAKE_MAX, 30, 'RATE_LIMIT_PUBLIC_INTAKE_MAX', { min: 1, max: 10_000 }),
      webhookMax: integer(env.RATE_LIMIT_WEBHOOK_MAX, 60, 'RATE_LIMIT_WEBHOOK_MAX', { min: 1, max: 100_000 }),
    }),
    session: Object.freeze({
      idleTimeoutMs: sessionIdleTimeoutMs,
      absoluteTimeoutMs: sessionAbsoluteTimeoutMs,
      touchIntervalMs: integer(env.SESSION_TOUCH_INTERVAL_MS, 60_000, 'SESSION_TOUCH_INTERVAL_MS', { min: 5_000, max: Math.floor(sessionIdleTimeoutMs / 2) }),
    }),
    mobile: Object.freeze({
      enabled: boolean(env.MOBILE_API_ENABLED, nodeEnv !== 'production', 'MOBILE_API_ENABLED'),
      idleTimeoutMs: mobileSessionIdleTimeoutMs,
      absoluteTimeoutMs: mobileSessionAbsoluteTimeoutMs,
      touchIntervalMs: integer(env.MOBILE_SESSION_TOUCH_INTERVAL_MS, 60_000, 'MOBILE_SESSION_TOUCH_INTERVAL_MS', { min: 5_000, max: Math.floor(mobileSessionIdleTimeoutMs / 2) }),
      maxInstallationsPerApp: integer(env.MOBILE_MAX_INSTALLATIONS_PER_APP, 2, 'MOBILE_MAX_INSTALLATIONS_PER_APP', { min: 1, max: 10 }),
      minimumVersion: semanticVersion(env.MOBILE_MINIMUM_VERSION, '1.0.0', 'MOBILE_MINIMUM_VERSION'),
      recommendedVersion: semanticVersion(env.MOBILE_RECOMMENDED_VERSION, '1.0.0', 'MOBILE_RECOMMENDED_VERSION'),
      foregroundLocationEnabled: boolean(env.MOBILE_FOREGROUND_LOCATION_ENABLED, true, 'MOBILE_FOREGROUND_LOCATION_ENABLED'),
      locationIntervalSeconds: integer(env.MOBILE_LOCATION_INTERVAL_SECONDS, 60, 'MOBILE_LOCATION_INTERVAL_SECONDS', { min: 15, max: 900 }),
      locationAccuracyMetres: integer(env.MOBILE_LOCATION_ACCURACY_METRES, 100, 'MOBILE_LOCATION_ACCURACY_METRES', { min: 10, max: 1000 }),
    }),
    b2cCashCollection: Object.freeze({
      enabled: b2cCashCollectionEnabled,
      currencyCode: b2cCashCurrencyCode,
    }),
    recovery: Object.freeze({
      hashSecret: recoveryHashSecret,
      codeTtlMs: integer(env.RECOVERY_CODE_TTL_MS, 10 * 60_000, 'RECOVERY_CODE_TTL_MS', { min: 60_000, max: 60 * 60_000 }),
      maxAttempts: integer(env.RECOVERY_MAX_ATTEMPTS, 5, 'RECOVERY_MAX_ATTEMPTS', { min: 1, max: 20 }),
    }),
    otp: Object.freeze({
      hashSecret: otpHashSecret,
      codeTtlMs: integer(env.OTP_CODE_TTL_MS, 5 * 60_000, 'OTP_CODE_TTL_MS', { min: 60_000, max: 30 * 60_000 }),
      maxAttempts: integer(env.OTP_MAX_ATTEMPTS, 5, 'OTP_MAX_ATTEMPTS', { min: 1, max: 10 }),
      resendCooldownMs: integer(env.OTP_RESEND_COOLDOWN_MS, 30_000, 'OTP_RESEND_COOLDOWN_MS', { min: 30_000, max: 10 * 60_000 }),
      deliveryProvider: otpDeliveryProvider,
    }),
    intake: Object.freeze({
      // Declined enquiries have a fixed, approved 30-day lifetime. The purge
      // may run more often, but never less often than daily.
      declinedEnquiryPurgeIntervalMs: integer(env.DECLINED_ENQUIRY_PURGE_INTERVAL_MS, 24 * 60 * 60_000, 'DECLINED_ENQUIRY_PURGE_INTERVAL_MS', { min: 60_000, max: 24 * 60 * 60_000 }),
    }),
    socket: Object.freeze({
      maxPayloadBytes: integer(env.SOCKET_MAX_PAYLOAD_BYTES, 64 * 1024, 'SOCKET_MAX_PAYLOAD_BYTES', { min: 1024, max: 1024 * 1024 }),
      eventWindowMs: integer(env.SOCKET_EVENT_WINDOW_MS, 60_000, 'SOCKET_EVENT_WINDOW_MS', { min: 1000, max: 60 * 60_000 }),
      eventMax: integer(env.SOCKET_EVENT_MAX, 120, 'SOCKET_EVENT_MAX', { min: 1, max: 10_000 }),
      connectionMax: integer(env.SOCKET_CONNECTION_MAX, 30, 'SOCKET_CONNECTION_MAX', { min: 1, max: 10_000 }),
    }),
    webhooks: Object.freeze({
      upiSecret: upiWebhookSecret,
      replayWindowMs: integer(env.WEBHOOK_REPLAY_WINDOW_MS, 5 * 60_000, 'WEBHOOK_REPLAY_WINDOW_MS', { min: 1000, max: 24 * 60 * 60_000 }),
    }),
  });
}

module.exports = { ConfigurationError, LOCAL_DEVELOPMENT_ORIGINS, loadEnvironment };
