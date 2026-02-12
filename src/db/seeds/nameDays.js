import { getAllNameDays } from 'bg-name-days';
import { nameDays } from '../schema.js';

/**
 * Seed the name_days table from the bg-name-days library.
 * Each date becomes one row: holiday → name, all names → name_variants.
 * @param {import('drizzle-orm/node-postgres').NodePgDatabase} db
 */
export async function seedNameDays(db) {
  const allDays = getAllNameDays();
  const rows = [];

  for (const [dateKey, entry] of Object.entries(allDays)) {
    const [month, day] = dateKey.split('-').map(Number);

    rows.push({
      name: entry.holiday,
      nameVariants: entry.names,
      dateMonth: month,
      dateDay: day,
      holidayName: entry.holiday,
      tradition: 'bulgarian',
    });
  }

  if (rows.length > 0) {
    await db.insert(nameDays).values(rows).onConflictDoNothing();
  }

  return rows.length;
}
