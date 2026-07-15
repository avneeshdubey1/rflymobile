const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { haversineDistanceKm } = require('../services/geofenceService');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
let salesAuthorization;
const createdLeadIds = [];

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const sales = await prisma.user.findFirst({ where: { role: 'SALES' } });
  salesAuthorization = `Bearer ${issueToken(sales)}`;
});

test('Haversine distance returns zero for the same point', () => {
  assert.equal(haversineDistanceKm(8.959, 77.311, 8.959, 77.311), 0);
});

test('website intake geofences in-range and out-of-range requests, then creates an appeal', async () => {
  const inRange = await fetch(`${baseUrl}/api/leads/ingest/website`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmerName: 'Phase 2 In Range', phone: '9111111111', acres: 2, cropType: 'Rice', latitude: 8.959, longitude: 77.311 }),
  });
  const inRangeBody = await inRange.json();
  createdLeadIds.push(inRangeBody.lead.id);
  assert.equal(inRange.status, 201);
  assert.equal(inRangeBody.inRange, true);
  assert.equal(inRangeBody.lead.status, 'NEW');

  const outOfRange = await fetch(`${baseUrl}/api/leads/ingest/website`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmerName: 'Phase 2 Out Of Range', phone: '9222222222', acres: 2, cropType: 'Rice', latitude: 10, longitude: 77.311 }),
  });
  const outOfRangeBody = await outOfRange.json();
  createdLeadIds.push(outOfRangeBody.lead.id);
  assert.equal(outOfRange.status, 201);
  assert.equal(outOfRangeBody.inRange, false);
  assert.equal(outOfRangeBody.lead.status, 'OUT_OF_RANGE');
  assert.ok(outOfRangeBody.appealOffer.suggestedFee > 0);

  const appealResponse = await fetch(`${baseUrl}/api/leads/${outOfRangeBody.lead.id}/appeal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerMessage: 'Please review' }),
  });
  const appealBody = await appealResponse.json();
  assert.equal(appealResponse.status, 201);
  assert.equal(appealBody.appeal.status, 'PENDING');

  const reviewResponse = await fetch(`${baseUrl}/api/leads/${outOfRangeBody.lead.id}/appeal/review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: salesAuthorization }, body: JSON.stringify({ decision: 'APPROVED', finalFee: appealBody.appeal.suggestedFee, reviewedBy: 'test-reviewer' }),
  });
  const reviewBody = await reviewResponse.json();
  assert.equal(reviewResponse.status, 200);
  assert.equal(reviewBody.appeal.status, 'APPROVED');
  assert.equal(reviewBody.lead.status, 'PROCESSED');
});

test('Google Form webhook is idempotent', async () => {
  const payload = { farmerName: 'Phase 2 Surveyor Lead', farmerPhone: '9333333333', acreage: 3, cropType: 'Paddy', surveyorName: 'Surveyor', formResponseId: 'phase2-test-response', mapsLink: 'https://maps.google.com/?q=8.959,77.311', secret: process.env.FORM_WEBHOOK_SECRET };
  const first = await fetch(`${baseUrl}/api/leads/ingest/google-form`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const firstBody = await first.json();
  createdLeadIds.push(firstBody.lead.id);
  assert.equal(first.status, 201);
  const duplicate = await fetch(`${baseUrl}/api/leads/ingest/google-form`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const duplicateBody = await duplicate.json();
  assert.equal(duplicate.status, 200);
  assert.equal(duplicateBody.duplicate, true);
  assert.equal(duplicateBody.lead.id, firstBody.lead.id);
});

test.after(async () => {
  const assignments = await prisma.assignment.findMany({ where: { leadId: { in: createdLeadIds } }, select: { id: true, droneId: true } });
  const assignmentIds = assignments.map((assignment) => assignment.id);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.drone.updateMany({ where: { id: { in: assignments.map((assignment) => assignment.droneId) } }, data: { status: 'AVAILABLE' } });
  await prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.outOfRangeAppeal.deleteMany({ where: { leadId: { in: createdLeadIds } } });
  await prisma.auditLog.deleteMany({ where: { entityType: 'Lead', entityId: { in: createdLeadIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
