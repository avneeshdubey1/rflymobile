import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(frontendDir, '..');
const backendDir = path.join(rootDir, 'backend');
const evidenceDir = path.join(rootDir, 'docs', 'test-evidence', 'browser-audit-2026-07-14');
const frontendUrl = 'http://127.0.0.1:5180';
const backendUrl = 'http://127.0.0.1:5100';
const databaseName = 'rfly_daas_browser_test';
const postgresContainer = process.env.POSTGRES_CONTAINER || 'rfly-postgres';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
const viteCli = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');

fs.mkdirSync(evidenceDir, { recursive: true });

function parseEnvFile(file) {
  const values = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' && command.endsWith('.cmd'), ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message || (result.stderr || result.stdout || '').trim()}`);
  return (result.stdout || '').trim();
}

function testDatabaseUrl(source) {
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'no successful response'}`);
}

function startProcess(command, args, options) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: process.platform === 'win32' && command.endsWith('.cmd'), ...options });
  const output = [];
  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));
  child.auditOutput = output;
  return child;
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  else child.kill('SIGTERM');
}

const backendEnvFile = parseEnvFile(path.join(backendDir, '.env'));
if (!backendEnvFile.DATABASE_URL) throw new Error('backend/.env must contain DATABASE_URL');
if (!fs.existsSync(edgePath)) throw new Error(`Microsoft Edge was not found at ${edgePath}`);
const databaseUrl = testDatabaseUrl(backendEnvFile.DATABASE_URL);
const testPassword = crypto.randomBytes(24).toString('base64url');
const recoveryHashSecret = crypto.randomBytes(48).toString('base64url');
const unique = Date.now().toString();

run('docker', ['exec', postgresContainer, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`]);
run('docker', ['exec', postgresContainer, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]);

const databaseEnv = { ...process.env, DATABASE_URL: databaseUrl };
run(process.execPath, [prismaCli, 'generate'], { cwd: backendDir, env: databaseEnv });
run(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: backendDir, env: databaseEnv });
run(process.execPath, ['prisma/seed.js'], { cwd: backendDir, env: { ...databaseEnv, DEMO_USER_PASSWORD: testPassword } });

const fixtureScript = `
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./services/passwordService');
const prisma = new PrismaClient();
(async () => {
  const passwordHash = await hashPassword(process.env.E2E_PASSWORD);
  await prisma.user.updateMany({ data: { passwordHash } });
  const centers = await prisma.operatingCenter.findMany({ orderBy: { createdAt: 'asc' } });
  const future = new Date(); future.setFullYear(future.getFullYear() + 2);
  for (const [index, center] of centers.entries()) {
    for (let pilot = 0; pilot < 3; pilot += 1) await prisma.user.create({ data: { name: 'Browser Audit Pilot ' + (index + 1) + '-' + (pilot + 1), email: 'browser-pilot-' + index + '-' + pilot + '@example.invalid', passwordHash, role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: future } });
    for (let drone = 0; drone < 4; drone += 1) await prisma.drone.create({ data: { model: 'Browser Audit Drone', serialNumber: 'E2E-' + index + '-' + drone, status: 'AVAILABLE', homeCenterId: center.id, airworthinessExpiry: future } });
    for (let lmv = 0; lmv < 4; lmv += 1) await prisma.lMV.create({ data: { registrationNo: 'E2E-LMV-' + index + '-' + lmv, label: 'Browser Audit LMV ' + (index + 1) + '-' + (lmv + 1), status: 'AVAILABLE', homeCenterId: center.id, capacity: 1 } });
  }
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, homeCenterId: true }, orderBy: { createdAt: 'asc' } });
  console.log(JSON.stringify(users));
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
`;
const users = JSON.parse(run(process.execPath, ['-e', fixtureScript], { cwd: backendDir, env: { ...databaseEnv, E2E_PASSWORD: testPassword } }));
const firstRole = (role) => users.find((user) => user.role === role);
const roleUsers = {
  ADMIN: firstRole('ADMIN'),
  SALES: firstRole('SALES'),
  FLEET_MANAGER: firstRole('FLEET_MANAGER'),
  PILOT: firstRole('PILOT'),
};

const backendProcess = startProcess(process.execPath, ['server.js'], {
  cwd: backendDir,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    PORT: '5100',
    CORS_ALLOWED_ORIGINS: frontendUrl,
    RECOVERY_HASH_SECRET: recoveryHashSecret,
    WHATSAPP_API_KEY: '',
    WEATHER_API_KEY: '',
    UPI_GATEWAY_KEY: '',
    UPI_WEBHOOK_SECRET: '',
    NOTIFICATION_CASCADE_TIMERS_MS: '86400000,172800000,259200000,345600000',
  },
});
const frontendBuildEnv = { ...process.env, VITE_API_URL: backendUrl, VITE_GPS_PING_INTERVAL_MS: '500' };
run(process.execPath, [viteCli, 'build'], { cwd: frontendDir, env: frontendBuildEnv });
const frontendProcess = startProcess(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {
  cwd: frontendDir,
  env: frontendBuildEnv,
});

const results = [];
const state = {};
let browser;

async function apiLogin(user) {
  const response = await fetch(`${backendUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: user.email, password: testPassword }) });
  const data = await response.json();
  assert.equal(response.status, 200, `API login failed for role ${user.role}: ${JSON.stringify(data)}`);
  assert.equal(Object.hasOwn(data, 'token'), false, 'Login JSON exposed an authentication token');
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie().join(', ')
    : String(response.headers.get('set-cookie') || '');
  const sessionMatch = setCookie.match(/(?:^|,\s*)(daas_session=([^;,\s]+))/);
  const csrfMatch = setCookie.match(/(?:^|,\s*)(daas_csrf=([^;,\s]+))/);
  assert.ok(sessionMatch && csrfMatch, 'API login did not set both session and CSRF cookies');
  return {
    cookie: `${sessionMatch[1]}; ${csrfMatch[1]}`,
    csrf: decodeURIComponent(csrfMatch[2]),
  };
}

async function api(pathname, { session, method = 'GET', body } = {}) {
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  const response = await fetch(`${backendUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Cookie: session.cookie } : {}),
      ...(session && unsafe ? { 'X-CSRF-Token': session.csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function login(page, user, expectedPath) {
  await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL(`**${expectedPath}`, { timeout: 10_000 });
}

async function runCase(id, name, implementation, contextOptions = {}) {
  const { allowedConsoleErrors = [], ...browserContextOptions } = contextOptions;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...browserContextOptions });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const runtimeErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.stack || error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ method: response.request().method(), status: response.status(), url: response.url() });
    }
  });
  const started = Date.now();
  try {
    const detail = await implementation(page, context);
    assert.equal(runtimeErrors.length, 0, `Browser runtime errors: ${runtimeErrors.join('\n')}`);
    const unexpectedConsoleErrors = consoleErrors.filter((message) => !allowedConsoleErrors.some((pattern) => (
      pattern instanceof RegExp ? pattern.test(message) : message.includes(pattern)
    )));
    assert.equal(unexpectedConsoleErrors.length, 0, `Unexpected browser console errors: ${unexpectedConsoleErrors.join('\n')}`);
    await page.screenshot({ path: path.join(evidenceDir, `${id}-pass.png`), fullPage: true, animations: 'disabled', timeout: 30_000 });
    results.push({ id, name, status: 'PASS', durationMs: Date.now() - started, detail: detail || null, consoleErrors, httpErrors });
  } catch (error) {
    await page.screenshot({ path: path.join(evidenceDir, `${id}-fail.png`), fullPage: true }).catch(() => undefined);
    results.push({ id, name, status: 'FAIL', durationMs: Date.now() - started, error: error.stack || error.message, runtimeErrors, consoleErrors, httpErrors });
  } finally {
    await context.close();
  }
}

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.locator('body').evaluate((body) => ({ scrollWidth: body.scrollWidth, clientWidth: body.clientWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label} overflows horizontally: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

try {
  await waitForUrl(`${backendUrl}/api/health`);
  await waitForUrl(frontendUrl);
  browser = await chromium.launch({ executablePath: edgePath, headless: true });

  await runCase('PUB-01', 'Root opens the employee login page and all six languages switch visibly', async (page) => {
    await page.goto(`${frontendUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login');
    await page.getByRole('heading', { name: /One workspace for every field decision|Operations console/i }).first().waitFor();
    const selector = page.locator('.language-selector');
    const trigger = selector.locator('button').first();
    const labels = {};
    for (let index = 0; index < 6; index += 1) {
      await trigger.click();
      const choices = selector.locator('div button');
      assert.equal(await choices.count(), 6);
      await choices.nth(index).click();
      labels[index] = (await trigger.innerText()).trim();
      assert.ok(labels[index], `Language label ${index} is empty`);
    }
    assert.equal(new Set(Object.values(labels)).size, 6, 'Every language should visibly change the selector label');
    return { labels };
  });

  await runCase('PUB-01B', 'Public request page remains available as a secondary intake channel', async (page) => {
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Request a drone service', exact: true }).waitFor();
  });

  await runCase('PUB-02', 'Narrow mobile landing page has no horizontal overflow', async (page) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `Horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.getByRole('link', { name: /Employee Login|உள்நுழைவு|ಲಾಗಿನ್|లాగిన్|लॉगिन/i }).waitFor();
    return dimensions;
  });

  await runCase('PUB-03', 'Public form controls expose accessible names', async (page) => {
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    const unnamed = await page.locator('input').evaluateAll((elements) => elements.filter((element) => !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')).map((element) => ({ type: element.type, name: element.name, placeholder: element.placeholder })));
    assert.deepEqual(unnamed, [], `Inputs without accessible labels: ${JSON.stringify(unnamed)}`);
  });

  await runCase('PUB-04', 'Public booking creates an in-range request for Sales review', async (page) => {
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    const farmerName = `Browser In Range ${unique}`;
    await page.locator('#public-farmer-name').fill(farmerName);
    await page.locator('#public-phone').fill('9000012345');
    await page.locator('#public-village').fill('Browser Audit Village');
    await page.locator('#public-crop').fill('Cotton');
    await page.locator('#public-acres').fill('7');
    await page.locator('#public-latitude').fill('8.959');
    await page.locator('#public-longitude').fill('77.311');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/website') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Book a Drone' }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 201, JSON.stringify(data));
    assert.equal(data.outcome, 'ACCEPTED');
    assert.equal(data.lead.status, 'NEW');
    assert.equal(data.assignmentOutcome, null);
    await page.getByText('Your request was received and is waiting for Sales review.').waitFor();
    state.inRangeLead = { ...data.lead, farmerName };
    return { leadId: data.lead.id, status: data.lead.status };
  });

  await runCase('PUB-05', 'Public booking strictly declines an out-of-area request without exposing an appeal', async (page) => {
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    await page.locator('#public-farmer-name').fill(`Browser Out Range ${unique}`);
    await page.locator('#public-phone').fill('9000012346');
    await page.locator('#public-village').fill('Out of Area Village');
    await page.locator('#public-crop').fill('Paddy');
    await page.locator('#public-acres').fill('4');
    await page.locator('#public-latitude').fill('13.0827');
    await page.locator('#public-longitude').fill('80.2707');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/website') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Book a Drone' }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 422, JSON.stringify(data));
    assert.deepEqual(data, {
      success: false,
      outcome: 'DECLINED',
      code: 'OUTSIDE_SERVICE_AREA',
      messageKey: 'service_area_unavailable',
    });
    assert.equal(/latitude|longitude|distance|acreage|lead|appeal|fee/i.test(JSON.stringify(data)), false);
    await page.getByText('Service is not currently available for this farm location. Please call the operations team for assistance.').waitFor();
    assert.equal(await page.getByRole('button', { name: /appeal/i }).count(), 0);
    return { outcome: data.outcome };
  }, { allowedConsoleErrors: [/422 \(Unprocessable Entity\)/] });

  await runCase('PUB-06', 'Public intake rejects an invalid phone number', async (page) => {
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    const invalid = await api('/api/leads/ingest/website', { method: 'POST', body: { farmerName: `Invalid Phone API ${unique}`, phone: 'x', cropType: 'Cotton', acres: 2, latitude: 8.959, longitude: 77.311 } });
    assert.equal(invalid.response.status, 400, `Backend accepted invalid phone with HTTP ${invalid.response.status}`);
  });

  await runCase('PUB-07', 'Public intake rejects negative acreage', async (page) => {
    await page.goto(`${frontendUrl}/request`, { waitUntil: 'domcontentloaded' });
    const invalid = await api('/api/leads/ingest/website', { method: 'POST', body: { farmerName: `Invalid Acreage API ${unique}`, phone: '9000012399', cropType: 'Cotton', acres: -5, latitude: 8.959, longitude: 77.311 } });
    assert.equal(invalid.response.status, 400, `Backend accepted negative acreage with HTTP ${invalid.response.status}`);
  });

  await runCase('AUTH-01', 'Unauthenticated protected routes redirect to login', async (page) => {
    for (const route of ['/admin', '/marketing', '/fleet-manager', '/pilot']) {
      await page.goto(`${frontendUrl}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL('**/login');
    }
  });

  await runCase('AUTH-02', 'Invalid login is rejected and no demo password is disclosed', async (page) => {
    await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(roleUsers.ADMIN.email);
    await page.locator('input[type="password"]').fill('incorrect-' + unique);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByText(/Invalid email or password|Login failed/).waitFor();
    const body = await page.locator('body').innerText();
    assert.ok(!/Password:\s*\S+/i.test(body), 'The login screen discloses a demo password');
  }, { allowedConsoleErrors: [/401 \(Unauthorized\)/] });

  await runCase('AUTH-03', 'All four roles authenticate and reach their own dashboard', async (page) => {
    const checks = [
      [roleUsers.ADMIN, '/admin', 'Operations control'],
      [roleUsers.SALES, '/marketing', 'Sales operations'],
      [roleUsers.FLEET_MANAGER, '/fleet-manager', 'Exception scheduling calendar'],
      [roleUsers.PILOT, '/pilot', 'My spraying tasks'],
    ];
    for (const [user, route, text] of checks) {
      await page.context().clearCookies();
      await page.goto(`${frontendUrl}/login`);
      await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('token'); });
      await login(page, user, route);
      await page.getByText(text, { exact: false }).first().waitFor();
      const storedCredentials = await page.evaluate(() => ({
        sessionToken: sessionStorage.getItem('token'),
        localToken: localStorage.getItem('token'),
        storedUser: sessionStorage.getItem('user'),
      }));
      assert.deepEqual(storedCredentials, { sessionToken: null, localToken: null, storedUser: null });
    }
  });

  await runCase('AUTH-04', 'User and drone administration APIs reject unauthenticated callers', async () => {
    const userList = await api('/api/users/all');
    const droneList = await api('/api/drones/all');
    assert.deepEqual({ users: userList.response.status, drones: droneList.response.status }, { users: 401, drones: 401 });
  });

  await runCase('AUTH-05', 'Management APIs reject unauthenticated state changes', async () => {
    const adminSessionForFixture = await apiLogin(roleUsers.ADMIN);
    const droneList = await api('/api/drones/all', { session: adminSessionForFixture });
    const addUser = await api('/api/users/add', { method: 'POST', body: { email: `unauthorized-${unique}@example.invalid`, name: 'Unauthorized Browser User', role: 'PILOT', password: testPassword } });
    const updateDrone = await api('/api/drones/update-status', { method: 'POST', body: { droneId: droneList.data.drones[0].id, status: 'MAINTENANCE', reason: 'Browser authorization audit' } });
    assert.deepEqual({ addUser: addUser.response.status, updateDrone: updateDrone.response.status }, { addUser: 401, updateDrone: 401 });
  });

  await runCase('AUTH-06', 'Authenticated user-list responses never expose password hashes', async () => {
    const session = await apiLogin(roleUsers.ADMIN);
    const userList = await api('/api/users/all', { session });
    const assignmentList = await api('/api/assignments/all', { session });
    assert.equal(userList.response.status, 200);
    assert.equal(assignmentList.response.status, 200);
    const serialized = JSON.stringify({ users: userList.data.users, assignments: assignmentList.data.missions });
    assert.equal(serialized.includes('passwordHash'), false, 'A management response exposed passwordHash');
    const salesSession = await apiLogin(roleUsers.SALES);
    const pilotSession = await apiLogin(roleUsers.PILOT);
    const fleetSession = await apiLogin(roleUsers.FLEET_MANAGER);
    const [salesUsers, pilotDroneMutation, fleetUserMutation] = await Promise.all([
      api('/api/users/all', { session: salesSession }),
      api('/api/drones/update-status', { session: pilotSession, method: 'POST', body: { droneId: assignmentList.data.missions[0].droneId, status: 'MAINTENANCE' } }),
      api('/api/users/add', { session: fleetSession, method: 'POST', body: { email: `forbidden-${unique}@example.invalid`, name: 'Forbidden User', role: 'PILOT', password: testPassword, homeCenterId: roleUsers.PILOT.homeCenterId } }),
    ]);
    assert.deepEqual([salesUsers.response.status, pilotDroneMutation.response.status, fleetUserMutation.response.status], [403, 403, 201]);
  });

  await runCase('SALES-01', 'Sales queue includes an in-range public request awaiting review', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByRole('button', { name: /Access Leads/ }).click();
    await page.getByText(state.inRangeLead.farmerName, { exact: true }).waitFor();
  });

  await runCase('SALES-02', 'Sales manual-entry form creates a valid lead', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByRole('button', { name: /Enter New Lead/ }).click();
    await page.locator('#manual-farmer-name').fill(`Browser Manual ${unique}`);
    await page.locator('#manual-phone').fill('9000012347');
    await page.locator('#manual-location').fill('Browser Audit Village');
    await page.locator('#manual-crop').fill('Groundnut');
    await page.locator('#manual-acres').fill('3');
    await page.locator('.sales-location-picker__map .leaflet-container').click({ position: { x: 180, y: 180 } });
    await page.locator('input[name="latitude"]').evaluate((input) => input.value && input.value.length > 0);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/manual') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create lead' }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201, await response.text());
    await page.getByText(/Lead created and sent through the normal scheduling workflow|Fleet has been notified/i).waitFor();
  });

  await runCase('SALES-03', 'Sales intake strictly declines an out-of-area caller without an appeal path', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByRole('button', { name: /Enter New Lead/ }).click();
    await page.locator('#manual-farmer-name').fill(`Manual Out Range ${unique}`);
    await page.locator('#manual-phone').fill('9000012357');
    await page.locator('#manual-location').fill('Out of Area Village');
    await page.locator('#manual-crop').fill('Paddy');
    await page.locator('#manual-acres').fill('4');
    await page.locator('#sales-location-search').fill('Chennai, Tamil Nadu');
    await page.getByRole('button', { name: 'Search map' }).click();
    await page.getByText(/Found .*Chennai/i).waitFor({ timeout: 15_000 });
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/manual') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create lead' }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 422, JSON.stringify(data));
    assert.equal(data.code, 'OUTSIDE_SERVICE_AREA');
    assert.equal(Object.hasOwn(data, 'lead'), false);
    await page.getByText(/outside the active service area/i).waitFor();
    assert.equal(await page.getByRole('button', { name: /appeal/i }).count(), 0);
  }, { allowedConsoleErrors: [/422 \(Unprocessable Entity\)/] });

  await runCase('FLEET-01', 'Fleet Manager manually schedules an exception lead', async (page) => {
    await login(page, roleUsers.FLEET_MANAGER, '/fleet-manager');
    const card = page.locator('article').filter({ hasText: 'Sample NEEDS_MANUAL_SCHEDULING' });
    await card.waitFor();
    const fleetSession = await apiLogin(roleUsers.FLEET_MANAGER);
    const [pendingData, assignmentData] = await Promise.all([
      api('/api/leads/pending', { session: fleetSession }),
      api('/api/assignments/all', { session: fleetSession }),
    ]);
    const manualLead = pendingData.data.leads.find((lead) => lead.farmerName === 'Sample NEEDS_MANUAL_SCHEDULING');
    const centerPilot = users.find((user) => user.role === 'PILOT'
      && user.homeCenterId === manualLead.matchedCenterId
      && user.name.startsWith('Browser Audit Pilot')
      && !assignmentData.data.missions.some((mission) => mission.pilotId === user.id || mission.copilotId === user.id));
    assert.ok(centerPilot, 'No free same-centre fixture pilot was available for Fleet scheduling');
    const centerCopilot = users.find((user) => user.role === 'PILOT'
      && user.id !== centerPilot.id
      && user.homeCenterId === manualLead.matchedCenterId
      && user.name.startsWith('Browser Audit Pilot')
      && !assignmentData.data.missions.some((mission) => mission.pilotId === user.id || mission.copilotId === user.id));
    assert.ok(centerCopilot, 'No free same-centre fixture Copilot was available for Fleet scheduling');
    await page.locator('#pilot-picker').selectOption(centerPilot.id);
    await page.locator('#copilot-picker').selectOption(centerCopilot.id);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/assignments/manual') && response.request().method() === 'POST');
    await card.getByRole('button', { name: /Schedule on selected date/ }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 201, JSON.stringify(data));
    state.manualAssignment = data.mission;
    await page.getByRole('alert').getByText(/was added to/i).waitFor();
    return { assignmentId: data.mission.id, pilotId: data.mission.pilotId, droneId: data.mission.droneId };
  });

  await runCase('ADMIN-01', 'Admin fleet overview classifies current backend drone statuses', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    const session = await apiLogin(roleUsers.ADMIN);
    const all = await api('/api/drones/all', { session });
    const expectedActive = all.data.drones.filter((drone) => ['AVAILABLE', 'ASSIGNED'].includes(drone.status)).length;
    const heading = await page.getByRole('heading', { name: /Available & Assigned/ }).innerText();
    const displayed = Number(heading.match(/\((\d+)\)/)?.[1]);
    assert.equal(displayed, expectedActive, `UI showed ${displayed}; backend has ${expectedActive} available/assigned drones`);
  });

  await runCase('ADMIN-02', 'Admin creates a new employee from User Management', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    await page.getByRole('button', { name: /User Management/ }).click();
    const form = page.locator('form');
    const inputs = form.locator('input');
    await inputs.nth(0).fill('Browser Created Pilot');
    await inputs.nth(1).fill(`browser-created-${unique}@example.invalid`);
    await inputs.nth(2).fill(crypto.randomBytes(18).toString('base64url'));
    await page.locator('#new-user-center').selectOption(roleUsers.PILOT.homeCenterId);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/users/add') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create Account' }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201, await response.text());
    await page.getByText('Browser Created Pilot', { exact: true }).waitFor();
    await page.getByText(/Operating center:/).last().waitFor();
  });

  const adminSession = await apiLogin(roleUsers.ADMIN);
  if (!state.inRangeLead) {
    const fallback = await api('/api/leads/ingest/website', { method: 'POST', body: { farmerName: `Fallback ${unique}`, phone: '9000099999', cropType: 'Cotton', acres: 5, latitude: 8.959, longitude: 77.311, preferredLanguage: 'en' } });
    assert.equal(fallback.response.status, 201, JSON.stringify(fallback.data));
    assert.equal(fallback.data.outcome, 'ACCEPTED');
    state.inRangeLead = fallback.data.lead;
    state.inRangeLead.farmerName = `Fallback ${unique}`;
  }
  let processed = { data: {} };
  if (!state.autoAssignment) {
    processed = await api('/api/leads/process', { session: adminSession, method: 'POST', body: { id: state.inRangeLead.id, employeeId: roleUsers.ADMIN.id, mandal: 'Audit Mandal', district: 'Audit District', soilType: 'Red', cropAge: '8', pesticideBrand: 'Audit Brand', expectedSpraying: '1' } });
    if (processed.response.ok && processed.data.assignment?.assignment) state.autoAssignment = processed.data.assignment.assignment;
  }

  await runCase('PILOT-01', 'Assigned pilot accepts, starts, publishes GPS, and completes a mission', async (page, context) => {
    assert.ok(state.autoAssignment, `Auto-assignment setup failed: ${JSON.stringify(processed.data)}`);
    const pilot = users.find((user) => user.id === state.autoAssignment.pilotId);
    await context.grantPermissions(['geolocation'], { origin: frontendUrl });
    await context.setGeolocation({ latitude: 8.9591, longitude: 77.3111 });
    const locationStatuses = [];
    page.on('response', (response) => {
      if (response.url().includes(`/api/assignments/${state.autoAssignment.id}/location`)) locationStatuses.push(response.status());
    });
    await login(page, pilot, '/pilot');
    const card = page.locator('article').filter({ hasText: state.inRangeLead.farmerName });
    await card.waitFor();
    await card.getByRole('button', { name: 'Accept mission' }).click();
    await card.getByRole('button', { name: 'Start mission' }).waitFor();
    const locationPromise = page.waitForResponse((response) => response.url().includes(`/api/assignments/${state.autoAssignment.id}/location`) && response.status() === 200, { timeout: 10_000 });
    await card.getByRole('button', { name: 'Start mission' }).click();
    await locationPromise;
    const fleetContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const fleetPage = await fleetContext.newPage();
    const externalMapRequests = [];
    fleetPage.on('request', (request) => {
      if (request.url().includes('openstreetmap.org')) externalMapRequests.push(request.url());
    });
    try {
      await login(fleetPage, roleUsers.FLEET_MANAGER, '/fleet-manager');
      await fleetPage.getByRole('button', { name: /Live Pilot GPS/i }).click();
      await fleetPage.getByText('Live pilot location').waitFor();
      const missionPicker = fleetPage.getByLabel('Mission to monitor');
      const missionOption = missionPicker.locator('option').filter({ hasText: state.inRangeLead.farmerName });
      const missionId = await missionOption.getAttribute('value');
      assert.ok(missionId, 'The active pilot mission was not available to monitor');
      await missionPicker.selectOption(missionId);
      const positionLink = fleetPage.getByRole('link', { name: /Live position/i });
      await positionLink.waitFor({ timeout: 10_000 });
      const mapQuery = new URL(await positionLink.getAttribute('href')).searchParams.get('query');
      assert.equal(mapQuery, '8.9591,77.3111');
      const positionLabel = await positionLink.innerText();
      assert.doesNotMatch(positionLabel, /-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?/);
      assert.equal(externalMapRequests.length, 0, 'OpenStreetMap was contacted before the user loaded the map');
      await fleetPage.getByRole('button', { name: 'Load live map' }).click();
      await fleetPage.locator('iframe[title^="Live map for"]').waitFor();
      await fleetPage.waitForTimeout(200);
      assert.ok(externalMapRequests.length >= 1, 'The selected live map did not load after explicit consent');
    } finally { await fleetContext.close(); }
    await card.locator('input[placeholder="Actual acres"]').fill('6.5');
    const completePromise = page.waitForResponse((response) => response.url().includes(`/api/assignments/${state.autoAssignment.id}/complete`));
    await card.getByRole('button', { name: 'Complete' }).click();
    const complete = await completePromise;
    const data = await complete.json();
    assert.equal(complete.status(), 200, JSON.stringify(data));
    assert.equal(data.lead.status, 'COMPLETED');
    await page.waitForTimeout(750);
    assert.equal(locationStatuses.includes(409), false, `GPS transition race returned 409: ${locationStatuses.join(', ')}`);
    assert.equal(Object.hasOwn(data, 'payment'), false, 'Mission completion exposed the retired immediate-payment result');
    return { assignmentId: state.autoAssignment.id, finalStatus: data.lead.status, paymentCreated: false };
  });

  await runCase('PILOT-02', 'Pilot offline action queues and synchronizes after reconnection', async (page, context) => {
    const allAssignments = await api('/api/assignments/all', { session: adminSession });
    const scheduled = allAssignments.data.missions.find((mission) => mission.lead?.status === 'SCHEDULED');
    assert.ok(scheduled, 'No scheduled fixture mission was available');
    const pilot = users.find((user) => user.id === scheduled.pilotId);
    await login(page, pilot, '/pilot');
    const card = page.locator('article').filter({ hasText: scheduled.lead.farmerName });
    await card.waitFor();
    await context.setOffline(true);
    await page.getByText('Offline', { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Accept mission' }).click();
    await page.getByText(/Offline: action saved/i).waitFor();
    await page.getByText(/1 action waiting to sync/i).waitFor();
    await context.setOffline(false);
    await page.getByText(/1 offline action synced/i).waitFor({ timeout: 10_000 });
    return { assignmentId: scheduled.id };
  });

  await runCase('BILLING-01', 'Incomplete immediate-payment UI and APIs remain retired after mission completion', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    assert.equal(await page.getByRole('button', { name: /Payment Collection/i }).count(), 0);
    const retired = await api('/api/payments/pending', { session: await apiLogin(roleUsers.SALES) });
    assert.equal(retired.response.status, 404);
  });

  await runCase('CRM-01', 'Admin opens the full lifecycle timeline for the completed lead', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    await page.getByRole('button', { name: /Lead Details/ }).click();
    await page.getByLabel('Search logbook').fill(state.inRangeLead.farmerName);
    const row = page.locator('tbody tr').filter({ hasText: state.inRangeLead.farmerName });
    await row.click();
    await page.getByText('Lifecycle timeline').waitFor();
    const entries = page.locator('aside article');
    await entries.first().waitFor({ timeout: 10_000 });
    assert.ok(await entries.count() >= 4, `Expected at least four lifecycle events; found ${await entries.count()}`);
    return { entryCount: await entries.count() };
  });

  await runCase('CHAT-01', 'Admin and Pilot exchange live messages and Admin closes the chat for both', async (adminPage) => {
    const pilotContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pilotPage = await pilotContext.newPage();
    try {
      await login(adminPage, roleUsers.ADMIN, '/admin');
      await adminPage.getByRole('button', { name: /Team Command Chat/ }).click();
      await adminPage.getByText(/Live/).first().waitFor({ timeout: 10_000 });
      await adminPage.locator('#chat-participant').selectOption(roleUsers.PILOT.id);
      await adminPage.getByRole('button', { name: 'Open chat' }).click();
      await adminPage.getByText(/New chat opened|Opened the existing chat/).waitFor();
      const message = `Browser audit message ${unique}`;
      await adminPage.locator('input[placeholder*="Type a message"]').fill(message);
      await adminPage.getByRole('button', { name: 'Send' }).click();
      await adminPage.getByText(message, { exact: true }).waitFor();

      await login(pilotPage, roleUsers.PILOT, '/pilot');
      await pilotPage.getByRole('button', { name: 'Support desk' }).click();
      await pilotPage.getByText(/Live/).first().waitFor({ timeout: 10_000 });
      assert.equal(await pilotPage.locator('#chat-participant').count(), 0, 'Pilot was allowed to start an upward chat');
      await pilotPage.getByRole('button', { name: /Admin User/ }).click();
      await pilotPage.getByText(message, { exact: true }).waitFor();
      const reply = `Pilot reply ${unique}`;
      await pilotPage.locator('input[placeholder*="Type a message"]').fill(reply);
      await pilotPage.getByRole('button', { name: 'Send' }).click();
      await adminPage.getByText(reply, { exact: true }).waitFor({ timeout: 10_000 });
      adminPage.once('dialog', (dialog) => dialog.accept());
      await adminPage.getByRole('button', { name: 'Close chat' }).click();
      await adminPage.getByText(/Chat closed for both participants/i).waitFor();
      await pilotPage.getByText(/closed by Admin/i).waitFor({ timeout: 10_000 });
    } finally { await pilotContext.close(); }
  });

  await runCase('CHAT-02', 'Fleet starts a lower-role chat while upward initiation and non-Admin closure stay blocked', async (fleetPage) => {
    await login(fleetPage, roleUsers.FLEET_MANAGER, '/fleet-manager');
    await fleetPage.getByRole('button', { name: /Team Chat/ }).click();
    await fleetPage.getByText(/Live/).first().waitFor({ timeout: 10_000 });
    const participantOptions = await fleetPage.locator('#chat-participant option').allTextContents();
    assert.equal(participantOptions.some((label) => /admin/i.test(label)), false);
    assert.equal(participantOptions.some((label) => /pilot/i.test(label)), true);
    await fleetPage.locator('#chat-participant').selectOption(roleUsers.PILOT.id);
    await fleetPage.getByRole('button', { name: 'Open chat' }).click();
    await fleetPage.getByText(/New chat opened|Opened the existing chat/).waitFor();
    assert.equal(await fleetPage.getByRole('button', { name: 'Close chat' }).count(), 0);
    const message = `Fleet instruction ${unique}`;
    await fleetPage.locator('input[placeholder*="Type a message"]').fill(message);
    await fleetPage.getByRole('button', { name: 'Send' }).click();
    await fleetPage.getByText(message, { exact: true }).waitFor();

    const fleetSession = await apiLogin(roleUsers.FLEET_MANAGER);
    const forbidden = await api('/api/chat/sessions', {
      session: fleetSession,
      method: 'POST',
      body: { participantId: roleUsers.ADMIN.id },
    });
    assert.equal(forbidden.response.status, 403);
  }, { allowedConsoleErrors: [/403 \(Forbidden\)/] });

  await runCase('PORTAL-UI-01', 'Business public self-registration is visibly retired and cannot submit an account', async (page) => {
    await page.goto(`${frontendUrl}/business/register`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Public self-registration is unavailable/i).waitFor();
    assert.equal(await page.getByRole('button', { name: /Register Business/i }).count(), 0);
    const response = await api('/api/auth/business/register', {
      method: 'POST',
      body: {
        businessName: 'Browser Unapproved Business',
        contactPerson: 'Browser Contact',
        email: `browser-unapproved-${unique}@example.invalid`,
        mobile: '9000012398',
        address: 'Must not persist',
        gstNo: 'UNAPPROVED',
        password: testPassword,
      },
    });
    assert.equal(response.response.status, 404);
  });

  await runCase('UI-01', 'Admin workspace remains usable without page overflow on mobile', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    const tabs = ['Fleet Overview', 'My Team', 'Lead Details', 'Team Command Chat', 'Live Pilot GPS'];
    const dimensions = {};
    for (const tab of tabs) {
      await page.getByRole('button', { name: new RegExp(tab, 'i') }).click();
      await page.waitForTimeout(120);
      dimensions[tab] = await assertNoPageOverflow(page, `Admin ${tab}`);
    }
    return dimensions;
  }, { viewport: { width: 390, height: 844 } });

  await runCase('UI-02', 'Sales workspace remains usable without page overflow on mobile', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    for (const hiddenModule of ['Operational alerts', 'Team Chat', 'CRM Logbook', 'Payment Collection']) {
      assert.equal(await page.getByRole('button', { name: new RegExp(hiddenModule, 'i') }).count(), 0, `${hiddenModule} must not be exposed in Sales navigation`);
    }
    const tabs = ['Customer Registration', 'Enter New Lead', 'Access Leads'];
    const dimensions = {};
    for (const tab of tabs) {
      await page.getByRole('button', { name: new RegExp(tab, 'i') }).click();
      await page.waitForTimeout(120);
      dimensions[tab] = await assertNoPageOverflow(page, `Sales ${tab}`);
    }
    await page.getByRole('button', { name: /Open employee profile menu/i }).click();
    await page.getByRole('button', { name: /My Profile/i }).click();
    dimensions.Profile = await assertNoPageOverflow(page, 'Sales Profile');
    return dimensions;
  }, { viewport: { width: 390, height: 844 } });

  await runCase('UI-03', 'Fleet calendar and live GPS remain contained on tablet', async (page) => {
    await login(page, roleUsers.FLEET_MANAGER, '/fleet-manager');
    await page.getByRole('heading', { name: 'Exception scheduling calendar' }).waitFor();
    const calendar = await assertNoPageOverflow(page, 'Fleet scheduling calendar');
    await page.getByRole('button', { name: /Live Pilot GPS/i }).click();
    await page.getByText('Live pilot location').waitFor();
    const location = await assertNoPageOverflow(page, 'Fleet live GPS');
    return { calendar, location };
  }, { viewport: { width: 768, height: 1024 } });

  await runCase('UI-04', 'Pilot mission and support workspaces remain contained on mobile', async (page) => {
    await login(page, roleUsers.PILOT, '/pilot');
    await page.getByText('My spraying tasks').waitFor();
    const missions = await assertNoPageOverflow(page, 'Pilot missions');
    await page.getByRole('button', { name: 'Support desk' }).click();
    await page.getByText(/Supervisor messages/i).waitFor();
    const support = await assertNoPageOverflow(page, 'Pilot support chat');
    return { missions, support };
  }, { viewport: { width: 390, height: 844 } });

  await runCase('UI-05', 'Employee login remains contained on mobile', async (page) => {
    await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Login', exact: true }).waitFor();
    return assertNoPageOverflow(page, 'Employee login');
  }, { viewport: { width: 390, height: 844 } });

  const health = await api('/api/health');
  results.push({ id: 'OPS-01', name: 'Health endpoint reports database and scheduled jobs', status: health.response.status === 200 && health.data.database === 'ok' ? 'PASS' : 'FAIL', durationMs: 0, detail: health.data });
} finally {
  if (browser) await browser.close();
  stopProcess(frontendProcess);
  stopProcess(backendProcess);
  const summary = { generatedAt: new Date().toISOString(), database: databaseName, frontendUrl, backendUrl, totals: { tests: results.length, passed: results.filter((item) => item.status === 'PASS').length, failed: results.filter((item) => item.status === 'FAIL').length }, results };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.totals.failed > 0) process.exitCode = 1;
}
