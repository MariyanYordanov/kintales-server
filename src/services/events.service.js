import { eq, and, between } from 'drizzle-orm';
import { db } from '../config/database.js';
import { relatives, relationships, commemorations } from '../db/schema.js';
import { getAllNameDays } from 'bg-name-days';
import logger from '../utils/logger.js';

// Commemoration type mapping: DB type → API event type
const COMM_TYPE_MAP = {
  DEATH_40_DAYS: 'COMMEMORATION_40',
  DEATH_6_MONTHS: 'COMMEMORATION_6M',
  DEATH_1_YEAR: 'COMMEMORATION_1Y',
  DEATH_ANNIVERSARY: 'COMMEMORATION_ANNUAL',
};

// Event type sort priority (lower = higher priority)
const TYPE_PRIORITY = {
  BIRTHDAY: 0,
  NAME_DAY: 1,
  COMMEMORATION_40: 2,
  COMMEMORATION_6M: 2,
  COMMEMORATION_1Y: 2,
  COMMEMORATION_ANNUAL: 2,
  MARRIAGE_ANNIVERSARY: 3,
  ON_THIS_DAY: 4,
};

// Statuses eligible for birthday and name day events
const LIVING_STATUSES = new Set(['ALIVE', 'UNKNOWN']);

/**
 * Get all events for a tree within a date range.
 * Access control is handled by the route middleware (requireTreeRole).
 *
 * @param {string} treeId
 * @param {string} [fromStr] - YYYY-MM-DD (default: today)
 * @param {string} [toStr] - YYYY-MM-DD (default: today + 30 days)
 * @returns {Promise<object[]>} Sorted events
 */
export async function getTreeEvents(treeId, fromStr, toStr) {
  const { from, to } = parseDateRange(fromStr, toStr);

  // Parallel DB queries — one per entity type (no N+1)
  const [treeRelatives, spouseRelationships, treeComms] = await Promise.all([
    db
      .select({
        id: relatives.id,
        fullName: relatives.fullName,
        birthYear: relatives.birthYear,
        birthMonth: relatives.birthMonth,
        birthDay: relatives.birthDay,
        deathYear: relatives.deathYear,
        deathMonth: relatives.deathMonth,
        deathDay: relatives.deathDay,
        status: relatives.status,
      })
      .from(relatives)
      .where(eq(relatives.treeId, treeId)),

    db
      .select({
        id: relationships.id,
        personAId: relationships.personAId,
        personBId: relationships.personBId,
        marriageYear: relationships.marriageYear,
        marriageMonth: relationships.marriageMonth,
        marriageDay: relationships.marriageDay,
        divorceYear: relationships.divorceYear,
      })
      .from(relationships)
      .where(
        and(
          eq(relationships.treeId, treeId),
          eq(relationships.relationshipType, 'spouse'),
        ),
      ),

    db
      .select({
        id: commemorations.id,
        relativeId: commemorations.relativeId,
        type: commemorations.type,
        commDate: commemorations.commDate,
      })
      .from(commemorations)
      .innerJoin(relatives, eq(commemorations.relativeId, relatives.id))
      .where(
        and(
          eq(relatives.treeId, treeId),
          between(commemorations.commDate, toISODate(from), toISODate(to)),
        ),
      ),
  ]);

  // Build relative lookup map for quick access
  const relativeMap = new Map(treeRelatives.map((r) => [r.id, r]));

  // Partition relatives by living status
  const livingRelatives = treeRelatives.filter((r) => LIVING_STATUSES.has(r.status));
  const deceasedRelatives = treeRelatives.filter((r) => r.status === 'DECEASED');

  // Compute all event types
  const events = [
    ...computeBirthdays(livingRelatives, from, to),
    ...computeNameDays(livingRelatives, from, to),
    ...computeCommemorations(treeComms, relativeMap),
    ...computeAnniversaries(spouseRelationships, relativeMap, from, to),
    ...computeOnThisDay(deceasedRelatives, from, to),
  ];

  // Sort: date ASC, then type priority ASC
  events.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
  });

  return events;
}

// ──────────────────────────────────────────────────────────
// Compute functions
// ──────────────────────────────────────────────────────────

/**
 * Compute birthday events for living relatives in date range.
 * Matches birthMonth + birthDay against each day in range.
 */
function computeBirthdays(livingRelatives, from, to) {
  const events = [];
  // Build month-day index for quick lookup
  const byMonthDay = buildMonthDayIndex(
    livingRelatives.filter((r) => r.birthMonth != null && r.birthDay != null),
    (r) => ({ month: r.birthMonth, day: r.birthDay }),
  );

  forEachDateInRange(from, to, (date, dateStr) => {
    const key = monthDayKey(date.getMonth() + 1, date.getDate());
    const matches = byMonthDay.get(key);
    if (!matches) return;

    for (const rel of matches) {
      const metadata = {};
      if (rel.birthYear != null) {
        metadata.age = date.getFullYear() - rel.birthYear;
      }
      events.push({
        type: 'BIRTHDAY',
        date: dateStr,
        relativeId: rel.id,
        relativeName: rel.fullName,
        metadata,
      });
    }
  });

  return events;
}

/**
 * Compute name day events using bg-name-days library.
 * For each date: get celebrating names → match against relative name parts.
 */
function computeNameDays(livingRelatives, from, to) {
  if (livingRelatives.length === 0) return [];

  const events = [];

  // Pre-extract name parts for each relative (lowercase for matching)
  const relativesWithParts = livingRelatives.map((r) => ({
    ...r,
    nameParts: extractNameParts(r.fullName).map((p) => p.toLowerCase()),
  }));

  // Build name day index from library (handles moveable feasts correctly)
  const nameDayIndex = buildNameDayIndex(from, to);

  forEachDateInRange(from, to, (date, dateStr) => {
    const dayInfo = nameDayIndex.get(dateStr);
    if (!dayInfo) return;

    for (const rel of relativesWithParts) {
      for (const part of rel.nameParts) {
        if (dayInfo.names.has(part)) {
          // Find the holiday for this matching name
          const matchedEntry = dayInfo.entries.find(
            (e) =>
              e.name.toLowerCase() === part ||
              e.variants.some((v) => v.toLowerCase() === part),
          );

          events.push({
            type: 'NAME_DAY',
            date: dateStr,
            relativeId: rel.id,
            relativeName: rel.fullName,
            metadata: {
              holiday: matchedEntry?.holiday ?? '',
              matchedName:
                matchedEntry?.name ??
                extractNameParts(rel.fullName).find(
                  (p) => p.toLowerCase() === part,
                ) ??
                part,
            },
          });
          break; // One NAME_DAY event per relative per date
        }
      }
    }
  });

  return events;
}

/**
 * Compute commemoration events from DB results.
 * Maps DB type to API event type.
 */
function computeCommemorations(commRows, relativeMap) {
  return commRows.map((c) => {
    const rel = relativeMap.get(c.relativeId);
    return {
      type: COMM_TYPE_MAP[c.type] ?? c.type,
      date: c.commDate,
      relativeId: c.relativeId,
      relativeName: rel?.fullName ?? '',
      metadata: {},
    };
  });
}

/**
 * Compute marriage anniversary events.
 * Only for spouse relationships with marriageMonth/Day, not divorced.
 */
function computeAnniversaries(spouseRelationships, relativeMap, from, to) {
  const events = [];

  // Filter to relationships with full marriage date and no divorce
  const eligible = spouseRelationships.filter(
    (r) =>
      r.marriageMonth != null &&
      r.marriageDay != null &&
      r.divorceYear == null,
  );

  // Build month-day index
  const byMonthDay = buildMonthDayIndex(eligible, (r) => ({
    month: r.marriageMonth,
    day: r.marriageDay,
  }));

  forEachDateInRange(from, to, (date, dateStr) => {
    const key = monthDayKey(date.getMonth() + 1, date.getDate());
    const matches = byMonthDay.get(key);
    if (!matches) return;

    for (const rel of matches) {
      const personA = relativeMap.get(rel.personAId);
      const personB = relativeMap.get(rel.personBId);
      if (!personA || !personB) continue;

      const metadata = {};
      if (rel.marriageYear != null) {
        metadata.years = date.getFullYear() - rel.marriageYear;
      }
      metadata.spouseId = rel.personBId;
      metadata.spouseName = personB.fullName;

      events.push({
        type: 'MARRIAGE_ANNIVERSARY',
        date: dateStr,
        relativeId: rel.personAId,
        relativeName: personA.fullName,
        metadata,
      });
    }
  });

  return events;
}

/**
 * Compute ON_THIS_DAY events for deceased relatives.
 * Shows death anniversaries (month/day match, not from commemorations table).
 */
function computeOnThisDay(deceasedRelatives, from, to) {
  const events = [];

  const withDeathDate = deceasedRelatives.filter(
    (r) => r.deathMonth != null && r.deathDay != null,
  );

  const byMonthDay = buildMonthDayIndex(withDeathDate, (r) => ({
    month: r.deathMonth,
    day: r.deathDay,
  }));

  forEachDateInRange(from, to, (date, dateStr) => {
    const key = monthDayKey(date.getMonth() + 1, date.getDate());
    const matches = byMonthDay.get(key);
    if (!matches) return;

    for (const rel of matches) {
      events.push({
        type: 'ON_THIS_DAY',
        date: dateStr,
        relativeId: rel.id,
        relativeName: rel.fullName,
        metadata: {
          eventType: 'death',
          year: rel.deathYear,
        },
      });
    }
  });

  return events;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/**
 * Parse and apply defaults to the date range.
 * @param {string} [fromStr]
 * @param {string} [toStr]
 * @returns {{ from: Date, to: Date }}
 */
function parseDateRange(fromStr, toStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const from = fromStr ? new Date(fromStr + 'T00:00:00') : new Date(now);
  const to = toStr
    ? new Date(toStr + 'T00:00:00')
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return { from, to };
}

/**
 * Extract individual name parts from a full name.
 * @param {string} fullName - e.g. "Георги Петров Иванов"
 * @returns {string[]} ["Георги", "Петров", "Иванов"]
 */
function extractNameParts(fullName) {
  return fullName
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Build a name day index from the bg-name-days library for a date range.
 * Handles year boundaries (range spanning Dec → Jan).
 * @param {Date} from
 * @param {Date} to
 * @returns {Map<string, { names: Set<string>, entries: object[] }>}
 *          Key: "YYYY-MM-DD", Value: { names (lowercase Set), entries }
 */
function buildNameDayIndex(from, to) {
  const startYear = from.getFullYear();
  const endYear = to.getFullYear();
  const index = new Map();

  for (let y = startYear; y <= endYear; y++) {
    let allEntries;
    try {
      allEntries = getAllNameDays(y);
    } catch (err) {
      logger.error('Failed to load name days for year', { year: y, error: err.message });
      continue;
    }

    for (const entry of allEntries) {
      const dateStr = `${y}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`;
      const entryDate = new Date(y, entry.month - 1, entry.day);

      // Skip entries outside the requested range
      if (entryDate < from || entryDate > to) continue;

      if (!index.has(dateStr)) {
        index.set(dateStr, { names: new Set(), entries: [] });
      }

      const item = index.get(dateStr);
      item.names.add(entry.name.toLowerCase());
      for (const v of entry.variants) {
        item.names.add(v.toLowerCase());
      }
      item.entries.push(entry);
    }
  }

  return index;
}

/**
 * Build a month-day index from an array of items.
 * @param {object[]} items
 * @param {Function} getMonthDay - (item) => { month, day }
 * @returns {Map<string, object[]>} Key: "MM-DD"
 */
function buildMonthDayIndex(items, getMonthDay) {
  const index = new Map();
  for (const item of items) {
    const { month, day } = getMonthDay(item);
    const key = monthDayKey(month, day);
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(item);
  }
  return index;
}

/** Create "MM-DD" key from month and day numbers. */
function monthDayKey(month, day) {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Iterate over each date in range [from, to] inclusive.
 * Calls callback with an immutable Date snapshot and "YYYY-MM-DD" string.
 * Does NOT mutate from/to, and each callback receives a fresh Date.
 */
function forEachDateInRange(from, to, callback) {
  const current = new Date(from);
  while (current <= to) {
    const snapshot = new Date(current);
    callback(snapshot, toISODate(snapshot));
    current.setDate(current.getDate() + 1);
  }
}

/** Format Date as YYYY-MM-DD string. */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
