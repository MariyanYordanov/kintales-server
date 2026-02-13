import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { unauthorized } from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

const JWT_ALGORITHM = 'HS256';

// Fail fast if JWT_SECRET is missing or is the placeholder value
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (JWT_SECRET === 'change_me_random_64_chars') {
  throw new Error('JWT_SECRET must be changed from the default placeholder value');
}

/**
 * Generate a short-lived access token (JWT).
 * @param {{ userId: string, email: string }} payload
 * @returns {string}
 */
export function generateAccessToken({ userId, email }) {
  return jwt.sign({ userId, email }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_ACCESS_EXPIRY,
  });
}

/**
 * Verify an access token and return the payload.
 * @param {string} token
 * @returns {{ userId: string, email: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
    if (!payload.userId || !payload.email) {
      throw unauthorized('Invalid token payload');
    }
    return { userId: payload.userId, email: payload.email, iat: payload.iat, exp: payload.exp };
  } catch (err) {
    if (err.isOperational) throw err;
    throw unauthorized('Invalid or expired token');
  }
}

/**
 * Generate a random refresh token.
 * @returns {{ raw: string, hash: string }}
 */
export function generateRefreshToken() {
  const raw = randomBytes(64).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * SHA-256 hash a token string.
 * @param {string} raw
 * @returns {string}
 */
export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Parse a duration string like '7d', '15m', '1h' into milliseconds.
 * @param {string} duration
 * @returns {number}
 */
export function parseDuration(duration) {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };

  return value * multipliers[unit];
}

/**
 * Calculate refresh token expiry date.
 * @returns {Date}
 */
export function getRefreshTokenExpiry() {
  return new Date(Date.now() + parseDuration(JWT_REFRESH_EXPIRY));
}

/**
 * Generate a password-reset JWT, signed with JWT_SECRET + currentPasswordHash.
 * Self-invalidating: changing the password invalidates all outstanding tokens.
 * @param {{ userId: string, email: string, currentPasswordHash: string }} params
 * @returns {string}
 */
export function generatePasswordResetToken({ userId, email, currentPasswordHash }) {
  const secret = JWT_SECRET + currentPasswordHash;
  return jwt.sign({ userId, email, purpose: 'password-reset' }, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '15m',
  });
}

/**
 * Verify a password-reset JWT.
 * @param {string} token
 * @param {string} currentPasswordHash
 * @returns {{ userId: string, email: string }}
 */
export function verifyPasswordResetToken(token, currentPasswordHash) {
  try {
    const secret = JWT_SECRET + currentPasswordHash;
    const payload = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    });
    if (payload.purpose !== 'password-reset') {
      throw unauthorized('Invalid reset token');
    }
    return { userId: payload.userId, email: payload.email };
  } catch (err) {
    if (err.isOperational) throw err;
    throw unauthorized('Invalid or expired reset token');
  }
}
