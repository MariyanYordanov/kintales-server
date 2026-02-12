import { randomBytes } from 'node:crypto';

/**
 * Generate a legacy key in format "XXXX-YYYY-HHHH"
 * where XXXX = first 4 chars of family name (Latin uppercase),
 * YYYY = year, HHHH = random hex.
 * @param {string} familyName
 * @param {number} [year]
 * @returns {string}
 */
export function generateLegacyKey(familyName, year = new Date().getFullYear()) {
  const prefix = familyName
    .replace(/[^a-zA-Z\u0400-\u04FF]/g, '')
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, 'X');

  const hex = randomBytes(2).toString('hex').toUpperCase();

  return `${prefix}-${year}-${hex}`;
}
