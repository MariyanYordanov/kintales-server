import { eq, count } from 'drizzle-orm';
import { db } from '../config/database.js';
import { familyTrees, treeMembers } from '../db/schema.js';
import { notFound } from '../utils/errors.js';
import { sanitizeTree } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

/**
 * Get all trees the user is a member of.
 * @param {string} userId
 * @returns {Promise<object[]>} Array of sanitized trees with user's role
 */
export async function getUserTrees(userId) {
  const rows = await db
    .select({
      id: familyTrees.id,
      name: familyTrees.name,
      ownerId: familyTrees.ownerId,
      status: familyTrees.status,
      createdAt: familyTrees.createdAt,
      role: treeMembers.role,
    })
    .from(treeMembers)
    .innerJoin(familyTrees, eq(treeMembers.treeId, familyTrees.id))
    .where(eq(treeMembers.userId, userId));

  return rows.map((row) => sanitizeTree(row, row.role));
}

/**
 * Get a single tree by ID with member count.
 * Assumes access has been verified by middleware.
 * @param {string} treeId
 * @param {string} role - User's role (from middleware)
 * @returns {Promise<object>} Sanitized tree with memberCount
 */
export async function getTreeById(treeId, role) {
  const [tree] = await db
    .select()
    .from(familyTrees)
    .where(eq(familyTrees.id, treeId))
    .limit(1);

  if (!tree) {
    throw notFound('Tree');
  }

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(treeMembers)
    .where(eq(treeMembers.treeId, treeId));

  return { ...sanitizeTree(tree, role), memberCount };
}

/**
 * Update tree name. Assumes owner access verified by middleware.
 * @param {string} treeId
 * @param {{ name: string }} updates
 * @returns {Promise<object>} Sanitized updated tree
 */
export async function updateTree(treeId, updates) {
  const [updated] = await db
    .update(familyTrees)
    .set({ name: updates.name })
    .where(eq(familyTrees.id, treeId))
    .returning();

  if (!updated) {
    throw notFound('Tree');
  }

  logger.info('Tree updated', { treeId, name: updates.name });

  return sanitizeTree(updated);
}
