import { app } from './app.js';
import { appConfig } from './config/app.config.js';
import { logger } from './utils/logger.js';

const server = app.listen(appConfig.port, () => {
  logger.info(`🚀 DMeet DaaS Backend running on http://localhost:${appConfig.port}`);
  logger.info(`   Environment: ${appConfig.env}`);
  logger.info(`   CORS origins: ${appConfig.cors.origins.join(', ')}`);
  logger.info(`   Health check: http://localhost:${appConfig.port}/health`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled error safety nets
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
