import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  legacyKeys,
  familyTrees,
  treeMembers,
  profiles,
} from '../db/schema.js';
import { notFound, badRequest, forbidden, conflict } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { sanitizeLegacyKey, sanitizeTree } from '../utils/sanitize.js';
import { generateLegacyKey } from '../utils/crypto.js';
import { sendLegacyKeyEmail } from './email.service.js';
import logger from '../utils/logger.js';

const MAX_KEY_GENERATION_RETRIES = 3;

/**
 * Get legacy keys for a tree, ordered by newest first.
 * @param {string} treeId
 * @returns {Promise<object[]>} Sanitized legacy key objects
 */
export async function getTreeLegacyKeys(treeId) {
  const rows = await db
    .select()
    .from(legacyKeys)
    .where(eq(legacyKeys.treeId, treeId))
    .orderBy(desc(legacyKeys.createdAt));

  return rows.map(sanitizeLegacyKey);
}

/**
 * Create a legacy key for a tree (editor+ only).
 * Generates a unique key code with retry on collision.
 * Optionally sends email to the recipient.
 * @param {string} userId
 * @param {{ treeId: string, keyType: string, recipientEmail?: string, recipientName?: string }} data
 * @returns {Promise<object>} Sanitized legacy key
 */
export async function createLegacyKey(userId, data) {
  const { treeId, keyType, recipientEmail, recipientName } = data;

  // Verify caller has editor+ access
  await verifyTreeAccess(treeId, userId, 'editor');

  // Fetch tree name for key prefix
  const [tree] = await db
    .select({ id: familyTrees.id, name: familyTrees.name })
    .from(familyTrees)
    .where(eq(familyTrees.id, treeId))
    .limit(1);

  if (!tree) {
    throw notFound('Tree');
  }

  // Generate unique key code with retry
  let created;
  for (let attempt = 0; attempt < MAX_KEY_GENERATION_RETRIES; attempt++) {
    const keyCode = generateLegacyKey(tree.name);
    try {
      const [row] = await db
        .insert(legacyKeys)
        .values({
          treeId,
          createdBy: userId,
          keyCode,
          keyType,
          recipientEmail: recipientEmail ?? null,
          recipientName: recipientName ?? null,
        })
        .returning();
      created = row;
      break;
    } catch (err) {
      // Retry only on unique constraint violation (key_code)
      if (err.code === '23505' && err.constraint?.includes('key_code')) {
        logger.warn('Legacy key collision, retrying', { attempt, treeId });
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw badRequest('Failed to generate unique key code. Please try again.');
  }

  const sanitized = sanitizeLegacyKey(created);

  // Send email if recipient email is provided
  if (recipientEmail) {
    const [sender] = await db
      .select({ fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    sendLegacyKeyEmail({
      to: recipientEmail,
      recipientName: recipientName ?? '',
      treeName: tree.name,
      keyCode: created.keyCode,
      senderName: sender?.fullName ?? 'Unknown',
    });
  }

  logger.info('Legacy key created', {
    keyId: created.id,
    treeId,
    keyType,
    userId,
  });

  return sanitized;
}

/**
 * Redeem a legacy key to join a tree.
 * Validates the key, checks recipient email match (if set), and adds user as editor.
 * Uses a transaction to atomically update the key and insert membership.
 * @param {string} userId
 * @param {string} userEmail
 * @param {string} keyCode
 * @returns {Promise<{ tree: object, key: object }>}
 */
export async function redeemLegacyKey(userId, userEmail, keyCode) {
  // All validation + mutation inside transaction with row lock to prevent double-spend
  const result = await db.transaction(async (tx) => {
    // Lock the key row with atomic status check (prevents TOCTOU race)
    const [key] = await tx
      .update(legacyKeys)
      .set({
        status: 'USED',
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(
        and(eq(legacyKeys.keyCode, keyCode), eq(legacyKeys.status, 'ACTIVE')),
      )
      .returning();

    if (!key) {
      throw notFound('Legacy key');
    }

    // If recipientEmail is set, it must match the user's email
    if (key.recipientEmail && key.recipientEmail !== userEmail) {
      // Revert key status since email doesn't match
      await tx
        .update(legacyKeys)
        .set({ status: 'ACTIVE', usedBy: null, usedAt: null })
        .where(eq(legacyKeys.id, key.id));
      throw forbidden('This key is assigned to a different email address');
    }

    // Check if user is already a member of the tree
    const [existingMember] = await tx
      .select({ userId: treeMembers.userId })
      .from(treeMembers)
      .where(
        and(
          eq(treeMembers.treeId, key.treeId),
          eq(treeMembers.userId, userId),
        ),
      )
      .limit(1);

    if (existingMember) {
      // Revert key status since user is already a member
      await tx
        .update(legacyKeys)
        .set({ status: 'ACTIVE', usedBy: null, usedAt: null })
        .where(eq(legacyKeys.id, key.id));
      throw conflict('You are already a member of this tree');
    }

    // Add user as editor
    await tx.insert(treeMembers).values({
      treeId: key.treeId,
      userId,
      role: 'editor',
    });

    return key;
  });

  // Fetch tree for response (outside transaction — read-only)
  const [tree] = await db
    .select()
    .from(familyTrees)
    .where(eq(familyTrees.id, result.treeId))
    .limit(1);

  logger.info('Legacy key redeemed', {
    keyId: result.id,
    treeId: result.treeId,
    userId,
  });

  return {
    tree: sanitizeTree(tree, 'editor'),
    key: sanitizeLegacyKey(result),
  };
}

/**
 * Revoke a legacy key (creator only).
 * Only ACTIVE keys can be revoked.
 * @param {string} keyId
 * @param {string} userId
 */
export async function revokeLegacyKey(keyId, userId) {
  const [key] = await db
    .select()
    .from(legacyKeys)
    .where(eq(legacyKeys.id, keyId))
    .limit(1);

  if (!key) {
    throw notFound('Legacy key');
  }

  if (key.createdBy !== userId) {
    throw forbidden('You can only revoke keys you created');
  }

  if (key.status !== 'ACTIVE') {
    throw badRequest(`Cannot revoke a key with status "${key.status}"`);
  }

  await db
    .update(legacyKeys)
    .set({ status: 'REVOKED' })
    .where(eq(legacyKeys.id, keyId));

  logger.info('Legacy key revoked', {
    keyId,
    treeId: key.treeId,
    userId,
  });
}
