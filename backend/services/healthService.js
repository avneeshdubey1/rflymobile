const systemRepository = require('../src/repositories/systemRepository');
const jobHeartbeatService = require('./jobHeartbeatService');

async function getHealth() {
  try {
    await systemRepository.healthCheck();
    return { status: 'ok', database: 'ok', jobs: jobHeartbeatService.getAll(), checkedAt: new Date().toISOString() };
  } catch {
    return { status: 'degraded', database: 'unavailable', jobs: jobHeartbeatService.getAll(), checkedAt: new Date().toISOString() };
  }
}

module.exports = { getHealth };
