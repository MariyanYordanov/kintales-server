import { fileTypeFromBuffer } from 'file-type';
import { badRequest } from './errors.js';
import logger from './logger.js';

/**
 * Verify file MIME type using magic bytes (not just the Content-Type header).
 * Must be called AFTER multer (buffer available), BEFORE virus scan.
 * @param {Buffer} buffer - File buffer
 * @param {string[]} allowedMimeTypes - e.g. ['image/jpeg', 'image/png', 'image/webp']
 * @param {string} filename - Original filename (for logging)
 * @returns {Promise<{ mime: string, ext: string }>}
 * @throws {AppError} 400 if MIME type is invalid or undetectable
 */
export async function verifyMimeType(buffer, allowedMimeTypes, filename) {
  const result = await fileTypeFromBuffer(buffer);

  if (!result) {
    logger.warn('MIME detection failed — could not determine file type', { filename });
    throw badRequest('Could not determine file type');
  }

  if (!allowedMimeTypes.includes(result.mime)) {
    logger.warn('MIME mismatch detected', {
      filename,
      detectedMime: result.mime,
      allowedTypes: allowedMimeTypes,
    });
    throw badRequest(`Invalid file format. Detected: ${result.mime}`);
  }

  return { mime: result.mime, ext: result.ext };
}
