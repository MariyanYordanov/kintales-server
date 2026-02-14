import { eq, asc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { audioRecordings, relatives } from '../db/schema.js';
import { notFound, forbidden } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { verifyMimeType } from '../utils/mimeVerify.js';
import { extractAudioDuration } from '../utils/audioMetadata.js';
import { scanFileBuffer } from './virusScan.service.js';
import { uploadFile, getPresignedUrl, deleteFile, BUCKETS } from './storage.service.js';
import { sanitizeAudio } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'];

/**
 * Get all audio recordings for a relative (with presigned URLs).
 * @param {string} relativeId
 * @param {string} userId - Requesting user ID
 * @returns {Promise<object[]>}
 */
export async function getRelativeAudio(relativeId, userId) {
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
    .from(audioRecordings)
    .where(eq(audioRecordings.relativeId, relativeId))
    .orderBy(asc(audioRecordings.createdAt));

  const results = await Promise.all(
    rows.map(async (audio) => {
      const url = await getPresignedUrl(BUCKETS.AUDIO, audio.fileUrl);
      return sanitizeAudio(audio, url);
    }),
  );

  return results;
}

/**
 * Upload an audio recording for a relative.
 * Pipeline: verifyTreeAccess → verifyMimeType → virusScan → extractDuration → MinIO → DB
 * @param {string} relativeId
 * @param {string} userId
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @param {string} [title]
 * @returns {Promise<object>}
 */
export async function uploadAudio(relativeId, userId, fileBuffer, filename, title) {
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
  const { mime, ext } = await verifyMimeType(fileBuffer, AUDIO_MIME_TYPES, filename);

  // 2. Virus scan
  await scanFileBuffer(fileBuffer, filename);

  // 3. Extract duration (non-critical — null on failure)
  const durationSeconds = await extractAudioDuration(fileBuffer, mime);

  // 4. Upload to MinIO
  const objectKey = await uploadFile(BUCKETS.AUDIO, fileBuffer, ext, mime);

  try {
    // 5. Insert into DB
    const [created] = await db
      .insert(audioRecordings)
      .values({
        relativeId,
        title: title || null,
        fileUrl: objectKey,
        durationSeconds,
        uploadedBy: userId,
      })
      .returning();

    logger.info('Audio uploaded', {
      audioId: created.id,
      relativeId,
      treeId: relative.treeId,
      durationSeconds,
      userId,
    });

    const presignedUrl = await getPresignedUrl(BUCKETS.AUDIO, created.fileUrl);
    return sanitizeAudio(created, presignedUrl);
  } catch (err) {
    // Rollback MinIO upload on DB failure
    await deleteFile(BUCKETS.AUDIO, objectKey);
    throw err;
  }
}

/**
 * Delete an audio recording.
 * Authorization: uploader OR tree owner.
 * @param {string} audioId
 * @param {string} userId
 */
export async function deleteAudio(audioId, userId) {
  const [audio] = await db
    .select({
      id: audioRecordings.id,
      fileUrl: audioRecordings.fileUrl,
      uploadedBy: audioRecordings.uploadedBy,
      relativeId: audioRecordings.relativeId,
      treeId: relatives.treeId,
    })
    .from(audioRecordings)
    .innerJoin(relatives, eq(audioRecordings.relativeId, relatives.id))
    .where(eq(audioRecordings.id, audioId))
    .limit(1);

  if (!audio) {
    throw notFound('Audio recording');
  }

  // Authorization: uploader can delete their own, or tree owner can delete any
  if (audio.uploadedBy !== userId) {
    await verifyTreeAccess(audio.treeId, userId, 'owner');
  }

  await db.delete(audioRecordings).where(eq(audioRecordings.id, audioId));

  // Delete from MinIO (non-fatal)
  await deleteFile(BUCKETS.AUDIO, audio.fileUrl);

  logger.info('Audio deleted', {
    audioId,
    relativeId: audio.relativeId,
    treeId: audio.treeId,
    userId,
  });
}
