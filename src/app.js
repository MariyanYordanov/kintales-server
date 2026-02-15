import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import passport from 'passport';
import { securityMiddleware } from './middleware/security.middleware.js';
import { corsMiddleware, allowedOrigins } from './middleware/cors.middleware.js';
import { globalLimiter } from './middleware/rateLimit.middleware.js';
import { configurePassport } from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import treeRoutes from './routes/tree.routes.js';
import relativesRoutes from './routes/relatives.routes.js';
import relationshipsRoutes from './routes/relationships.routes.js';
import photosRoutes from './routes/photos.routes.js';
import audioRoutes from './routes/audio.routes.js';
import deathRoutes from './routes/death.routes.js';
import storiesRoutes from './routes/stories.routes.js';
import commentsRoutes from './routes/comments.routes.js';
import guardiansRoutes from './routes/guardians.routes.js';
import legacyRoutes from './routes/legacy.routes.js';
import accountRoutes from './routes/account.routes.js';
import { initSocketIO } from './websocket/io.js';
import { setupCommentHandlers } from './websocket/comments.ws.js';
import { AppError } from './utils/errors.js';
import logger from './utils/logger.js';
import { pool } from './config/database.js';
import { startScheduler } from './jobs/scheduler.js';

const app = express();
const server = createServer(app);

// === WebSocket (Socket.io) ===
const io = initSocketIO(server, allowedOrigins);
setupCommentHandlers(io);

// Trust first proxy (Nginx) — required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// === Middleware Chain (spec order) ===

// 1. Security headers (Helmet)
app.use(securityMiddleware);

// 2. CORS
app.use(corsMiddleware);

// 3. Rate limiting (global)
app.use(globalLimiter);

// 4. Body parser
app.use(express.json({ limit: '2mb' }));

// 5. Passport initialization (JWT only, no sessions)
configurePassport();
app.use(passport.initialize());

// === Routes ===

// Health check (for Docker healthcheck + monitoring)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API root
app.get('/api', (_req, res) => {
  res.json({ message: 'KinTales API v0.1.0' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Tree routes (Feature 2.1)
app.use('/api/trees', treeRoutes);
app.use('/api/relatives', relativesRoutes);
app.use('/api/relationships', relationshipsRoutes);

// Media routes (Feature 2.2)
app.use('/api/photos', photosRoutes);
app.use('/api/audio', audioRoutes);

// Death records (Feature 2.3)
app.use('/api/death-records', deathRoutes);

// Stories (Feature 3.2)
app.use('/api/stories', storiesRoutes);

// Comments (Feature 3.3)
app.use('/api/comments', commentsRoutes);

// Guardians + Legacy Keys (Feature 3.4)
app.use('/api/guardians', guardiansRoutes);
app.use('/api/legacy-keys', legacyRoutes);

// Account (GDPR — Feature 3.5)
app.use('/api/account', accountRoutes);

// 404 handler
app.use((_req, _res, next) => {
  next(new AppError('Route not found', 404, 'ROUTE_NOT_FOUND'));
});

// Error handler
app.use((err, _req, res, _next) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.errors && { errors: err.errors }),
      },
    });
  } else {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    });
  }
});

// === Start Server ===
const PORT = process.env.API_PORT || 3000;

server.listen(PORT, () => {
  logger.info(`KinTales API listening on port ${PORT}`);
  startScheduler();
});

// === Graceful Shutdown ===
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

export default app;
