const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const heartbeat = require('../services/jobHeartbeatService');
const prisma = require('../src/lib/prisma');

let server;
let baseUrl;

test.before(async () => {
  heartbeat.record('test-job', 'ok', { processed: 2 });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('health endpoint verifies the database and returns job heartbeats without authentication', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'ok');
  assert.equal(body.jobs.some((job) => job.job === 'test-job' && job.processed === 2), true);
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  });
  await prisma.$disconnect();
  // Prisma's Windows query-engine async handle closes just after $disconnect resolves.
  // Let libuv observe that close before the suite's force-exit safeguard runs.
  await new Promise((resolve) => setTimeout(resolve, 100));
});
