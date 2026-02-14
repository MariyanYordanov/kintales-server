import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { deathRecords, deathConfirmations, commemorations, relatives, treeMembers } from '../db/schema.js';
import { notFound, badRequest, conflict, forbidden } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { sanitizeDeathRecord } from '../utils/sanitize.js';
import { generateCommemorationDates } from '../utils/commemorations.js';
import logger from '../utils/logger.js';

/**
 * Report a death for a relative.
 * Calculates confirmationsNeeded based on tree member count.
 * @param {object} data - Validated body
 * @param {string} userId - Reporter's user ID
 * @returns {Promise<object>} Sanitized death record
 */
export async function reportDeath(data, userId) {
  // 1. Lookup relative and verify tree access
  const [relative] = await db
    .select({ id: relatives.id, treeId: relatives.treeId, status: relatives.status })
    .from(relatives)
    .where(eq(relatives.id, data.relativeId))
    .limit(1);

  if (!relative) {
    throw notFound('Relative');
  }

  await verifyTreeAccess(relative.treeId, userId, 'editor');

  // 2. Prevent double report — already DECEASED
  if (relative.status === 'DECEASED') {
    throw badRequest('This relative is already marked as deceased');
  }

  // 3. Prevent duplicate PENDING record
  const [existingPending] = await db
    .select({ id: deathRecords.id })
    .from(deathRecords)
    .where(
      and(
        eq(deathRecords.relativeId, data.relativeId),
        eq(deathRecords.status, 'PENDING'),
      ),
    )
    .limit(1);

  if (existingPending) {
    throw conflict('A pending death record already exists for this relative');
  }

  // 4. Count other tree members (excluding reporter)
  const [memberCount] = await db
    .select({ count: sql`count(distinct ${treeMembers.userId})`.mapWith(Number) })
    .from(treeMembers)
    .where(
      and(
        eq(treeMembers.treeId, relative.treeId),
        sql`${treeMembers.userId} != ${userId}`,
      ),
    );

  const otherMembers = memberCount?.count ?? 0;
  let confirmationsNeeded;
  let autoConfirmAt = null;

  if (otherMembers >= 2) {
    confirmationsNeeded = 2;
  } else if (otherMembers === 1) {
    confirmationsNeeded = 1;
  } else {
    confirmationsNeeded = 0;
    autoConfirmAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // NOW + 48h
  }

  // 5. Insert death record
  const [created] = await db
    .insert(deathRecords)
    .values({
      relativeId: data.relativeId,
      reportedBy: userId,
      deathYear: data.deathYear,
      deathMonth: data.deathMonth,
      deathDay: data.deathDay,
      deathTime: data.deathTime,
      causeOfDeath: data.causeOfDeath,
      confirmationsNeeded,
      autoConfirmAt,
    })
    .returning();

  logger.info('Death reported', {
    deathRecordId: created.id,
    relativeId: data.relativeId,
    treeId: relative.treeId,
    confirmationsNeeded,
    autoConfirmAt,
    userId,
  });

  return sanitizeDeathRecord(created, { showCause: true });
}

/**
 * Confirm or dispute a death record.
 * @param {string} deathRecordId
 * @param {string} userId
 * @param {boolean} confirmed - true = confirm, false = dispute
 * @returns {Promise<object>} Updated sanitized death record
 */
export async function confirmDeath(deathRecordId, userId, confirmed) {
  // 1. Lookup death record + relative for treeId
  const [record] = await db
    .select({
      id: deathRecords.id,
      relativeId: deathRecords.relativeId,
      reportedBy: deathRecords.reportedBy,
      status: deathRecords.status,
      confirmationsNeeded: deathRecords.confirmationsNeeded,
      deathYear: deathRecords.deathYear,
      deathMonth: deathRecords.deathMonth,
      deathDay: deathRecords.deathDay,
      deathTime: deathRecords.deathTime,
      causeOfDeath: deathRecords.causeOfDeath,
      autoConfirmAt: deathRecords.autoConfirmAt,
      confirmedAt: deathRecords.confirmedAt,
      createdAt: deathRecords.createdAt,
      treeId: relatives.treeId,
    })
    .from(deathRecords)
    .innerJoin(relatives, eq(deathRecords.relativeId, relatives.id))
    .where(eq(deathRecords.id, deathRecordId))
    .limit(1);

  if (!record) {
    throw notFound('Death record');
  }

  // 2. Verify tree access (any member can confirm)
  const { role } = await verifyTreeAccess(record.treeId, userId, 'viewer');

  // 3. Only PENDING records can be confirmed/disputed
  if (record.status !== 'PENDING') {
    throw badRequest(`Cannot confirm a record with status: ${record.status}`);
  }

  // 4. Reporter cannot confirm their own report
  if (record.reportedBy === userId) {
    throw badRequest('Cannot confirm your own death report');
  }

  // 5. Insert confirmation (UNIQUE constraint prevents duplicates)
  try {
    await db.insert(deathConfirmations).values({
      deathRecordId,
      userId,
      confirmed,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw conflict('You have already responded to this death record');
    }
    throw err;
  }

  // 6. Handle dispute
  if (!confirmed) {
    const [updated] = await db
      .update(deathRecords)
      .set({ status: 'DISPUTED' })
      .where(eq(deathRecords.id, deathRecordId))
      .returning();

    logger.info('Death record disputed', { deathRecordId, userId });

    const showCause = record.reportedBy === userId || role === 'owner';
    return sanitizeDeathRecord(updated, { showCause });
  }

  // 7. Count confirmations and check threshold
  const [confirmCount] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(deathConfirmations)
    .where(
      and(
        eq(deathConfirmations.deathRecordId, deathRecordId),
        eq(deathConfirmations.confirmed, true),
      ),
    );

  const totalConfirms = confirmCount?.count ?? 0;

  if (totalConfirms >= record.confirmationsNeeded) {
    const updated = await finalizeDeathRecord(record);
    const showCause = record.reportedBy === userId || role === 'owner';
    return sanitizeDeathRecord(updated, { showCause });
  }

  // Not enough confirmations yet — return current record
  logger.info('Death confirmation recorded', {
    deathRecordId,
    userId,
    totalConfirms,
    needed: record.confirmationsNeeded,
  });

  const showCause = record.reportedBy === userId || role === 'owner';
  return sanitizeDeathRecord(record, { showCause });
}

/**
 * Finalize a death record: set CONFIRMED, update relative, generate commemorations.
 * Uses a transaction with atomic WHERE status='PENDING' to prevent double-finalization.
 * Shared by manual confirmation and auto-confirm cron job.
 * @param {object} record - Death record (must include id, relativeId, deathYear/Month/Day)
 * @returns {Promise<object>} Updated death record row, or original record if already finalized
 */
export async function finalizeDeathRecord(record) {
  const now = new Date();

  return await db.transaction(async (tx) => {
    // 1. Atomically update ONLY if still PENDING (prevents race conditions)
    const [updated] = await tx
      .update(deathRecords)
      .set({ status: 'CONFIRMED', confirmedAt: now })
      .where(and(eq(deathRecords.id, record.id), eq(deathRecords.status, 'PENDING')))
      .returning();

    if (!updated) {
      // Already finalized by another process — safe to skip
      logger.warn('Death record already finalized, skipping', { deathRecordId: record.id });
      return record;
    }

    // 2. Update relative: mark as DECEASED with death date
    await tx
      .update(relatives)
      .set({
        status: 'DECEASED',
        deathYear: record.deathYear,
        deathMonth: record.deathMonth,
        deathDay: record.deathDay,
      })
      .where(eq(relatives.id, record.relativeId));

    // 3. Generate and insert commemorations (only if full date)
    const commDates = generateCommemorationDates(
      record.deathYear,
      record.deathMonth,
      record.deathDay,
    );

    if (commDates.length > 0) {
      await tx.insert(commemorations).values(
        commDates.map((c) => ({
          relativeId: record.relativeId,
          type: c.type,
          commDate: c.commDate,
        })),
      );
    }

    logger.info('Death record confirmed', {
      deathRecordId: record.id,
      relativeId: record.relativeId,
      commemorations: commDates.length,
    });

    return updated;
  });
}

/**
 * Get all death records for a tree.
 * @param {string} treeId
 * @param {string} userId
 * @returns {Promise<object[]>} Sanitized death records
 */
export async function getTreeDeathRecords(treeId, userId) {
  const { role } = await verifyTreeAccess(treeId, userId, 'viewer');

  const rows = await db
    .select({
      id: deathRecords.id,
      relativeId: deathRecords.relativeId,
      reportedBy: deathRecords.reportedBy,
      deathYear: deathRecords.deathYear,
      deathMonth: deathRecords.deathMonth,
      deathDay: deathRecords.deathDay,
      deathTime: deathRecords.deathTime,
      causeOfDeath: deathRecords.causeOfDeath,
      status: deathRecords.status,
      confirmationsNeeded: deathRecords.confirmationsNeeded,
      autoConfirmAt: deathRecords.autoConfirmAt,
      confirmedAt: deathRecords.confirmedAt,
      createdAt: deathRecords.createdAt,
    })
    .from(deathRecords)
    .innerJoin(relatives, eq(deathRecords.relativeId, relatives.id))
    .where(eq(relatives.treeId, treeId))
    .orderBy(sql`${deathRecords.createdAt} DESC`);

  return rows.map((record) => {
    const showCause = record.reportedBy === userId || role === 'owner';
    return sanitizeDeathRecord(record, { showCause });
  });
}
