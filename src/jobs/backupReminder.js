import { stat } from 'node:fs/promises';
import logger from '../utils/logger.js';

const BACKUP_LOG_PATH = '/var/log/kintales-backup.log';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Monthly cron job (1st day, 2:00 AM): check if backup log is fresh.
 * Logs a warning if the backup log doesn't exist or is older than 30 days.
 */
export async function backupReminderJob() {
  try {
    const stats = await stat(BACKUP_LOG_PATH);
    const ageMs = Date.now() - stats.mtime.getTime();

    if (ageMs > MAX_AGE_MS) {
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      logger.warn('Backup reminder: last backup is stale', {
        lastModified: stats.mtime.toISOString(),
        ageDays,
        threshold: 30,
      });
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn('Backup reminder: backup log not found', {
        path: BACKUP_LOG_PATH,
      });
    } else {
      logger.error('Backup reminder error', {
        error: err.message,
      });
    }
  }
}
