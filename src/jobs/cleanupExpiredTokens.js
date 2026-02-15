import { lte, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { refreshTokens } from '../db/schema.js';
import logger from '../utils/logger.js';

/**
 * Daily cron job (3:00 AM): remove expired refresh tokens.
 */
export async function cleanupExpiredTokensJob() {
  try {
    const deleted = await db
      .delete(refreshTokens)
      .where(lte(refreshTokens.expiresAt, sql`NOW()`))
      .returning({ id: refreshTokens.id });

    if (deleted.length > 0) {
      logger.info('Cleanup expired tokens: completed', { deleted: deleted.length });
    }
  } catch (err) {
    logger.error('Cleanup expired tokens error', {
      error: err.message,
      stack: err.stack,
    });
  }
}
