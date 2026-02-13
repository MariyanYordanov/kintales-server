import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  profiles,
  refreshTokens,
  familyTrees,
  treeMembers,
} from '../db/schema.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from '../utils/tokens.js';
import { unauthorized, conflict } from '../utils/errors.js';
import { sanitizeProfile } from '../utils/sanitize.js';
import { sendPasswordResetEmail } from './email.service.js';
import logger from '../utils/logger.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

/**
 * Create a profile + family tree + tree membership in a transaction.
 * Shared by registerUser and findOrCreateGoogleUser.
 * @param {object} tx - Drizzle transaction
 * @param {{ email: string, passwordHash?: string, fullName: string, avatarUrl?: string, language?: string }} data
 * @returns {Promise<object>} the created profile
 */
async function createUserWithTree(tx, { email, passwordHash, fullName, avatarUrl, language }) {
  const [newProfile] = await tx
    .insert(profiles)
    .values({
      email,
      passwordHash: passwordHash || null,
      fullName,
      avatarUrl: avatarUrl || null,
      language: language || 'bg',
    })
    .returning();

  const [newTree] = await tx
    .insert(familyTrees)
    .values({
      name: `Семейство на ${fullName}`,
      ownerId: newProfile.id,
    })
    .returning();

  await tx.insert(treeMembers).values({
    treeId: newTree.id,
    userId: newProfile.id,
    role: 'owner',
  });

  return newProfile;
}

/**
 * Create an access + refresh token pair, store refresh hash in DB.
 * @param {string} userId
 * @param {string} email
 * @param {string} [deviceInfo]
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function createTokenPair(userId, email, deviceInfo) {
  const accessToken = generateAccessToken({ userId, email });
  const { raw, hash } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hash,
    deviceInfo: deviceInfo || null,
    expiresAt: getRefreshTokenExpiry(),
  });

  return { accessToken, refreshToken: raw };
}

// ---------- Public API ----------

/**
 * Register a new user: create profile + default family tree + membership.
 */
export async function registerUser({ email, password, fullName, language, deviceInfo }) {
  // Check email uniqueness (early check; DB UNIQUE is the final safeguard)
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw conflict('Email already registered');
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  const result = await db.transaction(async (tx) => {
    return createUserWithTree(tx, { email, passwordHash, fullName, language });
  });

  const tokens = await createTokenPair(result.id, result.email, deviceInfo);

  return {
    user: sanitizeProfile(result),
    ...tokens,
  };
}

/**
 * Log in an existing user with email + password.
 */
export async function loginUser({ email, password, deviceInfo }) {
  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (!user) {
    throw unauthorized('Invalid email or password');
  }

  // OAuth-only users have no passwordHash — use the same generic error
  if (!user.passwordHash) {
    throw unauthorized('Invalid email or password');
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw unauthorized('Invalid email or password');
  }

  // Update last login
  await db
    .update(profiles)
    .set({ lastLoginAt: new Date() })
    .where(eq(profiles.id, user.id));

  const tokens = await createTokenPair(user.id, user.email, deviceInfo);

  return {
    user: sanitizeProfile(user),
    ...tokens,
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * Uses atomic DELETE ... RETURNING to prevent race conditions.
 * Rotates the refresh token on each use.
 */
export async function refreshAccessToken({ refreshTokenRaw }) {
  const tokenHash = hashToken(refreshTokenRaw);

  // Atomic: delete and return the token in one query (prevents TOCTOU race)
  const [consumed] = await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .returning();

  if (!consumed) {
    throw unauthorized('Invalid refresh token');
  }

  // Check expiry
  if (new Date() > consumed.expiresAt) {
    throw unauthorized('Refresh token expired');
  }

  // Look up user for the new access token
  const [user] = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, consumed.userId))
    .limit(1);

  if (!user) {
    throw unauthorized('User not found');
  }

  const tokens = await createTokenPair(user.id, user.email, consumed.deviceInfo);

  return tokens;
}

/**
 * Request a password reset email. Always succeeds (prevents email enumeration).
 */
export async function requestPasswordReset({ email }) {
  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (!user) {
    logger.debug('Password reset requested for non-existent email', { email });
    return;
  }

  if (!user.passwordHash) {
    logger.debug('Password reset requested for OAuth-only account', { email });
    return;
  }

  const resetToken = generatePasswordResetToken({
    userId: user.id,
    email: user.email,
    currentPasswordHash: user.passwordHash,
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/auth/reset-password?token=${resetToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
    fullName: user.fullName,
  });
}

/**
 * Reset a user's password using a valid reset token.
 * Revokes ALL refresh tokens (force re-login on all devices).
 */
export async function resetPassword({ token, newPassword }) {
  // Decode without verifying to extract userId
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.userId) {
    throw unauthorized('Invalid reset token');
  }

  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, decoded.userId))
    .limit(1);

  if (!user || !user.passwordHash) {
    throw unauthorized('Invalid reset token');
  }

  // Verify with the user's current password hash (self-invalidating)
  verifyPasswordResetToken(token, user.passwordHash);

  const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ passwordHash: newHash })
      .where(eq(profiles.id, user.id));

    // Revoke all sessions
    await tx
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, user.id));
  });

  logger.info('Password reset completed', { userId: user.id });
}

/**
 * Find or create a user from Google OAuth profile.
 */
export async function findOrCreateGoogleUser({ email, fullName, avatarUrl, deviceInfo }) {
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  const user = existing ?? await db.transaction(async (tx) => {
    return createUserWithTree(tx, { email, fullName, avatarUrl });
  });

  if (existing && avatarUrl && avatarUrl !== existing.avatarUrl) {
    await db
      .update(profiles)
      .set({ avatarUrl })
      .where(eq(profiles.id, user.id));
  }

  // Update last login
  await db
    .update(profiles)
    .set({ lastLoginAt: new Date() })
    .where(eq(profiles.id, user.id));

  const tokens = await createTokenPair(user.id, user.email, deviceInfo);

  return {
    user: sanitizeProfile(user),
    ...tokens,
  };
}

/**
 * Logout: delete the specific refresh token. Always succeeds.
 */
export async function logoutUser({ refreshTokenRaw }) {
  const tokenHash = hashToken(refreshTokenRaw);
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));
}
