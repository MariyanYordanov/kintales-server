import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { createUploadMiddleware, handleUploadError } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createStorySchema, updateStorySchema, paramsWithStoryId } from './stories.schemas.js';
import { badRequest } from '../utils/errors.js';
import * as storiesService from '../services/stories.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/stories — create story with optional attachments
router.post(
  '/',
  uploadLimiter,
  createUploadMiddleware('storyAttachment', 10).array('attachments', 10),
  handleUploadError,
  validate(createStorySchema),
  async (req, res, next) => {
    try {
      const { treeId, relativeId, content } = req.body;
      const files = req.files || [];

      const story = await storiesService.createStory(
        treeId,
        req.user.userId,
        { content, relativeId },
        files,
      );

      res.status(201).json({ data: story });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/stories/:id — story detail with attachments
router.get('/:id', validate(paramsWithStoryId), async (req, res, next) => {
  try {
    const story = await storiesService.getStoryById(req.params.id, req.user.userId);
    res.json({ data: story });
  } catch (err) {
    next(err);
  }
});

// PUT /api/stories/:id — update story (author only)
router.put('/:id', validate(updateStorySchema), async (req, res, next) => {
  try {
    const story = await storiesService.updateStory(
      req.params.id,
      req.user.userId,
      req.body,
    );
    res.json({ data: story });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/stories/:id — delete story (author only)
router.delete('/:id', validate(paramsWithStoryId), async (req, res, next) => {
  try {
    await storiesService.deleteStory(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
