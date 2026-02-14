import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { createUploadMiddleware, handleUploadError } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadAudioSchema, paramsWithAudioId } from './audio.schemas.js';
import { badRequest } from '../utils/errors.js';
import * as audioService from '../services/audio.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/audio — upload audio recording
router.post(
  '/',
  uploadLimiter,
  createUploadMiddleware('audio').single('audio'),
  handleUploadError,
  validate(uploadAudioSchema),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw badRequest('No file uploaded');
      }

      const audio = await audioService.uploadAudio(
        req.body.relativeId,
        req.user.userId,
        req.file.buffer,
        req.file.originalname,
        req.body.title,
      );

      res.status(201).json({ data: audio });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/audio/:id — delete audio recording
router.delete('/:id', validate(paramsWithAudioId), async (req, res, next) => {
  try {
    await audioService.deleteAudio(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
