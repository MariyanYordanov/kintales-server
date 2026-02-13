import { randomUUID } from 'node:crypto';
import { minioClient, BUCKETS } from '../config/minio.js';
import logger from '../utils/logger.js';
import { internalError } from '../utils/errors.js';

const PRESIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Ensure a bucket exists, creating it if necessary.
 * Memoizes per bucket name so we only check once per process.
 * @param {string} bucket
 */
const ensuredBuckets = new Set();

async function ensureBucket(bucket) {
  if (ensuredBuckets.has(bucket)) return;

  try {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      logger.info('MinIO bucket created', { bucket });
    }
    ensuredBuckets.add(bucket);
  } catch (err) {
    logger.error('Failed to ensure MinIO bucket', { bucket, error: err.message });
    throw internalError('Storage initialization failed');
  }
}

/**
 * Upload a file buffer to MinIO.
 * @param {string} bucket - Bucket name (from BUCKETS constant)
 * @param {Buffer} buffer - File buffer
 * @param {string} extension - File extension (e.g. 'webp', 'jpg')
 * @param {string} mimeType - MIME type
 * @returns {Promise<string>} Object key (path in MinIO)
 */
export async function uploadFile(bucket, buffer, extension, mimeType) {
  await ensureBucket(bucket);

  const objectKey = `${randomUUID()}.${extension}`;

  try {
    await minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    logger.debug('File uploaded to MinIO', { bucket, objectKey, size: buffer.length });
    return objectKey;
  } catch (err) {
    logger.error('MinIO upload failed', { bucket, error: err.message });
    throw internalError('File upload failed');
  }
}

/**
 * Generate a presigned URL for reading a file.
 * @param {string} bucket - Bucket name
 * @param {string} objectKey - Object key (path)
 * @returns {Promise<string|null>} Presigned URL, or null if objectKey is falsy
 */
export async function getPresignedUrl(bucket, objectKey) {
  if (!objectKey) return null;

  try {
    return await minioClient.presignedGetObject(bucket, objectKey, PRESIGNED_URL_EXPIRY);
  } catch (err) {
    logger.error('Failed to generate presigned URL', { bucket, objectKey, error: err.message });
    return null;
  }
}

/**
 * Delete a file from MinIO. Never throws — logs errors and continues.
 * @param {string} bucket - Bucket name
 * @param {string} objectKey - Object key
 */
export async function deleteFile(bucket, objectKey) {
  if (!objectKey) return;

  try {
    await minioClient.removeObject(bucket, objectKey);
    logger.debug('File deleted from MinIO', { bucket, objectKey });
  } catch (err) {
    logger.error('MinIO delete failed (non-fatal)', { bucket, objectKey, error: err.message });
  }
}

export { BUCKETS };
