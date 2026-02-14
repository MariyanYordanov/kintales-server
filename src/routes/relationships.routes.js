import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createRelationshipSchema,
  paramsWithRelationshipId,
} from './relationships.schemas.js';
import * as relationshipsService from '../services/relationships.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/relationships — create relationship (treeId in body, service checks editor+)
router.post('/', validate(createRelationshipSchema), async (req, res, next) => {
  try {
    const relationship = await relationshipsService.createRelationship(req.body, req.user.userId);
    res.status(201).json({ data: relationship });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/relationships/:id — delete relationship (service checks editor+)
router.delete('/:id', validate(paramsWithRelationshipId), async (req, res, next) => {
  try {
    await relationshipsService.deleteRelationship(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
