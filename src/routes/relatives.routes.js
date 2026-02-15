import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createRelativeSchema,
  updateRelativeSchema,
  paramsWithRelativeId,
} from './relatives.schemas.js';
import * as relativesService from '../services/relatives.service.js';
import * as photosService from '../services/photos.service.js';
import * as audioService from '../services/audio.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/relatives — create relative (treeId in body, service checks editor+)
router.post('/', validate(createRelativeSchema), async (req, res, next) => {
  try {
    const relative = await relativesService.createRelative(req.body, req.user.userId);
    res.status(201).json({ data: relative });
  } catch (err) {
    next(err);
  }
});

// GET /api/relatives/:id — get relative detail (service checks tree access)
router.get('/:id', validate(paramsWithRelativeId), async (req, res, next) => {
  try {
    const relative = await relativesService.getRelativeById(req.params.id, req.user.userId);
    res.json({ data: relative });
  } catch (err) {
    next(err);
  }
});

// PUT /api/relatives/:id — update relative (service checks editor+)
router.put('/:id', validate(updateRelativeSchema), async (req, res, next) => {
  try {
    const relative = await relativesService.updateRelative(req.params.id, req.user.userId, req.body);
    res.json({ data: relative });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/relatives/:id — delete relative (service checks editor+)
router.delete('/:id', validate(paramsWithRelativeId), async (req, res, next) => {
  try {
    await relativesService.deleteRelative(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

// POST /api/relatives/:id/anonymize — replace name with "Роднина", remove avatar (editor+)
router.post('/:id/anonymize', validate(paramsWithRelativeId), async (req, res, next) => {
  try {
    const relative = await relativesService.anonymizeRelative(req.params.id, req.user.userId);
    res.json({ data: relative });
  } catch (err) {
    next(err);
  }
});

// GET /api/relatives/:id/photos — list photos for a relative
router.get('/:id/photos', validate(paramsWithRelativeId), async (req, res, next) => {
  try {
    const photos = await photosService.getRelativePhotos(req.params.id, req.user.userId);
    res.json({ data: photos });
  } catch (err) {
    next(err);
  }
});

// GET /api/relatives/:id/audio — list audio recordings for a relative
router.get('/:id/audio', validate(paramsWithRelativeId), async (req, res, next) => {
  try {
    const audio = await audioService.getRelativeAudio(req.params.id, req.user.userId);
    res.json({ data: audio });
  } catch (err) {
    next(err);
  }
});

export default router;
