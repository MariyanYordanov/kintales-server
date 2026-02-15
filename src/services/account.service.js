import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  profiles,
  familyTrees,
  refreshTokens,
  treeMembers,
  notifications,
  pushTokens,
} from '../db/schema.js';
import { notFound, conflict } from '../utils/errors.js';
import { deleteFile, BUCKETS } from './storage.service.js';
import logger from '../utils/logger.js';

/**
 * Delete (anonymize) a user account for GDPR compliance.
 *
 * Strategy: Since several tables reference profiles(id) with ON DELETE RESTRICT,
 * we cannot physically delete the row. Instead we anonymize all personal data
 * (email, fullName, password, avatar, bio) and remove associated records
 * that are safe to delete (tokens, memberships, notifications).
 *
 * Pre-condition: The user must NOT own any trees. They must transfer or delete
 * their trees before requesting account deletion.
 *
 * @param {string} userId
 */
export async function deleteAccount(userId) {
  // 1. Fetch profile
  const [profile] = await db
    .select({ id: profiles.id, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    throw notFound('Profile');
  }

  // 2. Check: user must not own any trees
  const [ownedTree] = await db
    .select({ id: familyTrees.id })
    .from(familyTrees)
    .where(eq(familyTrees.ownerId, userId))
    .limit(1);

  if (ownedTree) {
    throw conflict(
      'Cannot delete account while you own family trees. Transfer ownership or delete your trees first.',
    );
  }

  // 3. Transaction: clean up + anonymize
  const anonymizedEmail = `deleted-${randomUUID()}@anonymized.local`;

  await db.transaction(async (tx) => {
    // Delete refresh tokens
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    // Delete notifications
    await tx.delete(notifications).where(eq(notifications.userId, userId));

    // Delete push tokens
    await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));

    // Remove from all trees (CASCADE deletes comments + death_confirmations)
    await tx.delete(treeMembers).where(eq(treeMembers.userId, userId));

    // Anonymize profile (keeps the row for FK integrity)
    await tx
      .update(profiles)
      .set({
        email: anonymizedEmail,
        fullName: 'Изтрит потребител',
        passwordHash: null,
        avatarUrl: null,
        bio: null,
      })
      .where(eq(profiles.id, userId));
  });

  // 4. Delete avatar from MinIO (outside transaction, non-fatal)
  if (profile.avatarUrl) {
    await deleteFile(BUCKETS.AVATARS, profile.avatarUrl);
  }

  logger.info('Account deleted (GDPR)', { userId, anonymizedEmail });
}
