import { eq, and, between } from 'drizzle-orm';
import { db } from '../config/database.js';
import { familyTrees, treeMembers, notifications } from '../db/schema.js';
import { getTreeEvents } from '../services/events.service.js';
import { toISODate } from '../utils/date.js';
import logger from '../utils/logger.js';

/**
 * Daily cron job (6:00 AM): compute events for next 7 days,
 * insert notifications for each tree member.
 * Uses batch deduplication (single SELECT + batch INSERT per tree).
 */
export async function generateEventsNotifications() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const fromStr = toISODate(today);
    const toStr = toISODate(sevenDaysLater);

    // 1. Query all active trees
    const activeTrees = await db
      .select({ id: familyTrees.id })
      .from(familyTrees)
      .where(eq(familyTrees.status, 'ACTIVE'));

    if (activeTrees.length === 0) {
      return;
    }

    logger.info('Generate events job: started', {
      trees: activeTrees.length,
      range: `${fromStr} → ${toStr}`,
    });

    let totalEvents = 0;
    let totalNotifications = 0;
    let failedTrees = 0;

    for (const tree of activeTrees) {
      try {
        // 2. Compute events for this tree
        const events = await getTreeEvents(tree.id, fromStr, toStr);
        totalEvents += events.length;

        if (events.length === 0) continue;

        // 3. Get all tree members
        const members = await db
          .select({ userId: treeMembers.userId })
          .from(treeMembers)
          .where(eq(treeMembers.treeId, tree.id));

        // 4. Fetch existing notifications for this tree in date range (batch dedup)
        const existingNotifs = await db
          .select({
            userId: notifications.userId,
            type: notifications.type,
            relativeId: notifications.relativeId,
            eventDate: notifications.eventDate,
          })
          .from(notifications)
          .where(
            and(
              eq(notifications.treeId, tree.id),
              between(notifications.eventDate, fromStr, toStr),
            ),
          );

        const existingKeys = new Set(
          existingNotifs.map(
            (n) =>
              `${n.userId}|${n.type}|${n.relativeId ?? 'null'}|${n.eventDate}`,
          ),
        );

        // 5. Build batch of new notifications
        const newNotifications = [];
        for (const event of events) {
          for (const member of members) {
            const key = `${member.userId}|${event.type}|${event.relativeId ?? 'null'}|${event.date}`;
            if (existingKeys.has(key)) continue;

            // Mark as seen to prevent duplicates within this batch
            existingKeys.add(key);

            newNotifications.push({
              userId: member.userId,
              treeId: tree.id,
              type: event.type,
              relativeId: event.relativeId ?? null,
              title: buildNotificationTitle(event),
              body: buildNotificationBody(event),
              eventDate: event.date,
            });
          }
        }

        // 6. Batch insert
        if (newNotifications.length > 0) {
          await db.insert(notifications).values(newNotifications);
          totalNotifications += newNotifications.length;
        }
      } catch (err) {
        failedTrees++;
        logger.error('Generate events job: tree failed', {
          treeId: tree.id,
          error: err.message,
          stack: err.stack,
        });
      }
    }

    logger.info('Generate events job: completed', {
      trees: activeTrees.length,
      events: totalEvents,
      notifications: totalNotifications,
      failed: failedTrees,
    });
  } catch (err) {
    logger.error('Generate events job error', {
      error: err.message,
      stack: err.stack,
    });
  }
}

/**
 * Build user-friendly notification title (Bulgarian).
 * @param {object} event
 * @returns {string}
 */
function buildNotificationTitle(event) {
  switch (event.type) {
    case 'BIRTHDAY':
      return `Рожден ден на ${event.relativeName}`;
    case 'NAME_DAY':
      return `Имен ден: ${event.metadata.holiday || 'Именни дни'}`;
    case 'COMMEMORATION_40':
      return `40 дни — помен за ${event.relativeName}`;
    case 'COMMEMORATION_6M':
      return `6 месеца — помен за ${event.relativeName}`;
    case 'COMMEMORATION_1Y':
      return `1 година — помен за ${event.relativeName}`;
    case 'COMMEMORATION_ANNUAL':
      return `Годишен помен за ${event.relativeName}`;
    case 'MARRIAGE_ANNIVERSARY':
      return 'Годишнина от сватбата';
    case 'ON_THIS_DAY':
      return 'На тази дата';
    default:
      return 'Събитие';
  }
}

/**
 * Build notification body with details (Bulgarian).
 * @param {object} event
 * @returns {string}
 */
function buildNotificationBody(event) {
  const { metadata } = event;

  switch (event.type) {
    case 'BIRTHDAY':
      return metadata.age != null
        ? `${event.relativeName} навършва ${metadata.age} години`
        : `${event.relativeName} празнува рожден ден`;
    case 'NAME_DAY':
      return `${event.relativeName} празнува имен ден`;
    case 'COMMEMORATION_40':
      return `40 дни от смъртта на ${event.relativeName}`;
    case 'COMMEMORATION_6M':
      return `6 месеца от смъртта на ${event.relativeName}`;
    case 'COMMEMORATION_1Y':
      return `1 година от смъртта на ${event.relativeName}`;
    case 'COMMEMORATION_ANNUAL':
      return `Годишен помен за ${event.relativeName}`;
    case 'MARRIAGE_ANNIVERSARY':
      return metadata.years != null
        ? `${event.relativeName} и ${metadata.spouseName} — ${metadata.years} години`
        : `${event.relativeName} и ${metadata.spouseName}`;
    case 'ON_THIS_DAY':
      return metadata.year != null
        ? `${event.relativeName} — починал/а на тази дата (${metadata.year})`
        : `${event.relativeName} — починал/а на тази дата`;
    default:
      return '';
  }
}

