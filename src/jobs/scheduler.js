import cron from 'node-cron';
import { autoConfirmDeathRecords } from './autoConfirmDeath.js';
import logger from '../utils/logger.js';

/**
 * Start all scheduled cron jobs.
 * Called once from app.js after the server starts listening.
 */
export function startScheduler() {
  // Hourly: auto-confirm death records past 48h deadline
  cron.schedule('0 * * * *', autoConfirmDeathRecords);

  logger.info('Cron scheduler started', {
    jobs: ['autoConfirmDeath (hourly)'],
  });
}
