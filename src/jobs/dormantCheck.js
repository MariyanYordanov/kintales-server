import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { familyTrees, profiles, notifications } from '../db/schema.js';
import { toISODate } from '../utils/date.js';
import logger from '../utils/logger.js';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const THREE_YEARS_MS = 3 * ONE_YEAR_MS;

/**
 * Monthly cron job (1st day, 1:00 AM): check for dormant/archived trees.
 * - Owner lastLoginAt > 1 year ago → DORMANT
 * - Owner lastLoginAt > 3 years ago → ARCHIVED
 */
export async function dormantCheckJob() {
  try {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - ONE_YEAR_MS);
    const threeYearsAgo = new Date(now.getTime() - THREE_YEARS_MS);

    // Fetch active trees with owner's lastLoginAt
    const activeTrees = await db
      .select({
        treeId: familyTrees.id,
        treeName: familyTrees.name,
        ownerId: familyTrees.ownerId,
        lastLoginAt: profiles.lastLoginAt,
      })
      .from(familyTrees)
      .innerJoin(profiles, eq(familyTrees.ownerId, profiles.id))
      .where(eq(familyTrees.status, 'ACTIVE'));

    if (activeTrees.length === 0) {
      return;
    }

    let dormantCount = 0;
    let archivedCount = 0;

    for (const tree of activeTrees) {
      // Skip if owner never logged in (treat as active — just registered)
      if (!tree.lastLoginAt) continue;

      const lastLogin = new Date(tree.lastLoginAt);
      let newStatus = null;
      let reason = null;

      if (lastLogin <= threeYearsAgo) {
        newStatus = 'ARCHIVED';
        reason = 'Owner inactive for 3+ years';
        archivedCount++;
      } else if (lastLogin <= oneYearAgo) {
        newStatus = 'DORMANT';
        reason = 'Owner inactive for 1+ year';
        dormantCount++;
      }

      if (newStatus) {
        await db
          .update(familyTrees)
          .set({
            status: newStatus,
            archivedAt: now,
            archiveReason: reason,
          })
          .where(eq(familyTrees.id, tree.treeId));

        // Notify the owner
        await db.insert(notifications).values({
          userId: tree.ownerId,
          treeId: tree.treeId,
          type: newStatus === 'ARCHIVED' ? 'TREE_ARCHIVED' : 'TREE_DORMANT',
          title:
            newStatus === 'ARCHIVED'
              ? `Дървото "${tree.treeName}" е архивирано`
              : `Дървото "${tree.treeName}" е маркирано като неактивно`,
          body:
            newStatus === 'ARCHIVED'
              ? 'Дървото е архивирано поради неактивност повече от 3 години. Влезте в акаунта си, за да го възстановите.'
              : 'Дървото е маркирано като неактивно поради неактивност повече от 1 година. Влезте в акаунта си, за да остане активно.',
          eventDate: toISODate(now),
        });
      }
    }

    if (dormantCount > 0 || archivedCount > 0) {
      logger.info('Dormant check: completed', {
        checked: activeTrees.length,
        dormant: dormantCount,
        archived: archivedCount,
      });
    }
  } catch (err) {
    logger.error('Dormant check error', {
      error: err.message,
      stack: err.stack,
    });
  }
}
