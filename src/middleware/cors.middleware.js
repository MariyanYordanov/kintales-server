import cors from 'cors';
import { AppError } from '../utils/errors.js';

const allowedOrigins = (process.env.APP_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new AppError('Not allowed by CORS', 403, 'CORS_ERROR'));
    }
  },
  credentials: true,
});
