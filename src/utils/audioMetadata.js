import { parseBuffer } from 'music-metadata';
import logger from './logger.js';

/**
 * Extract audio duration from a file buffer.
 * Non-critical: returns null on failure (upload continues).
 * @param {Buffer} buffer - Audio file buffer
 * @param {string} mimeType - Detected MIME type
 * @returns {Promise<number|null>} Duration in seconds (rounded), or null
 */
export async function extractAudioDuration(buffer, mimeType) {
  try {
    const metadata = await parseBuffer(buffer, { mimeType });
    const duration = metadata?.format?.duration;

    if (typeof duration !== 'number' || !Number.isFinite(duration)) {
      return null;
    }

    return Math.round(duration);
  } catch (err) {
    logger.warn('Audio duration extraction failed (non-fatal)', {
      mimeType,
      error: err.message,
    });
    return null;
  }
}
