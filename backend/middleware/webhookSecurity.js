const crypto = require('crypto');

const replayCaches = new Map();

function matchesSecret(received, expected) {
  if (!received || !expected) return false;
  const receivedDigest = crypto.createHash('sha256').update(String(received)).digest();
  const expectedDigest = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(receivedDigest, expectedDigest);
}

function configuredSecret(req, environmentName, configKey) {
  const config = req.app.get('config');
  if (config.isProduction) return config.webhooks[configKey];
  return String(process.env[environmentName] || config.webhooks[configKey] || '').trim();
}

function verifyWebhook({ environmentName, configKey, headerName, allowBodySecretInDevelopment = false }) {
  return (req, res, next) => {
    const config = req.app.get('config');
    const expected = configuredSecret(req, environmentName, configKey);
    if (!expected) {
      if (!config.isProduction) return next();
      return res.status(503).json({ error: 'Webhook is not configured', code: 'WEBHOOK_NOT_CONFIGURED', requestId: req.id });
    }
    const received = req.get(headerName) || (!config.isProduction && allowBodySecretInDevelopment ? req.body?.secret : '');
    if (!matchesSecret(received, expected)) {
      return res.status(401).json({ error: 'Webhook authentication failed', code: 'WEBHOOK_UNAUTHORIZED', requestId: req.id });
    }
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'secret')) delete req.body.secret;
    return next();
  };
}

function timestampIsFresh(value, windowMs) {
  if (!value) return false;
  let timestamp = Number(value);
  if (Number.isFinite(timestamp)) {
    if (timestamp < 10_000_000_000) timestamp *= 1000;
  } else {
    timestamp = Date.parse(value);
  }
  return Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= windowMs;
}

function protectAgainstReplay(provider) {
  if (!replayCaches.has(provider)) replayCaches.set(provider, new Map());
  const cache = replayCaches.get(provider);
  return (req, res, next) => {
    const config = req.app.get('config');
    const eventId = String(req.get('x-webhook-id') || '').trim();
    const timestamp = req.get('x-webhook-timestamp');
    if (config.isProduction && (!eventId || !timestampIsFresh(timestamp, config.webhooks.replayWindowMs))) {
      return res.status(400).json({ error: 'Webhook replay metadata is missing or stale', code: 'WEBHOOK_REPLAY_METADATA_INVALID', requestId: req.id });
    }
    if (timestamp && !timestampIsFresh(timestamp, config.webhooks.replayWindowMs)) {
      return res.status(400).json({ error: 'Webhook timestamp is stale', code: 'WEBHOOK_TIMESTAMP_STALE', requestId: req.id });
    }
    if (!eventId) return next();

    const now = Date.now();
    for (const [key, expiresAt] of cache) if (expiresAt <= now) cache.delete(key);
    if (cache.has(eventId)) {
      return res.status(409).json({ error: 'Webhook event was already received', code: 'WEBHOOK_REPLAYED', requestId: req.id });
    }
    cache.set(eventId, now + config.webhooks.replayWindowMs);
    res.on('finish', () => {
      if (res.statusCode >= 500) cache.delete(eventId);
    });
    return next();
  };
}

const verifyUpiWebhook = verifyWebhook({
  environmentName: 'UPI_WEBHOOK_SECRET',
  configKey: 'upiSecret',
  headerName: 'x-upi-webhook-secret',
});

module.exports = { matchesSecret, protectAgainstReplay, timestampIsFresh, verifyUpiWebhook };
