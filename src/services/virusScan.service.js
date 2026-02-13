import { Readable } from 'node:stream';
import NodeClam from 'clamscan';
import logger from '../utils/logger.js';
import { badRequest } from '../utils/errors.js';

let clamScanner = null;
let scannerInitialized = false;
let scannerAvailable = false;

/**
 * Initialize ClamAV scanner (lazy singleton).
 * Gracefully handles ClamAV being unavailable in development.
 */
async function initScanner() {
  if (scannerInitialized) return;
  scannerInitialized = true;

  const isDev = process.env.NODE_ENV !== 'production';

  try {
    clamScanner = await new NodeClam().init({
      clamdscan: {
        host: process.env.CLAMAV_HOST || 'localhost',
        port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
        timeout: parseInt(process.env.CLAMAV_SCAN_TIMEOUT || '60000', 10),
      },
      preference: 'clamdscan',
    });

    scannerAvailable = true;
    logger.info('ClamAV scanner initialized');
  } catch (err) {
    if (isDev) {
      logger.warn('ClamAV not available — virus scanning disabled (dev mode)', {
        error: err.message,
      });
    } else {
      throw new Error(`ClamAV required in production: ${err.message}`);
    }
  }
}

/**
 * Scan a file buffer for viruses.
 * In dev mode: skips scan if ClamAV is unavailable (logs warning).
 * In production: throws if ClamAV is unavailable.
 * @param {Buffer} buffer - File buffer to scan
 * @param {string} filename - Original filename (for logging)
 * @throws {AppError} If virus detected or scanner unavailable in production
 */
export async function scanFileBuffer(buffer, filename) {
  await initScanner();

  if (!scannerAvailable) {
    logger.warn('Skipping virus scan (ClamAV unavailable)', { filename });
    return;
  }

  try {
    const { isInfected, viruses } = await clamScanner.scanStream(
      Readable.from(buffer),
    );

    if (isInfected) {
      logger.warn('Virus detected in uploaded file', { filename, viruses });
      throw badRequest('File rejected: malware detected');
    }

    logger.debug('Virus scan passed', { filename, size: buffer.length });
  } catch (err) {
    if (err.isOperational) throw err;

    logger.error('Virus scan failed', { filename, error: err.message });
    throw badRequest('File scan failed, please try again');
  }
}
