import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { createUploadMiddleware, handleUploadError } from '../middleware/upload.middleware.js';
import { updateProfileSchema } from './profile.schemas.js';
import * as profileService from '../services/profile.service.js';
import { badRequest } from '../utils/errors.js';

const router = Router();
const avatarUpload = createUploadMiddleware('avatar');

// All profile routes require authentication
router.use(authenticate);

// GET /api/profile — current user's profile
router.get('/', async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.userId);
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile — update text fields (fullName, bio, language)
router.put('/', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const profile = await profileService.updateProfile(req.user.userId, req.body);
    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile/avatar — upload avatar (multipart/form-data, field: "avatar")
router.put(
  '/avatar',
  uploadLimiter,
  avatarUpload.single('avatar'),
  handleUploadError,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return next(badRequest('No file uploaded. Use field name "avatar"'));
      }

      const profile = await profileService.uploadAvatar(
        req.user.userId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      res.json({ data: profile });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
