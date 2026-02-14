import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { createUploadMiddleware, handleUploadError } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadPhotoSchema, uploadPhotoBulkSchema, paramsWithPhotoId } from './photos.schemas.js';
import { badRequest } from '../utils/errors.js';
import * as photosService from '../services/photos.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/photos — upload single photo
router.post(
  '/',
  uploadLimiter,
  createUploadMiddleware('photo').single('photo'),
  handleUploadError,
  validate(uploadPhotoSchema),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw badRequest('No file uploaded');
      }

      const { relativeId, ...metadata } = req.body;
      const photo = await photosService.uploadPhoto(
        relativeId,
        req.user.userId,
        req.file.buffer,
        req.file.originalname,
        metadata,
      );

      res.status(201).json({ data: photo });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/photos/bulk — upload multiple photos (max 10)
router.post(
  '/bulk',
  uploadLimiter,
  createUploadMiddleware('photo', 10).array('photos', 10),
  handleUploadError,
  validate(uploadPhotoBulkSchema),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        throw badRequest('No files uploaded');
      }

      const photos = await photosService.uploadPhotoBulk(
        req.body.relativeId,
        req.user.userId,
        req.files,
      );

      res.status(201).json({ data: photos });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/photos/:id — delete photo
router.delete('/:id', validate(paramsWithPhotoId), async (req, res, next) => {
  try {
    await photosService.deletePhoto(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
