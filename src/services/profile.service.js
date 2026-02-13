import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { profiles } from '../db/schema.js';
import { notFound, badRequest } from '../utils/errors.js';
import { sanitizeProfile } from '../utils/sanitize.js';
import { scanFileBuffer } from './virusScan.service.js';
import { uploadFile, getPresignedUrl, deleteFile, BUCKETS } from './storage.service.js';
import logger from '../utils/logger.js';

/**
 * Get a user's profile with presigned avatar URL.
 * @param {string} userId - User ID from JWT
 * @returns {Promise<object>} Sanitized profile
 */
export async function getProfile(userId) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    throw notFound('Profile');
  }

  const presignedUrl = await getPresignedUrl(BUCKETS.AVATARS, profile.avatarUrl);
  return sanitizeProfile(profile, presignedUrl);
}

/**
 * Update profile text fields (fullName, bio, language).
 * @param {string} userId - User ID from JWT
 * @param {{ fullName?: string, bio?: string, language?: string }} updates
 * @returns {Promise<object>} Updated sanitized profile
 */
export async function updateProfile(userId, updates) {
  const updateData = {};
  if (updates.fullName !== undefined) updateData.fullName = updates.fullName;
  if (updates.bio !== undefined) updateData.bio = updates.bio;
  if (updates.language !== undefined) updateData.language = updates.language;

  const [updated] = await db
    .update(profiles)
    .set(updateData)
    .where(eq(profiles.id, userId))
    .returning();

  if (!updated) {
    throw notFound('Profile');
  }

  logger.info('Profile updated', { userId, fields: Object.keys(updateData) });

  const presignedUrl = await getPresignedUrl(BUCKETS.AVATARS, updated.avatarUrl);
  return sanitizeProfile(updated, presignedUrl);
}

/**
 * Upload and process an avatar image.
 * Flow: virus scan → sharp resize → MinIO upload → DB update → delete old.
 * If DB update fails, the newly uploaded file is rolled back (deleted).
 * @param {string} userId
 * @param {Buffer} fileBuffer
 * @param {string} originalFilename
 * @param {string} mimeType
 * @returns {Promise<object>} Updated sanitized profile
 */
export async function uploadAvatar(userId, fileBuffer, originalFilename, mimeType) {
  const [profile] = await db
    .select({ id: profiles.id, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    throw notFound('Profile');
  }

  // 1. Virus scan (before any processing — catches known malware early)
  await scanFileBuffer(fileBuffer, originalFilename);

  // 2. Resize to 400×400, convert to WebP (also sanitizes image metadata)
  let processedBuffer;
  try {
    processedBuffer = await sharp(fileBuffer)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    logger.error('Image processing failed', { userId, error: err.message });
    throw badRequest('Invalid image file');
  }

  if (!processedBuffer || processedBuffer.length === 0) {
    throw badRequest('Invalid image file');
  }

  // 3. Upload new avatar to MinIO
  const objectKey = await uploadFile(BUCKETS.AVATARS, processedBuffer, 'webp', 'image/webp');

  const oldAvatarKey = profile.avatarUrl;

  try {
    // 4. Update DB first (if this fails, we rollback the uploaded file)
    const [updated] = await db
      .update(profiles)
      .set({ avatarUrl: objectKey })
      .where(eq(profiles.id, userId))
      .returning();

    logger.info('Avatar uploaded', { userId, objectKey });

    // 5. Delete old avatar only after successful DB update
    if (oldAvatarKey) {
      await deleteFile(BUCKETS.AVATARS, oldAvatarKey);
    }

    const presignedUrl = await getPresignedUrl(BUCKETS.AVATARS, updated.avatarUrl);
    return sanitizeProfile(updated, presignedUrl);
  } catch (err) {
    // Rollback: delete newly uploaded file if DB update failed
    await deleteFile(BUCKETS.AVATARS, objectKey);
    throw err;
  }
}
