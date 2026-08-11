const express = require('express');
const { loadEnvironment } = require('./config/environment');
const {
  corsPolicy,
  createRateLimiters,
  errorHandler,
  notFound,
  requestContext,
  requireHttps,
  requireJsonContentType,
  securityHeaders,
} = require('./middleware/httpSecurity');

function createApp({ config = loadEnvironment() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('config', config);
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

  app.use(requestContext);
  app.use(securityHeaders(config));
  app.use(requireHttps(config));
  app.use(corsPolicy(config));
  app.use(requireJsonContentType);

  const limits = createRateLimiters(config);
  app.use([
    '/api/auth/login',
    '/api/auth/farmer/request-otp',
    '/api/auth/farmer/resend-otp',
    '/api/auth/farmer/login',
    '/api/auth/farmer/complete-signup',
    '/api/auth/business/login',
  ], limits.login);
  app.use(['/api/auth/recovery', '/api/auth/business/recovery'], limits.recovery);
  app.use('/api/leads/ingest/website', limits.publicIntake);
  app.use('/api', limits.general);

  app.use(express.json({ limit: config.jsonBodyLimitBytes, strict: true }));

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/leads', require('./routes/leadRoutes'));
  app.use('/api/assignments', require('./routes/assignmentRoutes'));
  app.use('/api/auto-assignment-policy', require('./routes/autoAssignmentPolicyRoutes'));
  app.use('/api/chat', require('./routes/chatRoutes'));
  app.use('/api/audit-log', require('./routes/auditLogRoutes'));
  app.use('/api/health', require('./routes/healthRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/customers', require('./routes/customerRoutes'));
  app.use('/api/portal', require('./routes/portalRoutes'));
  app.use('/api/drones', require('./routes/droneRoutes'));
  app.use('/api/lmvs', require('./routes/lmvRoutes'));
  app.use('/api/system', require('./routes/systemRoutes'));
  app.use('/api/centers', require('./routes/centerRoutes'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
