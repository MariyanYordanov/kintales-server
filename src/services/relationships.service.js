import { eq, and, or } from 'drizzle-orm';
import { db } from '../config/database.js';
import { relatives, relationships } from '../db/schema.js';
import { notFound, badRequest, conflict } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { sanitizeRelationship } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

/**
 * Create a relationship between two relatives.
 * @param {object} data - Validated body
 * @param {string} userId - Requesting user ID
 * @returns {Promise<object>}
 */
export async function createRelationship(data, userId) {
  await verifyTreeAccess(data.treeId, userId, 'editor');

  // Verify both persons exist and belong to the specified tree
  const [personA] = await db
    .select({ id: relatives.id, treeId: relatives.treeId })
    .from(relatives)
    .where(and(eq(relatives.id, data.personAId), eq(relatives.treeId, data.treeId)))
    .limit(1);

  if (!personA) {
    throw badRequest('Person A not found in this tree');
  }

  const [personB] = await db
    .select({ id: relatives.id, treeId: relatives.treeId })
    .from(relatives)
    .where(and(eq(relatives.id, data.personBId), eq(relatives.treeId, data.treeId)))
    .limit(1);

  if (!personB) {
    throw badRequest('Person B not found in this tree');
  }

  // Check for duplicate relationship (symmetric types check both directions)
  const symmetricTypes = ['spouse', 'sibling', 'step_sibling'];
  const isSymmetric = symmetricTypes.includes(data.relationshipType);

  const duplicateCondition = isSymmetric
    ? or(
        and(
          eq(relationships.treeId, data.treeId),
          eq(relationships.personAId, data.personAId),
          eq(relationships.personBId, data.personBId),
          eq(relationships.relationshipType, data.relationshipType),
        ),
        and(
          eq(relationships.treeId, data.treeId),
          eq(relationships.personAId, data.personBId),
          eq(relationships.personBId, data.personAId),
          eq(relationships.relationshipType, data.relationshipType),
        ),
      )
    : and(
        eq(relationships.treeId, data.treeId),
        eq(relationships.personAId, data.personAId),
        eq(relationships.personBId, data.personBId),
        eq(relationships.relationshipType, data.relationshipType),
      );

  const [duplicate] = await db
    .select({ id: relationships.id })
    .from(relationships)
    .where(duplicateCondition)
    .limit(1);

  if (duplicate) {
    throw conflict('This relationship already exists');
  }

  const { treeId, ...relData } = data;

  const [created] = await db
    .insert(relationships)
    .values({
      treeId,
      ...relData,
      createdBy: userId,
    })
    .returning();

  logger.info('Relationship created', {
    relationshipId: created.id,
    treeId,
    type: data.relationshipType,
    userId,
  });

  return sanitizeRelationship(created);
}

/**
 * Delete a relationship.
 * @param {string} relationshipId
 * @param {string} userId - Requesting user ID
 */
export async function deleteRelationship(relationshipId, userId) {
  const [existing] = await db
    .select()
    .from(relationships)
    .where(eq(relationships.id, relationshipId))
    .limit(1);

  if (!existing) {
    throw notFound('Relationship');
  }

  await verifyTreeAccess(existing.treeId, userId, 'editor');

  await db.delete(relationships).where(eq(relationships.id, relationshipId));

  logger.info('Relationship deleted', {
    relationshipId,
    treeId: existing.treeId,
    userId,
  });
}
