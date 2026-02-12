import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { securityMiddleware } from './middleware/security.middleware.js';
import { corsMiddleware } from './middleware/cors.middleware.js';
import { globalLimiter } from './middleware/rateLimit.middleware.js';
import { AppError } from './utils/errors.js';
import logger from './utils/logger.js';

const app = express();
const server = createServer(app);

// === Middleware Chain (spec order) ===

// 1. Security headers (Helmet)
app.use(securityMiddleware);

// 2. CORS
app.use(corsMiddleware);

// 3. Rate limiting (global)
app.use(globalLimiter);

// 4. Body parser
app.use(express.json({ limit: '10mb' }));

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

export default app;
