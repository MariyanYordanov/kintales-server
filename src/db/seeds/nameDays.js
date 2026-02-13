import { getAllNameDays } from 'bg-name-days';
import { nameDays } from '../schema.js';

/**
 * Seed the name_days table from the bg-name-days library.
 * One row per date: first person name → `name`, rest → `name_variants`.
 * Dates with no associated names are skipped.
 * @param {import('drizzle-orm/node-postgres').NodePgDatabase} db
 * @returns {Promise<number>} Number of rows prepared for insert
 */
export async function seedNameDays(db) {
  const allDays = getAllNameDays();
  const rows = [];

  for (const [dateKey, entry] of Object.entries(allDays)) {
    if (!entry.names || entry.names.length === 0) continue;

    const [month, day] = dateKey.split('-').map(Number);
    const [primaryName, ...variants] = entry.names;

    rows.push({
      name: primaryName,
      nameVariants: variants.length > 0 ? variants : null,
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
