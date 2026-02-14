import multer from 'multer';
import { badRequest } from '../utils/errors.js';

const ALLOWED_TYPES = {
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'],
};

const SIZE_LIMITS = {
  avatar: 2 * 1024 * 1024,   // 2 MB
  photo: 5 * 1024 * 1024,    // 5 MB
  audio: 20 * 1024 * 1024,   // 20 MB
};

/**
 * Create a multer upload middleware for a specific file type.
 * Uses memory storage (buffer available via req.file.buffer).
 * @param {'avatar'|'photo'|'audio'} type
 * @param {number} [maxFiles=1] - Max number of files (>1 uses .array())
 * @returns {import('multer').Multer}
 */
export function createUploadMiddleware(type, maxFiles = 1) {
  const allowedTypes = ALLOWED_TYPES[type];
  const sizeLimit = SIZE_LIMITS[type];

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: sizeLimit,
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(
          badRequest(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`),
          false,
        );
      }
      cb(null, true);
    },
  });
}

/**
 * Multer error handler — converts multer errors to AppError format.
 * Must be placed AFTER the multer middleware in the chain.
 */
export function handleUploadError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(badRequest('File is too large'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(badRequest('Unexpected file field'));
    }
    return next(badRequest(`Upload error: ${err.message}`));
  }
  next(err);
}
