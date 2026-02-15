import { randomBytes } from 'node:crypto';

/**
 * Generate a legacy key in format "XXXX-YYYY-HHHHHHHHHHHH"
 * where XXXX = first 4 chars of family name (uppercase),
 * YYYY = year, HHHHHHHHHHHH = 6 random bytes (12 hex chars).
 * 6 bytes = 281 trillion possibilities per prefix+year — brute-force resistant.
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

  const hex = randomBytes(6).toString('hex').toUpperCase();

  return `${prefix}-${year}-${hex}`;
}
