import { eq, asc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { comments, stories } from '../db/schema.js';
import { notFound, forbidden } from '../utils/errors.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { sanitizeComment } from '../utils/sanitize.js';
import { getIO } from '../websocket/io.js';
import logger from '../utils/logger.js';

const MAX_COMMENTS_PER_STORY = 100;

/**
 * Get comments for a story, ordered by creation date (oldest first).
 * Limited to the most recent MAX_COMMENTS_PER_STORY to prevent unbounded queries.
 * @param {string} storyId
 * @returns {Promise<object[]>} Sanitized comment objects
 */
export async function getStoryComments(storyId) {
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.storyId, storyId))
    .orderBy(asc(comments.createdAt))
    .limit(MAX_COMMENTS_PER_STORY);

  return rows.map(sanitizeComment);
}

/**
 * Create a comment on a story.
 * Verifies that the story exists and the user has viewer access to the tree.
 * Emits 'comment:new' via WebSocket to all clients in the story room.
 * @param {string} storyId
 * @param {string} userId
 * @param {string} content
 * @returns {Promise<object>} Sanitized comment
 */
export async function createComment(storyId, userId, content) {
  // Verify story exists
  const [story] = await db
    .select({ id: stories.id, treeId: stories.treeId })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) {
    throw notFound('Story');
  }

  // Verify user has access to the tree (any viewer can comment)
  await verifyTreeAccess(story.treeId, userId, 'viewer');

  // Insert comment
  const [created] = await db
    .insert(comments)
    .values({
      storyId,
      authorId: userId,
      content,
    })
    .returning();

  const sanitized = sanitizeComment(created);

  // Broadcast to story room via WebSocket
  try {
    getIO().to(storyId).emit('comment:new', sanitized);
  } catch {
    // WebSocket emit is non-critical — log and continue
    logger.warn('Failed to emit comment:new via WebSocket', { storyId });
  }

  logger.info('Comment created', {
    commentId: created.id,
    storyId,
    userId,
  });

  return sanitized;
}

/**
 * Delete a comment (author only).
 * Emits 'comment:deleted' via WebSocket to all clients in the story room.
 * @param {string} commentId
 * @param {string} userId
 */
export async function deleteComment(commentId, userId) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment) {
    throw notFound('Comment');
  }

  if (comment.authorId !== userId) {
    throw forbidden('You can only delete your own comments');
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  // Broadcast deletion to story room via WebSocket
  try {
    getIO().to(comment.storyId).emit('comment:deleted', {
      commentId,
      storyId: comment.storyId,
    });
  } catch {
    logger.warn('Failed to emit comment:deleted via WebSocket', {
      commentId,
      storyId: comment.storyId,
    });
  }

  logger.info('Comment deleted', {
    commentId,
    storyId: comment.storyId,
    userId,
  });
}
