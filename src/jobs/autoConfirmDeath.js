import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { deathRecords } from '../db/schema.js';
import { finalizeDeathRecord } from '../services/death.service.js';
import logger from '../utils/logger.js';

/**
 * Hourly cron job: auto-confirm death records that have passed the 48h deadline.
 * Finds PENDING records with confirmationsNeeded=0 and autoConfirmAt <= NOW().
 */
export async function autoConfirmDeathRecords() {
  try {
    const pendingRecords = await db
      .select()
      .from(deathRecords)
      .where(
        and(
          eq(deathRecords.status, 'PENDING'),
          lte(deathRecords.autoConfirmAt, sql`NOW()`),
        ),
      );

    if (pendingRecords.length === 0) {
      return;
    }

    logger.info('Auto-confirm job: processing records', { count: pendingRecords.length });

    let confirmed = 0;
    let failed = 0;

    for (const record of pendingRecords) {
      try {
        await finalizeDeathRecord(record);
        confirmed++;
      } catch (err) {
        failed++;
        logger.error('Auto-confirm failed for record', {
          deathRecordId: record.id,
          error: err.message,
        });
      }
    }

    logger.info('Auto-confirm job completed', { confirmed, failed });
  } catch (err) {
    logger.error('Auto-confirm job error', { error: err.message });
  }
}
