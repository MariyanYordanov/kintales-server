/**
 * Generate commemoration dates from a death date.
 * Returns empty array if the date is incomplete (needs year + month + day).
 *
 * Types generated:
 * - DEATH_40_DAYS: 40 days after death
 * - DEATH_6_MONTHS: 6 months after death
 * - DEATH_1_YEAR: one-time first-year commemoration
 * - DEATH_ANNIVERSARY: recurring yearly commemoration (same date as 1-year;
 *     a future cron job creates the next year's entry)
 *
 * @param {number} deathYear
 * @param {number|null} deathMonth
 * @param {number|null} deathDay
 * @returns {{ type: string, commDate: string }[]} Array of { type, commDate (YYYY-MM-DD) }
 */
export function generateCommemorationDates(deathYear, deathMonth, deathDay) {
  if (deathMonth == null || deathDay == null) {
    return [];
  }

  const deathDate = new Date(deathYear, deathMonth - 1, deathDay);

  // 40 days after death (simple day addition — no overflow issues)
  const fortyDays = new Date(deathDate);
  fortyDays.setDate(fortyDays.getDate() + 40);

  // 6 months after death (safe month addition)
  const sixMonths = addMonthsSafe(deathDate, 6);

  // 1 year after death (safe month addition)
  const oneYear = addMonthsSafe(deathDate, 12);

  return [
    { type: 'DEATH_40_DAYS', commDate: toISODate(fortyDays) },
    { type: 'DEATH_6_MONTHS', commDate: toISODate(sixMonths) },
    { type: 'DEATH_1_YEAR', commDate: toISODate(oneYear) },
    { type: 'DEATH_ANNIVERSARY', commDate: toISODate(oneYear) },
  ];
}

/**
 * Add months to a date, capping to last day of target month on overflow.
 * E.g. Jan 31 + 1 month → Feb 28 (not Mar 3).
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonthsSafe(date, months) {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setMonth(result.getMonth() + months);

  // If day overflowed into next month, cap to last day of target month
  if (result.getDate() !== dayOfMonth) {
    result.setDate(0); // Last day of previous month
  }

  return result;
}

/** Format Date as YYYY-MM-DD string. */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
