import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paramsWithCommentId } from './comments.schemas.js';
import * as commentsService from '../services/comments.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// DELETE /api/comments/:id — delete comment (author only)
router.delete('/:id', validate(paramsWithCommentId), async (req, res, next) => {
  try {
    await commentsService.deleteComment(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
