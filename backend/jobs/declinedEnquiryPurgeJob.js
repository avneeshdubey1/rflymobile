const { purgeExpired } = require('../services/declinedEnquiryService');
const logger = require('../services/loggerService');

async function runOnce() {
  try {
    const result = await purgeExpired();
    if (result.count) logger.info('declined-enquiry.purged', { count: result.count });
    return result;
  } catch (error) {
    logger.error('declined-enquiry.purge-failed', { error: error.name });
    return null;
  }
}

function startDeclinedEnquiryPurgeJob(intervalMs) {
  void runOnce();
  return setInterval(() => { void runOnce(); }, intervalMs);
}

module.exports = { runOnce, startDeclinedEnquiryPurgeJob };
