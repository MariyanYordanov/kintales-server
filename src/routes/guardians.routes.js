import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createGuardianSchema, paramsWithGuardianId } from './guardians.schemas.js';
import * as guardianService from '../services/guardian.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/guardians — add guardian (owner only, verified in service)
router.post('/', validate(createGuardianSchema), async (req, res, next) => {
  try {
    const guardian = await guardianService.addGuardian(
      req.user.userId,
      req.body,
    );
    res.status(201).json({ data: guardian });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/guardians/:id — remove guardian (owner only, verified in service)
router.delete('/:id', validate(paramsWithGuardianId), async (req, res, next) => {
  try {
    await guardianService.removeGuardian(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
