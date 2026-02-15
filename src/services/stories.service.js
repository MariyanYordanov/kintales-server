import { eq, desc, sql, asc, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { stories, storyAttachments, relatives } from '../db/schema.js';
import { notFound, badRequest, forbidden } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { verifyMimeType } from '../utils/mimeVerify.js';
import { scanFileBuffer } from './virusScan.service.js';
import { uploadFile, getPresignedUrl, deleteFile, BUCKETS } from './storage.service.js';
import { sanitizeStory, sanitizeAttachment } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'];
const ALL_ALLOWED_MIMES = [...PHOTO_MIMES, ...AUDIO_MIMES];

/**
 * Classify MIME type as 'photo' or 'audio'.
 * @param {string} mime
 * @returns {'photo'|'audio'}
 */
function classifyMime(mime) {
  if (PHOTO_MIMES.includes(mime)) return 'photo';
  if (AUDIO_MIMES.includes(mime)) return 'audio';
  return 'photo'; // fallback — verifyMimeType already validates
}

/**
 * Get the MinIO bucket for a given attachment file type.
 * @param {'photo'|'audio'} fileType
 * @returns {string}
 */
function getBucketForType(fileType) {
  return fileType === 'audio' ? BUCKETS.AUDIO : BUCKETS.PHOTOS;
}

// ──────────────────────────────────────────────────────────
// Attachment helpers
// ──────────────────────────────────────────────────────────

/**
 * Load attachments for a story and generate presigned URLs.
 * @param {string} storyId
 * @returns {Promise<object[]>} Sanitized attachment objects
 */
async function loadAttachments(storyId) {
  const rows = await db
    .select()
    .from(storyAttachments)
    .where(eq(storyAttachments.storyId, storyId))
    .orderBy(asc(storyAttachments.sortOrder), asc(storyAttachments.createdAt));

  return Promise.all(
    rows.map(async (att) => {
      const bucket = getBucketForType(att.fileType);
      const url = await getPresignedUrl(bucket, att.fileUrl);
      return sanitizeAttachment(att, url);
    }),
  );
}

/**
 * Process and upload attachment files to MinIO.
 * Returns metadata for DB insertion. On failure, rolls back all uploaded files.
 * @param {{ buffer: Buffer, originalname: string }[]} files
 * @returns {Promise<{ objectKey: string, fileType: string, mime: string }[]>}
 */
async function processAttachmentFiles(files) {
  const uploadedKeys = [];

  try {
    const results = [];

    for (const file of files) {
      // 1. Verify MIME via magic bytes
      const { mime, ext } = await verifyMimeType(file.buffer, ALL_ALLOWED_MIMES, file.originalname);

      // 2. Virus scan
      await scanFileBuffer(file.buffer, file.originalname);

      // 3. Classify and upload to correct bucket
      const fileType = classifyMime(mime);
      const bucket = getBucketForType(fileType);
      const objectKey = await uploadFile(bucket, file.buffer, ext, mime);
      uploadedKeys.push({ objectKey, bucket });

      results.push({ objectKey, fileType, mime });
    }

    return results;
  } catch (err) {
    // Rollback all uploaded files
    await Promise.all(
      uploadedKeys.map(({ objectKey, bucket }) => deleteFile(bucket, objectKey)),
    );
    throw err;
  }
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

/**
 * Get paginated stories for a tree.
 * @param {string} treeId
 * @param {number} [page=1]
 * @param {number} [limit=20]
 * @returns {Promise<{ stories: object[], meta: object }>}
 */
export async function getTreeStories(treeId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  // Parallel: count + page query
  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(stories)
      .where(eq(stories.treeId, treeId)),
    db
      .select()
      .from(stories)
      .where(eq(stories.treeId, treeId))
      .orderBy(desc(stories.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;

  // Batch load all attachments for the page (avoids N+1 queries)
  const storyIds = rows.map((s) => s.id);
  const allAttachments = storyIds.length > 0
    ? await db
        .select()
        .from(storyAttachments)
        .where(inArray(storyAttachments.storyId, storyIds))
        .orderBy(asc(storyAttachments.sortOrder), asc(storyAttachments.createdAt))
    : [];

  // Group attachments by storyId
  const attachmentsByStory = new Map();
  for (const att of allAttachments) {
    if (!attachmentsByStory.has(att.storyId)) {
      attachmentsByStory.set(att.storyId, []);
    }
    attachmentsByStory.get(att.storyId).push(att);
  }

  // Generate presigned URLs and sanitize
  const sanitized = await Promise.all(
    rows.map(async (story) => {
      const atts = attachmentsByStory.get(story.id) || [];
      const sanitizedAtts = await Promise.all(
        atts.map(async (att) => {
          const bucket = getBucketForType(att.fileType);
          const url = await getPresignedUrl(bucket, att.fileUrl);
          return sanitizeAttachment(att, url);
        }),
      );
      return sanitizeStory(story, sanitizedAtts);
    }),
  );

  return {
    stories: sanitized,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Create a new story with optional attachments.
 * Pipeline: verifyTreeAccess → validate relativeId → process files → DB transaction
 * @param {string} treeId
 * @param {string} userId
 * @param {{ content: string, relativeId?: string }} data
 * @param {{ buffer: Buffer, originalname: string }[]} [files=[]]
 * @returns {Promise<object>} Sanitized story with attachments
 */
export async function createStory(treeId, userId, data, files = []) {
  await verifyTreeAccess(treeId, userId, 'editor');

  // Validate relativeId belongs to this tree (if provided)
  if (data.relativeId) {
    const [relative] = await db
      .select({ id: relatives.id, treeId: relatives.treeId })
      .from(relatives)
      .where(eq(relatives.id, data.relativeId))
      .limit(1);

    if (!relative) {
      throw notFound('Relative');
    }
    if (relative.treeId !== treeId) {
      throw badRequest('Relative does not belong to this tree');
    }
  }

  // Process attachment files (verify + scan + upload to MinIO)
  const uploadedFiles = files.length > 0 ? await processAttachmentFiles(files) : [];

  try {
    // DB transaction: insert story + attachments
    const created = await db.transaction(async (tx) => {
      const [story] = await tx
        .insert(stories)
        .values({
          treeId,
          relativeId: data.relativeId ?? null,
          authorId: userId,
          content: data.content,
        })
        .returning();

      if (uploadedFiles.length > 0) {
        await tx.insert(storyAttachments).values(
          uploadedFiles.map((f, i) => ({
            storyId: story.id,
            fileUrl: f.objectKey,
            fileType: f.fileType,
            sortOrder: i,
          })),
        );
      }

      return story;
    });

    logger.info('Story created', {
      storyId: created.id,
      treeId,
      userId,
      attachments: uploadedFiles.length,
    });

    const attachments = await loadAttachments(created.id);
    return sanitizeStory(created, attachments);
  } catch (err) {
    // Rollback MinIO uploads on DB failure
    await Promise.all(
      uploadedFiles.map((f) => deleteFile(getBucketForType(f.fileType), f.objectKey)),
    );
    throw err;
  }
}

/**
 * Get a single story by ID with attachments.
 * @param {string} storyId
 * @param {string} userId
 * @returns {Promise<object>} Sanitized story with attachments
 */
export async function getStoryById(storyId, userId) {
  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) {
    throw notFound('Story');
  }

  await verifyTreeAccess(story.treeId, userId, 'viewer');

  const attachments = await loadAttachments(storyId);
  return sanitizeStory(story, attachments);
}

/**
 * Update a story (author only).
 * @param {string} storyId
 * @param {string} userId
 * @param {{ content?: string, relativeId?: string|null }} data
 * @returns {Promise<object>} Sanitized updated story with attachments
 */
export async function updateStory(storyId, userId, data) {
  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) {
    throw notFound('Story');
  }

  if (story.authorId !== userId) {
    throw forbidden('You can only update your own stories');
  }

  // Validate relativeId belongs to this tree (if changing)
  if (data.relativeId !== undefined && data.relativeId !== null) {
    const [check] = await db
      .select({ treeId: relatives.treeId })
      .from(relatives)
      .where(eq(relatives.id, data.relativeId))
      .limit(1);

    if (!check) {
      throw notFound('Relative');
    }
    if (check.treeId !== story.treeId) {
      throw badRequest('Relative does not belong to this tree');
    }
  }

  // Build update fields
  const updateFields = { updatedAt: new Date() };
  if (data.content !== undefined) updateFields.content = data.content;
  if (data.relativeId !== undefined) updateFields.relativeId = data.relativeId;

  const [updated] = await db
    .update(stories)
    .set(updateFields)
    .where(eq(stories.id, storyId))
    .returning();

  logger.info('Story updated', { storyId, userId });

  const attachments = await loadAttachments(storyId);
  return sanitizeStory(updated, attachments);
}

/**
 * Delete a story and its attachments (author only).
 * Removes files from MinIO after DB deletion.
 * @param {string} storyId
 * @param {string} userId
 */
export async function deleteStory(storyId, userId) {
  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) {
    throw notFound('Story');
  }

  if (story.authorId !== userId) {
    throw forbidden('You can only delete your own stories');
  }

  // Load attachments BEFORE deletion (need file URLs for MinIO cleanup)
  const attachmentRows = await db
    .select({ fileUrl: storyAttachments.fileUrl, fileType: storyAttachments.fileType })
    .from(storyAttachments)
    .where(eq(storyAttachments.storyId, storyId));

  // Delete story (cascade removes attachment rows)
  await db.delete(stories).where(eq(stories.id, storyId));

  // Delete files from MinIO (non-fatal)
  await Promise.all(
    attachmentRows.map((att) =>
      deleteFile(getBucketForType(att.fileType), att.fileUrl),
    ),
  );

  logger.info('Story deleted', {
    storyId,
    treeId: story.treeId,
    userId,
    attachmentsRemoved: attachmentRows.length,
  });
}
