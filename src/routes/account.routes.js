import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { destructiveLimiter } from '../middleware/rateLimit.middleware.js';
import { deleteAccountSchema } from './account.schemas.js';
import * as accountService from '../services/account.service.js';

const router = Router();

// All account routes require authentication
router.use(authenticate);

// DELETE /api/account — GDPR: anonymize account + remove personal data
// Requires body: { confirmation: "DELETE_MY_ACCOUNT" }
router.delete('/', destructiveLimiter, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    await accountService.deleteAccount(req.user.userId);
    res.json({ data: { message: 'Account deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

export default router;
