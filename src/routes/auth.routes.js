import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import passport from 'passport';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  logoutSchema,
} from './auth.schemas.js';
import * as authService from '../services/auth.service.js';
import { badRequest } from '../utils/errors.js';
import logger from '../utils/logger.js';

const router = Router();

// Track whether Google OAuth is configured (avoids using private _strategy API)
let googleOAuthConfigured = false;

/**
 * Mark Google OAuth as configured. Called from passport.js after successful setup.
 */
export function setGoogleOAuthConfigured() {
  googleOAuthConfigured = true;
}

// Pending OAuth state tokens (in-memory, short-lived)
// In production, use Redis or DB for multi-instance deployments
const pendingOAuthStates = new Map();
const OAUTH_STATE_TTL = 5 * 60 * 1000; // 5 minutes

// All auth routes use the auth rate limiter (5 req/min)
router.use(authLimiter);

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, language, deviceInfo } = req.body;
    const result = await authService.registerUser({
      email,
      password,
      fullName,
      language,
      deviceInfo,
    });
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, deviceInfo } = req.body;
    const result = await authService.loginUser({ email, password, deviceInfo });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await authService.refreshAccessToken({
      refreshTokenRaw: req.body.refreshToken,
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      await authService.requestPasswordReset({ email: req.body.email });
      res.json({
        data: { message: 'If this email exists, a reset link has been sent.' },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword({ token, newPassword });
      res.json({ data: { message: 'Password reset successfully.' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/google — Initiate Google OAuth
router.get('/google', (req, res, next) => {
  if (!googleOAuthConfigured) {
    return next(badRequest('Google OAuth is not configured'));
  }

  // Generate CSRF state token
  const state = randomBytes(32).toString('hex');
  pendingOAuthStates.set(state, Date.now());

  passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email'],
    state,
  })(req, res, next);
});

// GET /api/auth/google/callback — Google OAuth callback
router.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleOAuthConfigured) {
      return next(badRequest('Google OAuth is not configured'));
    }
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/api/auth/google/failure',
    })(req, res, next);
  },
  async (req, res, next) => {
    try {
      // Validate CSRF state parameter
      const state = req.query.state;
      const stateTimestamp = pendingOAuthStates.get(state);
      pendingOAuthStates.delete(state);

      if (!stateTimestamp || Date.now() - stateTimestamp > OAUTH_STATE_TTL) {
        logger.warn('Invalid or expired OAuth state parameter');
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        return res.redirect(`${appUrl}/auth/callback?error=invalid_state`);
      }

      const { email, fullName, avatarUrl } = req.user;
      const deviceInfo = req.headers['user-agent'] || 'Google OAuth';
      const result = await authService.findOrCreateGoogleUser({
        email,
        fullName,
        avatarUrl,
        deviceInfo,
      });

      // Use URL fragment (#) instead of query params (?) to prevent
      // tokens from appearing in server logs, Referer headers, and browser history
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      res.redirect(`${appUrl}/auth/callback#${params}`);
    } catch (err) {
      logger.error('Google OAuth callback error', { error: err.message });
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      res.redirect(`${appUrl}/auth/callback?error=server_error`);
    }
  }
);

// GET /api/auth/google/failure — OAuth failure handler
router.get('/google/failure', (_req, res) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  res.redirect(`${appUrl}/auth/callback?error=oauth_failed`);
});

// POST /api/auth/logout
router.post('/logout', validate(logoutSchema), async (req, res, next) => {
  try {
    await authService.logoutUser({ refreshTokenRaw: req.body.refreshToken });
    res.json({ data: { message: 'Logged out successfully.' } });
  } catch (err) {
    next(err);
  }
});

// Cleanup expired state tokens periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [state, timestamp] of pendingOAuthStates) {
    if (now - timestamp > OAUTH_STATE_TTL) {
      pendingOAuthStates.delete(state);
    }
  }
}, 10 * 60 * 1000).unref();

export default router;
