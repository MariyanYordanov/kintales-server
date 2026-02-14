import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { relatives } from '../db/schema.js';
import { notFound } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { sanitizeRelative } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

/**
 * Get all relatives in a tree.
 * Assumes tree access already verified by middleware.
 * @param {string} treeId
 * @returns {Promise<object[]>}
 */
export async function getTreeRelatives(treeId) {
  const rows = await db
    .select()
    .from(relatives)
    .where(eq(relatives.treeId, treeId));

  return rows.map(sanitizeRelative);
}

/**
 * Get a single relative by ID.
 * Verifies the requesting user has access to the relative's tree.
 * @param {string} relativeId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getRelativeById(relativeId, userId) {
  const [relative] = await db
    .select()
    .from(relatives)
    .where(eq(relatives.id, relativeId))
    .limit(1);

  if (!relative) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(relative.treeId, userId, 'viewer');

  return sanitizeRelative(relative);
}

/**
 * Create a new relative in a tree.
 * @param {object} data - Validated body (treeId + relative fields)
 * @param {string} userId - Requesting user ID
 * @returns {Promise<object>}
 */
export async function createRelative(data, userId) {
  await verifyTreeAccess(data.treeId, userId, 'editor');

  const { treeId, ...relativeData } = data;

  const [created] = await db
    .insert(relatives)
    .values({
      treeId,
      ...relativeData,
      createdBy: userId,
    })
    .returning();

  logger.info('Relative created', { relativeId: created.id, treeId, userId });

  return sanitizeRelative(created);
}

/**
 * Update an existing relative.
 * @param {string} relativeId
 * @param {string} userId
 * @param {object} updates - Validated body fields
 * @returns {Promise<object>}
 */
export async function updateRelative(relativeId, userId, updates) {
  const [existing] = await db
    .select()
    .from(relatives)
    .where(eq(relatives.id, relativeId))
    .limit(1);

  if (!existing) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(existing.treeId, userId, 'editor');

  const [updated] = await db
    .update(relatives)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(relatives.id, relativeId))
    .returning();

  logger.info('Relative updated', { relativeId, treeId: existing.treeId, userId });

  return sanitizeRelative(updated);
}

/**
 * Delete a relative.
 * @param {string} relativeId
 * @param {string} userId
 */
export async function deleteRelative(relativeId, userId) {
  const [existing] = await db
    .select()
    .from(relatives)
    .where(eq(relatives.id, relativeId))
    .limit(1);

  if (!existing) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(existing.treeId, userId, 'editor');

  await db.delete(relatives).where(eq(relatives.id, relativeId));

  logger.info('Relative deleted', { relativeId, treeId: existing.treeId, userId });
}
