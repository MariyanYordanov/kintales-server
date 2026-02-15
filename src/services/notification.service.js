import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { notifications } from '../db/schema.js';
import { notFound } from '../utils/errors.js';

/**
 * Get paginated notifications for a user.
 * @param {string} userId
 * @param {number} page - 1-based page number
 * @param {number} limit - items per page
 * @param {boolean} unreadOnly - filter to unread only
 * @returns {Promise<{ notifications: object[], meta: object }>}
 */
export async function getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
  const offset = (page - 1) * limit;

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [userNotifs, [totalRow], [unreadRow]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(notifications)
      .where(whereClause),
    db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      ),
  ]);

  return {
    notifications: userNotifs,
    meta: {
      page,
      limit,
      total: totalRow.value,
      unreadCount: unreadRow.value,
    },
  };
}

/**
 * Mark a single notification as read. Verifies ownership.
 * @param {string} notificationId
 * @param {string} userId
 * @returns {Promise<object>} Updated notification
 */
export async function markAsRead(notificationId, userId) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning();

  if (!updated) {
    throw notFound('Notification');
  }

  return updated;
}

/**
 * Mark all unread notifications as read for a user.
 * @param {string} userId
 * @returns {Promise<number>} Count of marked notifications
 */
export async function markAllAsRead(userId) {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
      ),
    )
    .returning({ id: notifications.id });

  return result.length;
}
