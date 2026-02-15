import { verifyAccessToken } from '../utils/tokens.js';
import { verifyTreeAccess } from '../utils/treeAccess.js';
import { db } from '../config/database.js';
import { stories } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory rate limit per userId (persists across reconnects)
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitByUser = new Map();

/**
 * Rate limiter keyed by userId (not socket).
 * Persists across reconnects within the same window.
 * @param {string} userId
 * @returns {boolean} true if allowed
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitByUser.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitByUser.set(userId, { count: 1, windowStart: now });
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

/**
 * Set up Socket.io comment handlers.
 * - JWT auth middleware on handshake
 * - story:join / story:leave for room management
 * @param {import('socket.io').Server} io
 */
export function setupCommentHandlers(io) {
  // ── Auth middleware: verify JWT on connection ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.user = { userId: payload.userId, email: payload.email };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ──
  io.on('connection', (socket) => {
    logger.info('WebSocket connected', {
      userId: socket.user.userId,
      socketId: socket.id,
    });

    // story:join — join a story room (requires tree viewer access)
    socket.on('story:join', async ({ storyId } = {}) => {
      try {
        // Rate limit by userId
        if (!checkRateLimit(socket.user.userId)) {
          logger.warn('WebSocket rate limit exceeded', {
            userId: socket.user.userId,
            socketId: socket.id,
            event: 'story:join',
          });
          socket.emit('story:error', { message: 'Too many requests' });
          return;
        }

        // Validate UUID
        if (!storyId || !UUID_RE.test(storyId)) {
          socket.emit('story:error', { message: 'Invalid story ID' });
          return;
        }

        // Fetch story to get treeId
        const [story] = await db
          .select({ id: stories.id, treeId: stories.treeId })
          .from(stories)
          .where(eq(stories.id, storyId))
          .limit(1);

        if (!story) {
          socket.emit('story:error', { message: 'Story not found' });
          return;
        }

        // Verify tree access
        await verifyTreeAccess(story.treeId, socket.user.userId, 'viewer');

        // Join room
        socket.join(storyId);
        socket.emit('story:joined', { storyId });

        logger.debug('WebSocket joined story room', {
          userId: socket.user.userId,
          storyId,
        });
      } catch (err) {
        logger.warn('WebSocket story:join failed', {
          userId: socket.user.userId,
          storyId,
          error: err.message,
        });
        socket.emit('story:error', {
          message: err.isOperational ? err.message : 'Access denied',
        });
      }
    });

    // story:leave — leave a story room
    socket.on('story:leave', ({ storyId } = {}) => {
      if (storyId && UUID_RE.test(storyId)) {
        socket.leave(storyId);
        logger.debug('WebSocket left story room', {
          userId: socket.user.userId,
          storyId,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug('WebSocket disconnected', {
        userId: socket.user.userId,
        socketId: socket.id,
        reason,
      });
    });
  });
}
