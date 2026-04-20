'use strict';

const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const logger     = require('../utils/logger');

let io;

/**
 * Initialise Socket.io on the HTTP server.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL === '*' ? true : (process.env.CLIENT_URL || '*'),
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // ── JWT Authentication middleware ──────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication error: token missing'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (user ${socket.userId})`);

    // Join user-specific room to receive their alerts
    socket.join(`user:${socket.userId}`);

    // Subscribe to a specific animal's updates
    socket.on('subscribe-animal', ({ animalId }) => {
      if (animalId) {
        socket.join(`animal:${animalId}`);
        logger.debug(`Socket ${socket.id} subscribed to animal:${animalId}`);
      }
    });

    socket.on('unsubscribe-animal', ({ animalId }) => {
      if (animalId) socket.leave(`animal:${animalId}`);
    });

    socket.on('error', (err) => {
      logger.error(`Socket error (${socket.id}):`, err.message);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    });
  });

  return io;
}

/**
 * Get the Socket.io instance (must call initSocket first).
 */
function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// ── Batch Update Store ──────────────────────────────────────
const positionBatch = new Map(); // userId -> Map(animalId -> data)
let batchInterval;

/**
 * Emit a position update to subscribers of an animal.
 * Now Batched: Collects updates and sends them every 500ms
 */
function emitPositionUpdate(userId, animalId, data) {
  if (!io) return;

  // 1. Direct subscription update (legacy / high priority)
  io.to(`animal:${animalId}`).emit('position-update', { animalId, ...data });

  // 2. Add to batch for dashboard/global views
  if (!positionBatch.has(userId)) {
    positionBatch.set(userId, new Map());
  }
  positionBatch.get(userId).set(animalId, { animalId, ...data });

  // 3. Start batch loop if not running
  if (!batchInterval) {
    batchInterval = setInterval(() => {
      positionBatch.forEach((updates, uId) => {
        if (updates.size > 0) {
          io.to(`user:${uId}`).emit('batch-position-update', Array.from(updates.values()));
          updates.clear();
        }
      });
    }, 500);
  }
}

/**
 * Emit an alert to the animal's owner (by userId).
 */
function emitAlert(userId, animalId, alertData) {
  if (!io) return;
  io.to(`user:${userId}`).emit('alert-triggered', { animalId, ...alertData });
  io.to(`animal:${animalId}`).emit('alert-triggered', { animalId, ...alertData });
}

/**
 * Emit an animal status change.
 */
function emitStatusChange(userId, animalId, status) {
  if (!io) return;
  io.to(`user:${userId}`).emit('animal-status-change', { animalId, status });
}

module.exports = {
  initSocket,
  getIO,
  emitPositionUpdate,
  emitAlert,
  emitStatusChange
};
