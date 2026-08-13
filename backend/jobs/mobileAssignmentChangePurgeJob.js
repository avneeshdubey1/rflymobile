const prisma = require('../src/lib/prisma');
const heartbeat = require('../services/jobHeartbeatService');
const logger = require('../services/loggerService');

const RETENTION_DAYS = 30;

async function purgeExpired(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
  return prisma.mobileAssignmentChange.deleteMany({ where: { changedAt: { lt: cutoff } } });
}

function startMobileAssignmentChangePurgeJob() {
  const intervalMs = 24 * 60 * 60_000;
  const run = async () => {
    try {
      const result = await purgeExpired();
      heartbeat.record('mobile-assignment-change-purge', 'ok', { processed: result.count });
      if (result.count) logger.info('job.mobile_assignment_change_purge.completed', { processed: result.count });
    } catch (error) {
      heartbeat.record('mobile-assignment-change-purge', 'error');
      logger.error('job.mobile_assignment_change_purge.failed', { error: error.name });
    }
  };
  void run();
  return setInterval(() => { void run(); }, intervalMs);
}

module.exports = { RETENTION_DAYS, purgeExpired, startMobileAssignmentChangePurgeJob };
