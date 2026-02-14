import { getAllNameDays } from 'bg-name-days';
import { nameDays } from '../schema.js';

/**
 * Seed the name_days table from the bg-name-days library (v2.0.0).
 * getAllNameDays() returns NameDayResult[] — one entry per primary name.
 * Each entry has: name, month, day, holiday, tradition, variants[], isMoveable.
 * @param {import('drizzle-orm/node-postgres').NodePgDatabase} db
 * @returns {Promise<number>} Number of rows inserted
 */
export async function seedNameDays(db) {
  const allDays = getAllNameDays();
  const rows = [];

  for (const entry of allDays) {
    rows.push({
      name: entry.name,
      nameVariants: entry.variants.length > 0 ? entry.variants : null,
      dateMonth: entry.month,
      dateDay: entry.day,
      holidayName: entry.holiday,
      tradition: entry.tradition === 'both' ? 'orthodox' : entry.tradition,
    });
  }

  if (rows.length > 0) {
    await db.insert(nameDays).values(rows).onConflictDoNothing();
  }

  return rows.length;
}
