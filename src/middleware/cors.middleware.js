import cors from 'cors';

const allowedOrigins = (process.env.APP_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
