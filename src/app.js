import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { securityMiddleware } from './middleware/security.middleware.js';
import { corsMiddleware } from './middleware/cors.middleware.js';
import { globalLimiter } from './middleware/rateLimit.middleware.js';
import { AppError } from './utils/errors.js';
import logger from './utils/logger.js';
import { pool } from './config/database.js';

const app = express();
const server = createServer(app);

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

// === Routes ===

// Health check (for Docker healthcheck + monitoring)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API root
app.get('/api', (_req, res) => {
  res.json({ message: 'KinTales API v0.1.0' });
});

// TODO: Mount route modules in Feature 1.1+
// app.use('/api/auth', authRoutes);
// app.use('/api/trees', treeRoutes);
// ...

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
