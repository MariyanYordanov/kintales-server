import archiver from 'archiver';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  familyTrees,
  relatives,
  relationships,
  photos,
  audioRecordings,
  stories,
  storyAttachments,
  comments,
  deathRecords,
  commemorations,
} from '../db/schema.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { notFound, badRequest } from '../utils/errors.js';
import {
  sanitizeRelative,
  sanitizeRelationship,
  sanitizeStory,
  sanitizeComment,
} from '../utils/sanitize.js';
import { getFileStream, BUCKETS } from './storage.service.js';
import logger from '../utils/logger.js';

const MAX_EXPORT_FILES = 10_000;

/**
 * Extract file extension from an object key (e.g. "abc-123.webp" → "webp").
 * Falls back to "bin" if no extension found.
 * @param {string} objectKey
 * @returns {string}
 */
function getExtension(objectKey) {
  const dot = objectKey.lastIndexOf('.');
  return dot !== -1 ? objectKey.slice(dot + 1) : 'bin';
}

/**
 * Sanitize a tree name for use in Content-Disposition filename.
 * Strips control chars, special chars, and limits length.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFileName(name) {
  return name
    .replace(/[\r\n\t]/g, '')
    .replace(/[^a-zA-Z0-9\u0400-\u04FF _-]/g, '')
    .trim()
    .slice(0, 50) || 'tree';
}

/**
 * Export an entire family tree as a streaming ZIP archive.
 * Streams directly to the Express response — no temp files.
 * Sensitive fields (causeOfDeath, createdBy, etc.) are stripped via sanitize functions.
 *
 * @param {string} treeId
 * @param {string} userId
 * @param {import('express').Response} res
 */
export async function exportTreeAsZip(treeId, userId, res) {
  // Verify editor+ access
  await verifyTreeAccess(treeId, userId, 'editor');

  // Fetch tree metadata
  const [tree] = await db
    .select()
    .from(familyTrees)
    .where(eq(familyTrees.id, treeId))
    .limit(1);

  if (!tree) {
    throw notFound('Tree');
  }

  // Fetch all tree data in parallel
  const [
    treeRelatives,
    treeRelationships,
    treePhotos,
    treeAudio,
    treeStories,
    treeAttachments,
    treeComments,
    treeDeathRecords,
    treeComms,
  ] = await Promise.all([
    db.select().from(relatives).where(eq(relatives.treeId, treeId)),
    db.select().from(relationships).where(eq(relationships.treeId, treeId)),
    fetchTreePhotos(treeId),
    fetchTreeAudio(treeId),
    db.select().from(stories).where(eq(stories.treeId, treeId)),
    fetchTreeStoryAttachments(treeId),
    fetchTreeComments(treeId),
    fetchTreeDeathRecords(treeId),
    fetchTreeComms(treeId),
  ]);

  // Check file count limit (prevent resource exhaustion)
  const totalFiles =
    treeRelatives.filter((r) => r.avatarUrl).length +
    treePhotos.length +
    treeAudio.length +
    treeAttachments.length;

  if (totalFiles > MAX_EXPORT_FILES) {
    throw badRequest(
      `Tree has too many files to export (${totalFiles}, max ${MAX_EXPORT_FILES})`,
    );
  }

  // Build JSON data manifest (sanitized — no sensitive fields)
  const treeData = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    tree: {
      id: tree.id,
      name: tree.name,
      createdAt: tree.createdAt,
    },
    relatives: treeRelatives.map(sanitizeRelative),
    relationships: treeRelationships.map(sanitizeRelationship),
    photos: treePhotos,
    audioRecordings: treeAudio,
    stories: treeStories.map((s) => sanitizeStory(s)),
    storyAttachments: treeAttachments,
    comments: treeComments.map(sanitizeComment),
    deathRecords: treeDeathRecords,
    commemorations: treeComms,
  };

  // Sanitize tree name for filename
  const safeName = sanitizeFileName(tree.name);

  // Set response headers before streaming
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="KinTales-${safeName}.zip"`,
  );

  // Create ZIP archive (streaming, medium compression)
  const archive = archiver('zip', { zlib: { level: 5 } });

  archive.on('warning', (err) => {
    logger.warn('Archive warning', { treeId, error: err.message });
  });

  archive.on('error', (err) => {
    logger.error('Archive error', { treeId, error: err.message });
    archive.abort();
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'EXPORT_FAILED', message: 'Export failed' } });
    } else {
      res.destroy();
    }
  });

  // Pipe archive to response
  archive.pipe(res);

  try {
    // 1. Add JSON manifest
    archive.append(JSON.stringify(treeData, null, 2), { name: 'tree-data.json' });

    // 2. Stream media files from MinIO
    // Avatars (from relatives)
    for (const rel of treeRelatives) {
      if (rel.avatarUrl) {
        const stream = await getFileStream(BUCKETS.AVATARS, rel.avatarUrl);
        if (stream) {
          archive.append(stream, { name: `avatars/${rel.id}.${getExtension(rel.avatarUrl)}` });
        } else {
          logger.warn('Avatar missing during export', { treeId, relativeId: rel.id });
        }
      }
    }

    // Photos
    for (const photo of treePhotos) {
      if (photo.fileUrl) {
        const stream = await getFileStream(BUCKETS.PHOTOS, photo.fileUrl);
        if (stream) {
          archive.append(stream, { name: `photos/${photo.id}.${getExtension(photo.fileUrl)}` });
        } else {
          logger.warn('Photo missing during export', { treeId, photoId: photo.id });
        }
      }
    }

    // Audio recordings
    for (const audio of treeAudio) {
      if (audio.fileUrl) {
        const stream = await getFileStream(BUCKETS.AUDIO, audio.fileUrl);
        if (stream) {
          archive.append(stream, { name: `audio/${audio.id}.${getExtension(audio.fileUrl)}` });
        } else {
          logger.warn('Audio missing during export', { treeId, audioId: audio.id });
        }
      }
    }

    // Story attachments
    for (const att of treeAttachments) {
      if (att.fileUrl) {
        const bucket = att.fileType === 'audio' ? BUCKETS.AUDIO : BUCKETS.PHOTOS;
        const stream = await getFileStream(bucket, att.fileUrl);
        if (stream) {
          archive.append(stream, {
            name: `story-attachments/${att.id}.${getExtension(att.fileUrl)}`,
          });
        } else {
          logger.warn('Attachment missing during export', { treeId, attachmentId: att.id });
        }
      }
    }

    // Finalize
    await archive.finalize();

    logger.info('Tree exported as ZIP', { treeId, userId, totalFiles });
  } catch (err) {
    logger.error('Export streaming failed', { treeId, error: err.message });
    archive.abort();
    if (!res.headersSent) {
      throw err;
    }
  }
}

// ── Helper queries (indirect relations via relatives/stories) ─────

async function fetchTreePhotos(treeId) {
  return db
    .select({
      id: photos.id,
      relativeId: photos.relativeId,
      fileUrl: photos.fileUrl,
      caption: photos.caption,
      dateTakenYear: photos.dateTakenYear,
      dateTakenMonth: photos.dateTakenMonth,
      dateTakenDay: photos.dateTakenDay,
      sortOrder: photos.sortOrder,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .innerJoin(relatives, eq(photos.relativeId, relatives.id))
    .where(eq(relatives.treeId, treeId));
}

async function fetchTreeAudio(treeId) {
  return db
    .select({
      id: audioRecordings.id,
      relativeId: audioRecordings.relativeId,
      title: audioRecordings.title,
      fileUrl: audioRecordings.fileUrl,
      durationSeconds: audioRecordings.durationSeconds,
      createdAt: audioRecordings.createdAt,
    })
    .from(audioRecordings)
    .innerJoin(relatives, eq(audioRecordings.relativeId, relatives.id))
    .where(eq(relatives.treeId, treeId));
}

async function fetchTreeStoryAttachments(treeId) {
  return db
    .select({
      id: storyAttachments.id,
      storyId: storyAttachments.storyId,
      fileUrl: storyAttachments.fileUrl,
      fileType: storyAttachments.fileType,
      caption: storyAttachments.caption,
      sortOrder: storyAttachments.sortOrder,
      createdAt: storyAttachments.createdAt,
    })
    .from(storyAttachments)
    .innerJoin(stories, eq(storyAttachments.storyId, stories.id))
    .where(eq(stories.treeId, treeId));
}

async function fetchTreeComments(treeId) {
  return db
    .select({
      id: comments.id,
      storyId: comments.storyId,
      authorId: comments.authorId,
      content: comments.content,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(stories, eq(comments.storyId, stories.id))
    .where(eq(stories.treeId, treeId));
}

async function fetchTreeDeathRecords(treeId) {
  return db
    .select({
      id: deathRecords.id,
      relativeId: deathRecords.relativeId,
      deathYear: deathRecords.deathYear,
      deathMonth: deathRecords.deathMonth,
      deathDay: deathRecords.deathDay,
      status: deathRecords.status,
      createdAt: deathRecords.createdAt,
    })
    .from(deathRecords)
    .innerJoin(relatives, eq(deathRecords.relativeId, relatives.id))
    .where(eq(relatives.treeId, treeId));
}

async function fetchTreeComms(treeId) {
  return db
    .select({
      id: commemorations.id,
      relativeId: commemorations.relativeId,
      type: commemorations.type,
      commDate: commemorations.commDate,
      createdAt: commemorations.createdAt,
    })
    .from(commemorations)
    .innerJoin(relatives, eq(commemorations.relativeId, relatives.id))
    .where(eq(relatives.treeId, treeId));
}
