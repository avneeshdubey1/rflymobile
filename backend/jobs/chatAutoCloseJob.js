const { closeInactiveSessions } = require('../services/chatLifecycleService');
const logger = require('../services/loggerService');
const heartbeat = require('../services/jobHeartbeatService');

function intervalMs() {
  const configured = Number(process.env.CHAT_AUTO_CLOSE_INTERVAL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 60_000;
}

async function runChatAutoCloseJob() {
  const closed = await closeInactiveSessions();
  heartbeat.record('chat-auto-close', 'ok', { closed: closed.length });
  logger.info('job.chat_auto_close.completed', { closed: closed.length });
  return closed;
}

function startChatAutoCloseJob() {
  const run = async () => { try { await runChatAutoCloseJob(); } catch (error) { heartbeat.record('chat-auto-close', 'error'); logger.error('job.chat_auto_close.failed', { message: error.message }); } };
  void run();
  const timer = setInterval(() => { void run(); }, intervalMs());
  return timer;
}

module.exports = { intervalMs, runChatAutoCloseJob, startChatAutoCloseJob };
