import cron from 'node-cron';
import { autoConfirmDeathRecords } from './autoConfirmDeath.js';
import { generateEventsNotifications } from './generateEvents.js';
import logger from '../utils/logger.js';

/**
 * Start all scheduled cron jobs.
 * Called once from app.js after the server starts listening.
 */
export function startScheduler() {
  // Hourly: auto-confirm death records past 48h deadline
  cron.schedule('0 * * * *', autoConfirmDeathRecords);

  // Daily 6:00 AM: compute events and generate notifications for next 7 days
  cron.schedule('0 6 * * *', generateEventsNotifications);

  logger.info('Cron scheduler started', {
    jobs: ['autoConfirmDeath (hourly)', 'generateEvents (daily 6:00 AM)'],
  });
}
