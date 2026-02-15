import { Server } from 'socket.io';

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Initialize Socket.io and attach it to the HTTP server.
 * @param {import('node:http').Server} server
 * @param {string[]} corsOrigins - Allowed CORS origins
 * @returns {import('socket.io').Server}
 */
export function initSocketIO(server, corsOrigins) {
  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  return io;
}

/**
 * Get the initialized Socket.io instance.
 * @returns {import('socket.io').Server}
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized — call initSocketIO(server) first');
  }
  return io;
}
