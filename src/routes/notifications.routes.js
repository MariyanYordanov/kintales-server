import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import {
  registerPushTokenSchema,
  removePushTokenSchema,
  getNotificationsSchema,
  markReadSchema,
} from './notifications.schemas.js';
import * as pushService from '../services/push.service.js';
import * as notificationService from '../services/notification.service.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// === Push Token Management ===

// POST /api/notifications/push-tokens — register Expo push token
router.post('/push-tokens', uploadLimiter, validate(registerPushTokenSchema), async (req, res, next) => {
  try {
    const token = await pushService.registerPushToken(
      req.user.userId,
      req.body.deviceToken,
      req.body.platform,
      req.body.deviceInfo,
    );
    res.status(201).json({ data: token });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notifications/push-tokens/:id — remove push token
router.delete('/push-tokens/:id', validate(removePushTokenSchema), async (req, res, next) => {
  try {
    await pushService.removePushToken(req.params.id, req.user.userId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

// === Notifications ===

// GET /api/notifications — list user's notifications (paginated)
router.get('/', validate(getNotificationsSchema), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationService.getUserNotifications(
      req.user.userId,
      page,
      limit,
      unreadOnly,
    );
    res.json({ data: result.notifications, meta: result.meta });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read — mark notification as read
router.put('/:id/read', validate(markReadSchema), async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.userId);
    res.json({ data: notification });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all — mark all notifications as read
router.post('/read-all', async (req, res, next) => {
  try {
    const count = await notificationService.markAllAsRead(req.user.userId);
    res.json({ data: { markedAsRead: count } });
  } catch (err) {
    next(err);
  }
});

export default router;
