import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireTreeRole } from '../middleware/treeAccess.middleware.js';
import { paramsWithId, updateTreeSchema } from './tree.schemas.js';
import { getEventsSchema } from './events.schemas.js';
import { getStoriesSchema } from './stories.schemas.js';
import * as treeService from '../services/tree.service.js';
import * as relativesService from '../services/relatives.service.js';
import * as deathService from '../services/death.service.js';
import * as eventsService from '../services/events.service.js';
import * as storiesService from '../services/stories.service.js';
import * as guardianService from '../services/guardian.service.js';
import * as legacyService from '../services/legacy.service.js';

const router = Router();

// All tree routes require authentication
router.use(authenticate);

// GET /api/trees — user's trees
router.get('/', async (req, res, next) => {
  try {
    const trees = await treeService.getUserTrees(req.user.userId);
    res.json({ data: trees });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id — tree details (any member)
router.get('/:id', validate(paramsWithId), requireTreeRole('viewer'), async (req, res, next) => {
  try {
    const tree = await treeService.getTreeById(req.params.id, req.treeMembership.role);
    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

// PUT /api/trees/:id — update tree name (owner only)
router.put('/:id', validate(updateTreeSchema), requireTreeRole('owner'), async (req, res, next) => {
  try {
    const tree = await treeService.updateTree(req.params.id, req.body);
    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id/relatives — all relatives in tree (any member)
router.get('/:id/relatives', validate(paramsWithId), requireTreeRole('viewer'), async (req, res, next) => {
  try {
    const relatives = await relativesService.getTreeRelatives(req.params.id);
    res.json({ data: relatives });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id/events — events for tree (any member)
router.get('/:id/events', validate(getEventsSchema), requireTreeRole('viewer'), async (req, res, next) => {
  try {
    const events = await eventsService.getTreeEvents(req.params.id, req.query.from, req.query.to);
    res.json({ data: events });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id/stories — paginated stories (any member)
router.get('/:id/stories', validate(getStoriesSchema), requireTreeRole('viewer'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await storiesService.getTreeStories(req.params.id, page, limit);
    res.json({ data: result.stories, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id/death-records — death records for tree (any member)
router.get('/:id/death-records', validate(paramsWithId), requireTreeRole('viewer'), async (req, res, next) => {
  try {
    const records = await deathService.getTreeDeathRecords(req.params.id, req.user.userId);
    res.json({ data: records });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id/guardians — list guardians (owner only)
router.get('/:id/guardians', validate(paramsWithId), requireTreeRole('owner'), async (req, res, next) => {
  try {
    const guardians = await guardianService.getTreeGuardians(req.params.id);
    res.json({ data: guardians });
  } catch (err) {
    next(err);
  }
});

// GET /api/trees/:id/legacy-keys — list legacy keys (editor+)
router.get('/:id/legacy-keys', validate(paramsWithId), requireTreeRole('editor'), async (req, res, next) => {
  try {
    const keys = await legacyService.getTreeLegacyKeys(req.params.id);
    res.json({ data: keys });
  } catch (err) {
    next(err);
  }
});

export default router;
