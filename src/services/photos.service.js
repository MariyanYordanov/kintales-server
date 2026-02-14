import { eq, asc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { photos, relatives } from '../db/schema.js';
import { notFound, badRequest, forbidden } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { verifyMimeType } from '../utils/mimeVerify.js';
import { scanFileBuffer } from './virusScan.service.js';
import { uploadFile, getPresignedUrl, deleteFile, BUCKETS } from './storage.service.js';
import { sanitizePhoto } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Get all photos for a relative (with presigned URLs).
 * @param {string} relativeId
 * @param {string} userId - Requesting user ID
 * @returns {Promise<object[]>}
 */
export async function getRelativePhotos(relativeId, userId) {
  const [relative] = await db
    .select({ id: relatives.id, treeId: relatives.treeId })
    .from(relatives)
    .where(eq(relatives.id, relativeId))
    .limit(1);

  if (!relative) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(relative.treeId, userId, 'viewer');

  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.relativeId, relativeId))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));

  const results = await Promise.all(
    rows.map(async (photo) => {
      const url = await getPresignedUrl(BUCKETS.PHOTOS, photo.fileUrl);
      return sanitizePhoto(photo, url);
    }),
  );

  return results;
}

/**
 * Upload a single photo for a relative.
 * Pipeline: verifyTreeAccess → verifyMimeType → virusScan → MinIO → DB
 * @param {string} relativeId
 * @param {string} userId
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @param {{ caption?: string, dateTakenYear?: number, dateTakenMonth?: number, dateTakenDay?: number, sortOrder?: number }} metadata
 * @returns {Promise<object>}
 */
export async function uploadPhoto(relativeId, userId, fileBuffer, filename, metadata) {
  const [relative] = await db
    .select({ id: relatives.id, treeId: relatives.treeId })
    .from(relatives)
    .where(eq(relatives.id, relativeId))
    .limit(1);

  if (!relative) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(relative.treeId, userId, 'editor');

  // 1. Verify MIME type via magic bytes
  const { mime, ext } = await verifyMimeType(fileBuffer, PHOTO_MIME_TYPES, filename);

  // 2. Virus scan
  await scanFileBuffer(fileBuffer, filename);

  // 3. Upload to MinIO
  const objectKey = await uploadFile(BUCKETS.PHOTOS, fileBuffer, ext, mime);

  try {
    // 4. Insert into DB
    const [created] = await db
      .insert(photos)
      .values({
        relativeId,
        fileUrl: objectKey,
        caption: metadata.caption,
        dateTakenYear: metadata.dateTakenYear,
        dateTakenMonth: metadata.dateTakenMonth,
        dateTakenDay: metadata.dateTakenDay,
        sortOrder: metadata.sortOrder ?? 0,
        uploadedBy: userId,
      })
      .returning();

    logger.info('Photo uploaded', {
      photoId: created.id,
      relativeId,
      treeId: relative.treeId,
      userId,
    });

    const presignedUrl = await getPresignedUrl(BUCKETS.PHOTOS, created.fileUrl);
    return sanitizePhoto(created, presignedUrl);
  } catch (err) {
    // Rollback MinIO upload on DB failure
    await deleteFile(BUCKETS.PHOTOS, objectKey);
    throw err;
  }
}

/**
 * Upload multiple photos for a relative (bulk).
 * Pipeline per file: verifyMimeType → virusScan → MinIO → DB
 * On failure: rolls back ALL already uploaded files.
 * @param {string} relativeId
 * @param {string} userId
 * @param {{ buffer: Buffer, originalname: string }[]} files
 * @returns {Promise<object[]>}
 */
export async function uploadPhotoBulk(relativeId, userId, files) {
  const [relative] = await db
    .select({ id: relatives.id, treeId: relatives.treeId })
    .from(relatives)
    .where(eq(relatives.id, relativeId))
    .limit(1);

  if (!relative) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(relative.treeId, userId, 'editor');

  const uploadedKeys = [];

  try {
    // Phase 1: Validate + scan + upload to MinIO (all files)
    for (const file of files) {
      const { mime, ext } = await verifyMimeType(file.buffer, PHOTO_MIME_TYPES, file.originalname);
      await scanFileBuffer(file.buffer, file.originalname);
      const objectKey = await uploadFile(BUCKETS.PHOTOS, file.buffer, ext, mime);
      uploadedKeys.push(objectKey);
    }

    // Phase 2: Insert all records in a single transaction
    const created = await db.transaction(async (tx) => {
      const rows = [];
      for (const objectKey of uploadedKeys) {
        const [row] = await tx
          .insert(photos)
          .values({
            relativeId,
            fileUrl: objectKey,
            uploadedBy: userId,
          })
          .returning();
        rows.push(row);
      }
      return rows;
    });

    // Phase 3: Generate presigned URLs
    const results = await Promise.all(
      created.map(async (photo) => {
        const presignedUrl = await getPresignedUrl(BUCKETS.PHOTOS, photo.fileUrl);
        return sanitizePhoto(photo, presignedUrl);
      }),
    );

    logger.info('Bulk photo upload completed', {
      relativeId,
      treeId: relative.treeId,
      count: results.length,
      userId,
    });

    return results;
  } catch (err) {
    // Rollback ALL uploaded files on any failure
    await Promise.all(uploadedKeys.map((key) => deleteFile(BUCKETS.PHOTOS, key)));
    throw err;
  }
}

/**
 * Delete a photo.
 * Authorization: uploader OR tree owner.
 * @param {string} photoId
 * @param {string} userId
 */
export async function deletePhoto(photoId, userId) {
  const [photo] = await db
    .select({
      id: photos.id,
      fileUrl: photos.fileUrl,
      uploadedBy: photos.uploadedBy,
      relativeId: photos.relativeId,
      treeId: relatives.treeId,
    })
    .from(photos)
    .innerJoin(relatives, eq(photos.relativeId, relatives.id))
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo) {
    throw notFound('Photo');
  }

  // Authorization: uploader can delete their own, or tree owner can delete any
  if (photo.uploadedBy !== userId) {
    await verifyTreeAccess(photo.treeId, userId, 'owner');
  }

  await db.delete(photos).where(eq(photos.id, photoId));

  // Delete from MinIO (non-fatal)
  await deleteFile(BUCKETS.PHOTOS, photo.fileUrl);

  logger.info('Photo deleted', {
    photoId,
    relativeId: photo.relativeId,
    treeId: photo.treeId,
    userId,
  });
}
