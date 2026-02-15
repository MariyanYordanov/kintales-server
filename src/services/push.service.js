import { Expo } from 'expo-server-sdk';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { pushTokens, notifications } from '../db/schema.js';
import { notFound, badRequest } from '../utils/errors.js';
import logger from '../utils/logger.js';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
});

/**
 * Register an Expo push token for a user.
 * Upserts — if the same user+token combo exists, refreshes createdAt.
 * @param {string} userId
 * @param {string} deviceToken
 * @param {string} platform - 'ios' | 'android'
 * @param {string|null} deviceInfo
 * @returns {Promise<object>}
 */
export async function registerPushToken(userId, deviceToken, platform, deviceInfo) {
  if (!Expo.isExpoPushToken(deviceToken)) {
    throw badRequest('Invalid Expo push token format');
  }

  const [token] = await db
    .insert(pushTokens)
    .values({ userId, deviceToken, platform, deviceInfo: deviceInfo ?? null })
    .onConflictDoUpdate({
      target: [pushTokens.userId, pushTokens.deviceToken],
      set: { platform, deviceInfo: deviceInfo ?? null, createdAt: new Date() },
    })
    .returning();

  logger.info('Push token registered', { userId, platform });

  return token;
}

/**
 * Remove a push token. Verifies ownership before deletion.
 * @param {string} tokenId
 * @param {string} userId
 */
export async function removePushToken(tokenId, userId) {
  const [existing] = await db
    .select()
    .from(pushTokens)
    .where(and(eq(pushTokens.id, tokenId), eq(pushTokens.userId, userId)))
    .limit(1);

  if (!existing) {
    throw notFound('Push token');
  }

  await db.delete(pushTokens).where(eq(pushTokens.id, tokenId));

  logger.info('Push token removed', { tokenId, userId });
}

/**
 * Send Expo push notifications for a list of notification records.
 * Groups by user, fetches their tokens, builds messages, sends in chunks.
 * Cleans up invalid tokens automatically.
 *
 * @param {object[]} notifRecords - Notification rows from DB (must have userId, title, body, id, type, treeId)
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function sendPushNotifications(notifRecords) {
  if (notifRecords.length === 0) return { sent: 0, failed: 0 };

  // Group notifications by userId
  const byUser = new Map();
  for (const n of notifRecords) {
    const list = byUser.get(n.userId) || [];
    list.push(n);
    byUser.set(n.userId, list);
  }

  // Fetch all push tokens for affected users in one query
  const userIds = [...byUser.keys()];
  const allTokens = await db
    .select()
    .from(pushTokens)
    .where(inArray(pushTokens.userId, userIds));

  // Group tokens by userId
  const tokensByUser = new Map();
  for (const t of allTokens) {
    const list = tokensByUser.get(t.userId) || [];
    list.push(t);
    tokensByUser.set(t.userId, list);
  }

  // Build Expo messages
  const messages = [];
  const sentNotifIds = [];

  for (const [userId, userNotifs] of byUser) {
    const userTokens = tokensByUser.get(userId) || [];
    if (userTokens.length === 0) continue;

    for (const notif of userNotifs) {
      for (const token of userTokens) {
        if (!Expo.isExpoPushToken(token.deviceToken)) continue;

        messages.push({
          to: token.deviceToken,
          title: notif.title,
          body: notif.body || '',
          data: {
            notificationId: notif.id,
            type: notif.type,
            treeId: notif.treeId,
          },
          sound: 'default',
        });
      }
      sentNotifIds.push(notif.id);
    }
  }

  if (messages.length === 0) return { sent: 0, failed: 0 };

  // Send in chunks (Expo recommends max 100 per request)
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let failed = 0;
  const invalidTokens = [];

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          // DeviceNotRegistered → token is invalid, remove it
          if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[i].to);
          }
          logger.warn('Push ticket error', {
            error: ticket.details?.error,
            tokenPrefix: chunk[i].to.substring(0, 20) + '***',
          });
        }
      }
    } catch (err) {
      failed += chunk.length;
      logger.error('Expo push chunk failed', { error: err.message });
    }
  }

  // Clean up invalid tokens
  if (invalidTokens.length > 0) {
    await db
      .delete(pushTokens)
      .where(inArray(pushTokens.deviceToken, invalidTokens));

    logger.info('Removed invalid push tokens', { count: invalidTokens.length });
  }

  // Mark notifications as push-sent
  if (sentNotifIds.length > 0) {
    await db
      .update(notifications)
      .set({ pushSent: true })
      .where(inArray(notifications.id, sentNotifIds));
  }

  return { sent, failed };
}
