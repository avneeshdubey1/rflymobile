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
const jwtSecret = crypto.randomBytes(48).toString('base64url');
const unique = Date.now().toString();

const databaseExists = run('docker', ['exec', 'rfly-postgres', 'psql', '-U', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${databaseName}'`]);
if (databaseExists.trim() !== '1') run('docker', ['exec', 'rfly-postgres', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${databaseName}`]);

const databaseEnv = { ...process.env, DATABASE_URL: databaseUrl };
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
    DATABASE_URL: databaseUrl,
    PORT: '5100',
    JWT_SECRET: jwtSecret,
    FORM_WEBHOOK_SECRET: crypto.randomBytes(24).toString('base64url'),
    WHATSAPP_API_KEY: '',
    WEATHER_API_KEY: '',
    UPI_GATEWAY_KEY: '',
    UPI_WEBHOOK_SECRET: '',
    NOTIFICATION_CASCADE_TIMERS_MS: '86400000,172800000,259200000,345600000',
    CHAT_AUTO_CLOSE_AFTER_MS: '86400000',
    CHAT_AUTO_CLOSE_INTERVAL_MS: '86400000',
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
  return data.token;
}

async function api(pathname, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${backendUrl}${pathname}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function login(page, user, expectedPath) {
  await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.getByRole('button', { name: 'Login' }).click();
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

  await runCase('PUB-01', 'Landing page renders and all five languages switch visibly', async (page) => {
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    const language = page.locator('select').first();
    await language.selectOption('en');
    await page.getByRole('heading', { name: /Field work/ }).waitFor();
    assert.equal(await language.locator('option').count(), 5);
    const labels = {};
    for (const code of ['en', 'ta', 'kn', 'te', 'hi']) {
      await language.selectOption(code);
      labels[code] = (await page.locator('form button[type="submit"]').innerText()).trim();
      assert.ok(labels[code], `${code} submit label is empty`);
    }
    assert.equal(new Set(Object.values(labels)).size, 5, 'Every language should visibly change the submit label');
    return { labels };
  });

  await runCase('PUB-02', 'Mobile landing page has no horizontal overflow', async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `Horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.getByRole('button', { name: /Employee Login|உள்நுழைவு|ಲಾಗಿನ್|లాగిన్|लॉगिन/i }).waitFor();
    return dimensions;
  });

  await runCase('PUB-03', 'Public form controls expose accessible names', async (page) => {
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('select').first().selectOption('en');
    const unnamed = await page.locator('input').evaluateAll((elements) => elements.filter((element) => !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')).map((element) => ({ type: element.type, name: element.name, placeholder: element.placeholder })));
    assert.deepEqual(unnamed, [], `Inputs without accessible labels: ${JSON.stringify(unnamed)}`);
  });

  await runCase('PUB-04', 'In-range farmer submits GPS-backed website request', async (page) => {
    await page.context().grantPermissions(['geolocation'], { origin: frontendUrl });
    await page.context().setGeolocation({ latitude: 8.959, longitude: 77.311 });
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('select').first().selectOption('en');
    await page.locator('input[name="farmerName"]').fill(`Browser In Range ${unique}`);
    await page.locator('input[name="phone"]').fill('9000012345');
    await page.getByRole('button', { name: 'Fetch GPS' }).click();
    await page.locator('input[name="village"]:disabled').waitFor();
    await page.locator('input[name="cropType"]').fill('Cotton');
    await page.locator('input[name="acres"]').fill('7');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/website') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Book a Drone' }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 201, JSON.stringify(data));
    assert.equal(data.inRange, true);
    state.inRangeLead = data.lead;
    await page.getByText(/Request submitted successfully/i).waitFor();
    return { leadId: data.lead.id, status: data.lead.status, matchedCenterId: data.lead.matchedCenterId };
  });

  await runCase('PUB-05', 'Out-of-range farmer receives and submits an appeal', async (page) => {
    await page.context().grantPermissions(['geolocation'], { origin: frontendUrl });
    await page.context().setGeolocation({ latitude: 13.0827, longitude: 80.2707 });
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('select').first().selectOption('en');
    await page.locator('input[name="farmerName"]').fill(`Browser Out Range ${unique}`);
    await page.locator('input[name="phone"]').fill('9000012346');
    await page.getByRole('button', { name: 'Fetch GPS' }).click();
    await page.locator('input[name="cropType"]').fill('Paddy');
    await page.locator('input[name="acres"]').fill('4');
    const intakePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/website') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Book a Drone' }).click();
    const intake = await intakePromise;
    const data = await intake.json();
    assert.equal(intake.status(), 201, JSON.stringify(data));
    assert.equal(data.inRange, false);
    state.outRangeLead = data.lead;
    const appealPromise = page.waitForResponse((response) => response.url().includes(`/api/leads/${data.lead.id}/appeal`));
    await page.getByRole('button', { name: /cover the extra transport cost/i }).click();
    const appeal = await appealPromise;
    assert.equal(appeal.status(), 201, await appeal.text());
    await page.getByText(/appeal is pending review/i).waitFor();
    return { leadId: data.lead.id, distanceKm: data.distanceKm, excessKm: data.appealOffer.excessKm };
  });

  await runCase('PUB-06', 'Public intake rejects an invalid phone number', async (page) => {
    await page.context().grantPermissions(['geolocation'], { origin: frontendUrl });
    await page.context().setGeolocation({ latitude: 8.959, longitude: 77.311 });
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('select').first().selectOption('en');
    await page.locator('input[name="farmerName"]').fill(`Invalid Phone ${unique}`);
    await page.locator('input[name="phone"]').fill('x');
    await page.getByRole('button', { name: 'Fetch GPS' }).click();
    await page.locator('input[name="cropType"]').fill('Cotton');
    await page.locator('input[name="acres"]').fill('2');
    assert.equal(await page.locator('input[name="phone"]').evaluate((input) => input.checkValidity()), false, 'Client-side phone validation accepted letters');
    const invalid = await api('/api/leads/ingest/website', { method: 'POST', body: { farmerName: `Invalid Phone API ${unique}`, phone: 'x', cropType: 'Cotton', acres: 2, latitude: 8.959, longitude: 77.311 } });
    assert.equal(invalid.response.status, 400, `Backend accepted invalid phone with HTTP ${invalid.response.status}`);
  });

  await runCase('PUB-07', 'Public intake rejects negative acreage', async (page) => {
    await page.context().grantPermissions(['geolocation'], { origin: frontendUrl });
    await page.context().setGeolocation({ latitude: 8.959, longitude: 77.311 });
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('select').first().selectOption('en');
    await page.locator('input[name="farmerName"]').fill(`Invalid Acreage ${unique}`);
    await page.locator('input[name="phone"]').fill('9000012399');
    await page.getByRole('button', { name: 'Fetch GPS' }).click();
    await page.locator('input[name="cropType"]').fill('Cotton');
    await page.locator('input[name="acres"]').fill('-5');
    assert.equal(await page.locator('input[name="acres"]').evaluate((input) => input.checkValidity()), false, 'Client-side acreage validation accepted a negative value');
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
    await page.getByRole('button', { name: 'Login' }).click();
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
      await page.evaluate(() => sessionStorage.clear());
      await login(page, user, route);
      await page.getByText(text, { exact: false }).first().waitFor();
      await page.goBack();
      await page.waitForURL(`**${route}`);
      assert.ok(page.url().endsWith(route), `Browser Back exposed the login page for ${user.role}: ${page.url()}`);
    }
  });

  await runCase('AUTH-04', 'User and drone administration APIs reject unauthenticated callers', async () => {
    const userList = await api('/api/users/all');
    const droneList = await api('/api/drones/all');
    assert.deepEqual({ users: userList.response.status, drones: droneList.response.status }, { users: 401, drones: 401 });
  });

  await runCase('AUTH-05', 'Management APIs reject unauthenticated state changes', async () => {
    const adminTokenForFixture = await apiLogin(roleUsers.ADMIN);
    const droneList = await api('/api/drones/all', { token: adminTokenForFixture });
    const addUser = await api('/api/users/add', { method: 'POST', body: { email: `unauthorized-${unique}@example.invalid`, name: 'Unauthorized Browser User', role: 'PILOT', password: testPassword } });
    const updateDrone = await api('/api/drones/update-status', { method: 'POST', body: { droneId: droneList.data.drones[0].id, status: 'MAINTENANCE', reason: 'Browser authorization audit' } });
    assert.deepEqual({ addUser: addUser.response.status, updateDrone: updateDrone.response.status }, { addUser: 401, updateDrone: 401 });
  });

  await runCase('AUTH-06', 'Authenticated user-list responses never expose password hashes', async () => {
    const token = await apiLogin(roleUsers.ADMIN);
    const userList = await api('/api/users/all', { token });
    const assignmentList = await api('/api/assignments/all', { token });
    assert.equal(userList.response.status, 200);
    assert.equal(assignmentList.response.status, 200);
    const serialized = JSON.stringify({ users: userList.data.users, assignments: assignmentList.data.missions });
    assert.equal(serialized.includes('passwordHash'), false, 'A management response exposed passwordHash');
    const salesToken = await apiLogin(roleUsers.SALES);
    const pilotToken = await apiLogin(roleUsers.PILOT);
    const fleetToken = await apiLogin(roleUsers.FLEET_MANAGER);
    const [salesUsers, pilotDroneMutation, fleetUserMutation] = await Promise.all([
      api('/api/users/all', { token: salesToken }),
      api('/api/drones/update-status', { token: pilotToken, method: 'POST', body: { droneId: assignmentList.data.missions[0].droneId, status: 'MAINTENANCE' } }),
      api('/api/users/add', { token: fleetToken, method: 'POST', body: { email: `forbidden-${unique}@example.invalid`, name: 'Forbidden User', role: 'PILOT', password: testPassword } }),
    ]);
    assert.deepEqual([salesUsers.response.status, pilotDroneMutation.response.status, fleetUserMutation.response.status], [403, 403, 403]);
  });

  await runCase('SALES-01', 'Sales dashboard displays newly submitted NEW leads for processing', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByText(state.inRangeLead.farmerName, { exact: true }).waitFor({ timeout: 8_000 });
  });

  await runCase('SALES-02', 'Sales manual-entry form creates a valid lead', async (page) => {
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByRole('button', { name: /Enter New Lead/ }).click();
    const form = page.locator('form');
    const inputs = form.locator('input');
    await inputs.nth(0).fill(`Browser Manual ${unique}`);
    await inputs.nth(1).fill('9000012347');
    await inputs.nth(2).fill('GPS: 8.959, 77.311');
    await inputs.nth(3).fill('Groundnut');
    await inputs.nth(4).fill('3');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/leads/ingest/manual') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create Lead' }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201, await response.text());
    await page.getByText(/Lead created and automatically scheduled|Fleet has been notified/i).waitFor();
  });

  await runCase('SALES-03', 'Sales reviews an out-of-range website appeal', async (page) => {
    if (!state.outRangeLead) {
      const fallback = await api('/api/leads/ingest/website', { method: 'POST', body: { farmerName: `Fallback Appeal ${unique}`, phone: '9000088888', cropType: 'Paddy', acres: 4, latitude: 13.0827, longitude: 80.2707, preferredLanguage: 'en' } });
      assert.equal(fallback.response.status, 201, JSON.stringify(fallback.data));
      state.outRangeLead = fallback.data.lead;
      const appeal = await api(`/api/leads/${state.outRangeLead.id}/appeal`, { method: 'POST', body: { farmerMessage: 'Browser fallback appeal' } });
      assert.equal(appeal.response.status, 201, JSON.stringify(appeal.data));
    }
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByRole('button', { name: /Appeals & alerts/ }).click();
    const appealCard = page.locator('article').filter({ hasText: state.outRangeLead.farmerName });
    await appealCard.waitFor();
    const responsePromise = page.waitForResponse((response) => response.url().includes(`/api/leads/${state.outRangeLead.id}/appeal/review`) && response.request().method() === 'POST');
    await appealCard.getByRole('button', { name: 'Approve appeal' }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(data));
    assert.ok(['SCHEDULED', 'NEEDS_MANUAL_SCHEDULING'].includes(data.assignment?.lead?.status || data.lead.status));
    await page.getByText(/Appeal approved and sent to scheduling/i).waitFor();
  });

  await runCase('FLEET-01', 'Fleet Manager manually schedules an exception lead', async (page) => {
    await login(page, roleUsers.FLEET_MANAGER, '/fleet-manager');
    const card = page.locator('article').filter({ hasText: 'Sample NEEDS_MANUAL_SCHEDULING' });
    await card.waitFor();
    const fleetToken = await apiLogin(roleUsers.FLEET_MANAGER);
    const [pendingData, assignmentData] = await Promise.all([
      api('/api/leads/pending', { token: fleetToken }),
      api('/api/assignments/all', { token: fleetToken }),
    ]);
    const manualLead = pendingData.data.leads.find((lead) => lead.farmerName === 'Sample NEEDS_MANUAL_SCHEDULING');
    const centerPilot = users.find((user) => user.role === 'PILOT'
      && user.homeCenterId === manualLead.matchedCenterId
      && user.name.startsWith('Browser Audit Pilot')
      && !assignmentData.data.missions.some((mission) => mission.pilotId === user.id));
    assert.ok(centerPilot, 'No free same-centre fixture pilot was available for Fleet scheduling');
    await page.locator('#pilot-picker').selectOption(centerPilot.id);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/assignments/manual') && response.request().method() === 'POST');
    await card.getByRole('button', { name: /Schedule on selected date/ }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 201, JSON.stringify(data));
    state.manualAssignment = data.mission;
    await page.getByRole('alert').getByText(/is scheduled with/i).waitFor();
    return { assignmentId: data.mission.id, pilotId: data.mission.pilotId, droneId: data.mission.droneId };
  });

  await runCase('ADMIN-01', 'Admin fleet overview classifies current backend drone statuses', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    const token = await apiLogin(roleUsers.ADMIN);
    const all = await api('/api/drones/all', { token });
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
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/users/add') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create Account' }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201, await response.text());
    await page.getByText('Browser Created Pilot', { exact: true }).waitFor();
  });

  const adminToken = await apiLogin(roleUsers.ADMIN);
  if (!state.inRangeLead) {
    const fallback = await api('/api/leads/ingest/website', { method: 'POST', body: { farmerName: `Fallback ${unique}`, phone: '9000099999', cropType: 'Cotton', acres: 5, latitude: 8.959, longitude: 77.311, preferredLanguage: 'en' } });
    state.inRangeLead = fallback.data.lead;
  }
  const processed = await api('/api/leads/process', { token: adminToken, method: 'POST', body: { id: state.inRangeLead.id, employeeId: roleUsers.ADMIN.id, mandal: 'Audit Mandal', district: 'Audit District', soilType: 'Red', cropAge: '8', pesticideBrand: 'Audit Brand', expectedSpraying: '1' } });
  if (processed.response.ok && processed.data.assignment?.assignment) state.autoAssignment = processed.data.assignment.assignment;

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
      await fleetPage.getByText('Live pilot location').waitFor();
      const positionLink = fleetPage.getByRole('link', { name: /Live position/i });
      await positionLink.waitFor({ timeout: 10_000 });
      const mapQuery = new URL(await positionLink.getAttribute('href')).searchParams.get('query');
      assert.equal(mapQuery, '8.9591,77.3111');
      const livePanelText = await fleetPage.getByText('Live pilot location').locator('xpath=ancestor::section').innerText();
      assert.doesNotMatch(livePanelText, /-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?/);
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
    state.paymentLeadName = state.inRangeLead.farmerName;
    return { assignmentId: state.autoAssignment.id, finalStatus: data.lead.status, paymentCreated: Boolean(data.payment) };
  });

  await runCase('PILOT-02', 'Pilot offline action queues and synchronizes after reconnection', async (page, context) => {
    const allAssignments = await api('/api/assignments/all', { token: adminToken });
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

  await runCase('PAY-01', 'Sales sees completed mission payment and records cash collection', async (page) => {
    assert.ok(state.paymentLeadName, 'Pilot completion did not produce a payment setup');
    await login(page, roleUsers.SALES, '/marketing');
    await page.getByRole('button', { name: /Payment Collection/ }).click();
    const payment = page.locator('article').filter({ hasText: state.paymentLeadName });
    await payment.waitFor();
    const fallbackResponse = page.waitForResponse((response) => response.url().includes('/generate-link'));
    await payment.getByRole('button', { name: 'Try UPI link' }).click();
    const fallback = await fallbackResponse;
    assert.equal(fallback.status(), 200);
    await page.getByText(/No UPI provider is configured/i).waitFor();
    const cashResponse = page.waitForResponse((response) => response.url().includes('/mark-cash'));
    await payment.getByRole('button', { name: 'Mark cash collected' }).click();
    const cash = await cashResponse;
    assert.equal(cash.status(), 200, await cash.text());
  });

  await runCase('CRM-01', 'Admin opens the full lifecycle timeline for the completed lead', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    await page.getByRole('button', { name: /CRM Logbook/ }).click();
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
      await adminPage.getByRole('button', { name: /Pilot Support Chat/ }).click();
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
      await pilotPage.getByRole('button', { name: /Admin User/ }).click();
      await pilotPage.getByText(message, { exact: true }).waitFor();
      const reply = `Pilot reply ${unique}`;
      await pilotPage.locator('input[placeholder*="Type a message"]').fill(reply);
      await pilotPage.getByRole('button', { name: 'Send' }).click();
      await adminPage.getByText(reply, { exact: true }).waitFor({ timeout: 10_000 });
      adminPage.once('dialog', (dialog) => dialog.accept());
      await adminPage.getByRole('button', { name: 'Close chat' }).click();
      await adminPage.getByText(/Chat closed for both participants/i).waitFor();
      await pilotPage.getByText(/closed by an administrator/i).waitFor({ timeout: 10_000 });
    } finally { await pilotContext.close(); }
  });

  await runCase('UI-01', 'Admin workspace remains usable without page overflow on mobile', async (page) => {
    await login(page, roleUsers.ADMIN, '/admin');
    const tabs = ['Fleet Overview', 'User Management', 'CRM Logbook', 'Pilot Support Chat', 'Payment Collection', 'Live Pilot GPS'];
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
    const tabs = ['Process Leads', 'Enter New Lead', 'Appeals & alerts', 'Payment Collection', 'CRM Logbook'];
    const dimensions = {};
    for (const tab of tabs) {
      await page.getByRole('button', { name: new RegExp(tab, 'i') }).click();
      await page.waitForTimeout(120);
      dimensions[tab] = await assertNoPageOverflow(page, `Sales ${tab}`);
    }
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
    await page.getByText(/Admin–Pilot support chat/i).waitFor();
    const support = await assertNoPageOverflow(page, 'Pilot support chat');
    return { missions, support };
  }, { viewport: { width: 390, height: 844 } });

  await runCase('UI-05', 'Employee login remains contained on mobile', async (page) => {
    await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Login' }).waitFor();
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
}
