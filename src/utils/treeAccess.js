import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { familyTrees, treeMembers } from '../db/schema.js';
import { notFound, forbidden } from './errors.js';

const ROLE_HIERARCHY = { viewer: 0, editor: 1, owner: 2 };

/**
 * Verify a user has access to a tree with at least the required role.
 * @param {string} treeId - Tree UUID
 * @param {string} userId - User UUID
 * @param {'viewer'|'editor'|'owner'} minRole - Minimum required role
 * @returns {Promise<{treeId: string, userId: string, role: string}>} Membership info
 * @throws {AppError} 404 if tree doesn't exist, 403 if insufficient access
 */
export async function verifyTreeAccess(treeId, userId, minRole = 'viewer') {
  const [result] = await db
    .select({
      treeId: familyTrees.id,
      memberUserId: treeMembers.userId,
      role: treeMembers.role,
    })
    .from(familyTrees)
    .leftJoin(
      treeMembers,
      and(eq(treeMembers.treeId, familyTrees.id), eq(treeMembers.userId, userId)),
    )
    .where(eq(familyTrees.id, treeId))
    .limit(1);

  if (!result) {
    throw notFound('Tree');
  }

  if (!result.role) {
    throw forbidden('You do not have access to this tree');
  }

  const userLevel = ROLE_HIERARCHY[result.role] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw forbidden('You do not have sufficient permissions for this action');
  }

  return { treeId: result.treeId, userId, role: result.role };
}
