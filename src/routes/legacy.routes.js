import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createLegacyKeySchema,
  redeemLegacyKeySchema,
  paramsWithLegacyKeyId,
} from './legacy.schemas.js';
import * as legacyService from '../services/legacy.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/legacy-keys — generate key (editor+, verified in service)
router.post('/', validate(createLegacyKeySchema), async (req, res, next) => {
  try {
    const key = await legacyService.createLegacyKey(
      req.user.userId,
      req.body,
    );
    res.status(201).json({ data: key });
  } catch (err) {
    next(err);
  }
});

// POST /api/legacy-keys/redeem — redeem key code (any authenticated user)
router.post('/redeem', validate(redeemLegacyKeySchema), async (req, res, next) => {
  try {
    const result = await legacyService.redeemLegacyKey(
      req.user.userId,
      req.user.email,
      req.body.keyCode,
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/legacy-keys/:id — revoke key (creator only, verified in service)
router.delete('/:id', validate(paramsWithLegacyKeyId), async (req, res, next) => {
  try {
    await legacyService.revokeLegacyKey(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
