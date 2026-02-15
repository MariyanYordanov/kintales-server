import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { notifications } from '../db/schema.js';
import { sendPushNotifications } from '../services/push.service.js';
import { toISODate } from '../utils/date.js';
import logger from '../utils/logger.js';

/**
 * Daily cron job (7:00 AM): send Expo push notifications
 * for today's events that haven't been pushed yet.
 */
export async function generatePushNotificationsJob() {
  try {
    const today = new Date();
    const todayStr = toISODate(today);

    // Fetch unsent notifications for today
    const pending = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.pushSent, false),
          eq(notifications.eventDate, todayStr),
        ),
      );

    if (pending.length === 0) {
      return;
    }

    logger.info('Push notifications job: started', { pending: pending.length });

    const { sent, failed } = await sendPushNotifications(pending);

    logger.info('Push notifications job: completed', { sent, failed });
  } catch (err) {
    logger.error('Push notifications job error', {
      error: err.message,
      stack: err.stack,
    });
  }
}
