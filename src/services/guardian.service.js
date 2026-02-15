import { eq, and, asc, count as drizzleCount } from 'drizzle-orm';
import { db } from '../config/database.js';
import { treeGuardians, profiles, familyTrees } from '../db/schema.js';
import { notFound, forbidden, conflict, badRequest } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { sanitizeGuardian } from '../utils/sanitize.js';
import { sendGuardianInviteEmail } from './email.service.js';
import logger from '../utils/logger.js';

const MAX_GUARDIANS_PER_TREE = 10;

/**
 * Get guardians for a tree, ordered by creation date.
 * @param {string} treeId
 * @returns {Promise<object[]>} Sanitized guardian objects
 */
export async function getTreeGuardians(treeId) {
  const rows = await db
    .select()
    .from(treeGuardians)
    .where(eq(treeGuardians.treeId, treeId))
    .orderBy(asc(treeGuardians.createdAt))
    .limit(MAX_GUARDIANS_PER_TREE);

  return rows.map(sanitizeGuardian);
}

/**
 * Add a guardian to a tree (owner only).
 * Auto-links guardianUserId if the email matches a registered user.
 * Sends an invite email to the guardian.
 * @param {string} userId - The owner assigning the guardian
 * @param {{ treeId: string, guardianEmail: string, guardianName: string, permissions: string }} data
 * @returns {Promise<object>} Sanitized guardian
 */
export async function addGuardian(userId, data) {
  const { treeId, guardianEmail, guardianName, permissions } = data;

  // Verify caller is tree owner
  await verifyTreeAccess(treeId, userId, 'owner');

  // Check guardian count limit
  const [{ total }] = await db
    .select({ total: drizzleCount() })
    .from(treeGuardians)
    .where(eq(treeGuardians.treeId, treeId));

  if (total >= MAX_GUARDIANS_PER_TREE) {
    throw badRequest(`Cannot add more than ${MAX_GUARDIANS_PER_TREE} guardians per tree`);
  }

  // Check for duplicate (same tree + email)
  const [existing] = await db
    .select({ id: treeGuardians.id })
    .from(treeGuardians)
    .where(
      and(
        eq(treeGuardians.treeId, treeId),
        eq(treeGuardians.guardianEmail, guardianEmail),
      ),
    )
    .limit(1);

  if (existing) {
    throw conflict('This email is already assigned as a guardian for this tree');
  }

  // Lookup if email belongs to a registered user
  const [existingUser] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, guardianEmail))
    .limit(1);

  // Insert guardian (unique constraint on treeId + guardianEmail as safety net)
  let created;
  try {
    [created] = await db
      .insert(treeGuardians)
      .values({
        treeId,
        guardianUserId: existingUser?.id ?? null,
        guardianEmail,
        guardianName,
        assignedBy: userId,
        permissions,
      })
      .returning();
  } catch (err) {
    if (err.code === '23505' && err.constraint?.includes('tree_email')) {
      throw conflict('This email is already assigned as a guardian for this tree');
    }
    throw err;
  }

  const sanitized = sanitizeGuardian(created);

  // Fetch tree name and assigner name for email
  const [tree] = await db
    .select({ name: familyTrees.name })
    .from(familyTrees)
    .where(eq(familyTrees.id, treeId))
    .limit(1);

  const [assigner] = await db
    .select({ fullName: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  // Send invite email (non-blocking)
  sendGuardianInviteEmail({
    to: guardianEmail,
    guardianName,
    treeName: tree?.name ?? 'Unknown',
    assignerName: assigner?.fullName ?? 'Unknown',
  });

  logger.info('Guardian added', {
    guardianId: created.id,
    treeId,
    guardianEmail,
    userId,
  });

  return sanitized;
}

/**
 * Remove a guardian (owner only).
 * @param {string} guardianId
 * @param {string} userId
 */
export async function removeGuardian(guardianId, userId) {
  const [guardian] = await db
    .select()
    .from(treeGuardians)
    .where(eq(treeGuardians.id, guardianId))
    .limit(1);

  if (!guardian) {
    throw notFound('Guardian');
  }

  // Verify caller is tree owner
  await verifyTreeAccess(guardian.treeId, userId, 'owner');

  await db.delete(treeGuardians).where(eq(treeGuardians.id, guardianId));

  logger.info('Guardian removed', {
    guardianId,
    treeId: guardian.treeId,
    userId,
  });
}
