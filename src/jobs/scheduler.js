import cron from 'node-cron';
import { autoConfirmDeathRecords } from './autoConfirmDeath.js';
import { generateEventsNotifications } from './generateEvents.js';
import { generatePushNotificationsJob } from './generatePushNotifications.js';
import { cleanupExpiredTokensJob } from './cleanupExpiredTokens.js';
import { dormantCheckJob } from './dormantCheck.js';
import { backupReminderJob } from './backupReminder.js';
import logger from '../utils/logger.js';

/**
 * Start all scheduled cron jobs.
 * Called once from app.js after the server starts listening.
 */
export function startScheduler() {
  // Hourly: auto-confirm death records past 48h deadline
  cron.schedule('0 * * * *', autoConfirmDeathRecords);

  // Daily 3:00 AM: remove expired refresh tokens
  cron.schedule('0 3 * * *', cleanupExpiredTokensJob);

  // Daily 6:00 AM: compute events and generate notifications for next 7 days
  cron.schedule('0 6 * * *', generateEventsNotifications);

  // Daily 7:00 AM: send Expo push notifications for today's events
  cron.schedule('0 7 * * *', generatePushNotificationsJob);

  // Monthly 1st 1:00 AM: flag inactive trees as DORMANT/ARCHIVED
  cron.schedule('0 1 1 * *', dormantCheckJob);

  // Monthly 1st 2:00 AM: warn if last backup is stale
  cron.schedule('0 2 1 * *', backupReminderJob);

  logger.info('Cron scheduler started', {
    jobs: [
      'autoConfirmDeath (hourly)',
      'cleanupExpiredTokens (daily 3:00 AM)',
      'generateEvents (daily 6:00 AM)',
      'generatePushNotifications (daily 7:00 AM)',
      'dormantCheck (monthly 1st 1:00 AM)',
      'backupReminder (monthly 1st 2:00 AM)',
    ],
  });
}
