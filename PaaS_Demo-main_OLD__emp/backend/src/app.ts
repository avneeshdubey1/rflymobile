import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { appConfig } from './config/app.config.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';

// Module routers
import { authRouter } from './modules/auth/auth.router.js';
import { requestsRouter } from './modules/requests/requests.router.js';
import { pilotsRouter } from './modules/pilots/pilots.router.js';
import { assignmentsRouter } from './modules/assignments/assignments.router.js';
import { approvalRouter } from './modules/approval/approval.router.js';
import { paymentsRouter } from './modules/payments/payments.router.js';
import { trackerRouter } from './modules/tracker/tracker.router.js';
import { financeRouter } from './modules/finance/finance.router.js';
import { notificationsRouter } from './modules/notifications/notifications.router.js';
import { analyticsRouter } from './modules/analytics/analytics.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { appDataRouter } from './modules/app-data/app-data.router.js';
import { settingsRouter } from './modules/settings/settings.router.js';
import { ApiResponse } from './utils/ApiResponse.js';

const app = express();

// ─── Security Middleware ─────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: appConfig.cors.origins,
  credentials: appConfig.cors.credentials,
}));

// ─── Body Parsing ────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ─────────────────────────────────────
app.use(requestLogger);

// ─── Health Check ────────────────────────────────────────
app.get('/health', (_req, res) => {
  ApiResponse.success(res, { status: 'ok', uptime: process.uptime() });
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/pilots', pilotsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/approval', approvalRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/tracker', trackerRouter);
app.use('/api/finance', financeRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/app-data', appDataRouter);
app.use('/api/settings', settingsRouter);

// ─── Error Handling ──────────────────────────────────────
app.use('/api/*splat', notFoundHandler);
app.use(errorHandler);

export { app };
