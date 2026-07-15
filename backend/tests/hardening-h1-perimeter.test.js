const express = require('express');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app');
const { loadEnvironment } = require('../config/environment');
const { isSocketOriginAllowed } = require('../config/socketSecurity');
const { errorHandler, requestContext } = require('../middleware/httpSecurity');

async function start(application) {
  const server = application.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    }),
  };
}

function productionEnvironment(overrides = {}) {
  return {
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: 'https://operations.example.test',
    MAP_FRAME_ORIGINS: 'https://www.openstreetmap.org',
    TRUST_PROXY_HOPS: '1',
    RATE_LIMITS_ENABLED: 'true',
    ...overrides,
  };
}

test('production configuration fails closed for origins, proxy trust, wildcards, and disabled rate limits', () => {
  assert.throws(() => loadEnvironment({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '1' }), /CORS_ALLOWED_ORIGINS is required/);
  assert.throws(() => loadEnvironment({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: '*', TRUST_PROXY_HOPS: '1' }), /cannot contain a wildcard/);
  assert.throws(() => loadEnvironment({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https:\/\/operations.example.test' }), /TRUST_PROXY_HOPS must be at least 1/);
  assert.throws(() => loadEnvironment(productionEnvironment({ CORS_ALLOWED_ORIGINS: 'http://operations.example.test' })), /HTTPS origins/);
  assert.throws(() => loadEnvironment(productionEnvironment({ RATE_LIMITS_ENABLED: 'false' })), /cannot be disabled/);
});

test('security headers, correlation IDs, no-store policy, and JSON 404 are applied consistently', async () => {
  const runtime = await start(createApp({ config: loadEnvironment({ NODE_ENV: 'test' }) }));
  try {
    const response = await fetch(`${runtime.baseUrl}/api/does-not-exist`, {
      headers: { Origin: 'http://localhost:5173', 'X-Request-Id': 'perimeter-test-1' },
    });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.code, 'NOT_FOUND');
    assert.equal(body.requestId, 'perimeter-test-1');
    assert.equal(response.headers.get('x-request-id'), 'perimeter-test-1');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(response.headers.get('content-security-policy'), /frame-src https:\/\/www\.openstreetmap\.org/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  } finally { await runtime.close(); }
});

test('unapproved browser origins are denied without reflecting the origin', async () => {
  const runtime = await start(createApp({ config: loadEnvironment({ NODE_ENV: 'test' }) }));
  try {
    const response = await fetch(`${runtime.baseUrl}/api/health`, { headers: { Origin: 'https://attacker.example' } });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, 'CORS_ORIGIN_DENIED');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally { await runtime.close(); }
});

test('HTTPS is enforced in production while the trusted proxy signal is accepted', async () => {
  const config = loadEnvironment(productionEnvironment());
  const runtime = await start(createApp({ config }));
  try {
    const insecure = await fetch(`${runtime.baseUrl}/api/does-not-exist`, { headers: { Origin: 'https://operations.example.test' } });
    assert.equal(insecure.status, 426);
    assert.equal((await insecure.json()).code, 'HTTPS_REQUIRED');
    const proxiedHttps = await fetch(`${runtime.baseUrl}/api/does-not-exist`, {
      headers: { Origin: 'https://operations.example.test', 'X-Forwarded-Proto': 'https' },
    });
    assert.equal(proxiedHttps.status, 404);
    assert.match(proxiedHttps.headers.get('strict-transport-security'), /max-age=31536000/);
  } finally { await runtime.close(); }
});

test('non-JSON mutation bodies and oversized JSON are rejected before controllers', async () => {
  const config = loadEnvironment({ NODE_ENV: 'test', JSON_BODY_LIMIT_BYTES: '1024' });
  const runtime = await start(createApp({ config }));
  try {
    const wrongType = await fetch(`${runtime.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' });
    assert.equal(wrongType.status, 415);
    assert.equal((await wrongType.json()).code, 'UNSUPPORTED_MEDIA_TYPE');
    const oversized = await fetch(`${runtime.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(2000) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'PAYLOAD_TOO_LARGE');
  } finally { await runtime.close(); }
});

test('login and general API rate limits return structured 429 responses', async () => {
  const config = loadEnvironment({
    NODE_ENV: 'development',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_LOGIN_MAX: '2',
    RATE_LIMIT_GENERAL_MAX: '50',
  });
  const runtime = await start(createApp({ config }));
  try {
    const request = () => fetch(`${runtime.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal((await request()).status, 401);
    assert.equal((await request()).status, 401);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).code, 'RATE_LIMITED');
    assert.ok(limited.headers.get('ratelimit'));
  } finally { await runtime.close(); }
});

test('production Google Form webhook is disabled without a secret and accepts only the configured header', async () => {
  const missingRuntime = await start(createApp({ config: loadEnvironment(productionEnvironment()) }));
  try {
    const response = await fetch(`${missingRuntime.baseUrl}/api/forms/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://operations.example.test', 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({ formResponseId: 'missing-secret', secret: 'body-secrets-are-not-accepted' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'WEBHOOK_NOT_CONFIGURED');
  } finally { await missingRuntime.close(); }

  const configuredRuntime = await start(createApp({ config: loadEnvironment(productionEnvironment({ FORM_WEBHOOK_SECRET: 'a-secure-form-webhook-secret-value' })) }));
  try {
    const baseHeaders = { 'Content-Type': 'application/json', Origin: 'https://operations.example.test', 'X-Forwarded-Proto': 'https' };
    const bodyOnly = await fetch(`${configuredRuntime.baseUrl}/api/forms/webhook`, {
      method: 'POST', headers: baseHeaders, body: JSON.stringify({ formResponseId: 'body-only', secret: 'a-secure-form-webhook-secret-value' }),
    });
    assert.equal(bodyOnly.status, 401);
    const headerAuthenticated = await fetch(`${configuredRuntime.baseUrl}/api/forms/webhook`, {
      method: 'POST',
      headers: { ...baseHeaders, 'X-Form-Webhook-Secret': 'a-secure-form-webhook-secret-value' },
      body: JSON.stringify({}),
    });
    assert.equal(headerAuthenticated.status, 400);
    assert.match((await headerAuthenticated.json()).error, /formResponseId/);
  } finally { await configuredRuntime.close(); }
});

test('UPI webhook authentication, freshness, and event replay checks fail closed', async () => {
  const config = loadEnvironment(productionEnvironment({ UPI_WEBHOOK_SECRET: 'a-secure-upi-webhook-secret-value' }));
  const runtime = await start(createApp({ config }));
  const path = '/api/payments/nonexistent-payment/webhook';
  const baseHeaders = {
    'Content-Type': 'application/json',
    Origin: 'https://operations.example.test',
    'X-Forwarded-Proto': 'https',
    'X-UPI-Webhook-Secret': 'a-secure-upi-webhook-secret-value',
  };
  try {
    const absentMetadata = await fetch(`${runtime.baseUrl}${path}`, { method: 'POST', headers: baseHeaders, body: JSON.stringify({ status: 'COMPLETED' }) });
    assert.equal(absentMetadata.status, 400);
    assert.equal((await absentMetadata.json()).code, 'WEBHOOK_REPLAY_METADATA_INVALID');

    const eventHeaders = { ...baseHeaders, 'X-Webhook-Id': `h1-${Date.now()}`, 'X-Webhook-Timestamp': String(Date.now()) };
    const first = await fetch(`${runtime.baseUrl}${path}`, { method: 'POST', headers: eventHeaders, body: JSON.stringify({ status: 'COMPLETED' }) });
    assert.equal(first.status, 404);
    const replay = await fetch(`${runtime.baseUrl}${path}`, { method: 'POST', headers: eventHeaders, body: JSON.stringify({ status: 'COMPLETED' }) });
    assert.equal(replay.status, 409);
    assert.equal((await replay.json()).code, 'WEBHOOK_REPLAYED');
  } finally { await runtime.close(); }
});

test('unexpected errors are logged by type but returned without internal messages', async () => {
  const application = express();
  application.use(requestContext);
  application.get('/explode', () => { throw new Error('database-password-and-stack-must-not-leak'); });
  application.use(errorHandler);
  const runtime = await start(application);
  try {
    const response = await fetch(`${runtime.baseUrl}/explode`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.code, 'REQUEST_FAILED');
    assert.equal(JSON.stringify(body).includes('database-password'), false);
  } finally { await runtime.close(); }
});

test('Socket.IO origin policy denies missing and unapproved production origins', () => {
  const production = loadEnvironment(productionEnvironment());
  assert.equal(isSocketOriginAllowed('https://operations.example.test', production), true);
  assert.equal(isSocketOriginAllowed('https://attacker.example', production), false);
  assert.equal(isSocketOriginAllowed(undefined, production), false);
  assert.equal(isSocketOriginAllowed(undefined, loadEnvironment({ NODE_ENV: 'test' })), true);
});
