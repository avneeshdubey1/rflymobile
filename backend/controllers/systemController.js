const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const logger = require('../services/loggerService');

const run = promisify(execFile);

exports.seedData = async (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Database seeding is disabled in production' });
  try {
    await run(process.execPath, [path.join(__dirname, '../prisma/seed.js')], { timeout: 60_000 });
    logger.warn('system.database_seeded', { environment: process.env.NODE_ENV || 'development' });
    res.json({ success: true, message: 'Development database reset and seeded from Prisma data.' });
  } catch (error) {
    logger.error('system.database_seed_failed', { message: error.message });
    res.status(500).json({ error: 'Development database seed failed' });
  }
};
