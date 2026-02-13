import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized } from '../utils/errors.js';

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches { userId, email } to req.user.
 */
export const authenticate = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Missing or invalid authorization header'));
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid token is present, otherwise continues without it.
 * Throws only if the header is present but the token is invalid.
 */
export const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
};
