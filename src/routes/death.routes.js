import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { reportDeathSchema, confirmDeathSchema } from './death.schemas.js';
import * as deathService from '../services/death.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/death-records — report a death (editor+)
router.post('/', validate(reportDeathSchema), async (req, res, next) => {
  try {
    const record = await deathService.reportDeath(req.body, req.user.userId);
    res.status(201).json({ data: record });
  } catch (err) {
    next(err);
  }
});

// POST /api/death-records/:id/confirm — confirm or dispute
router.post('/:id/confirm', validate(confirmDeathSchema), async (req, res, next) => {
  try {
    const record = await deathService.confirmDeath(
      req.params.id,
      req.user.userId,
      req.body.confirmed,
    );
    res.json({ data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
