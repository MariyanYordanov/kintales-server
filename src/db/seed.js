import 'dotenv/config';
import { db } from '../config/database.js';
import { pool } from '../config/database.js';
import { nameDays } from './schema.js';
import { seedNameDays } from './seeds/nameDays.js';
import logger from '../utils/logger.js';

const isFresh = process.argv.includes('--fresh');

async function run() {
  try {
    if (isFresh) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('--fresh flag is not allowed in production');
      }
      logger.info('Fresh mode: deleting all name_days rows...');
      await db.delete(nameDays);
    }

    logger.info('Seeding name days...');
    const count = await seedNameDays(db);
    logger.info(`Name days seed complete: ${count} rows processed`);
  } catch (err) {
    logger.error('Seed failed', { error: err.message || String(err), code: err.code });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
