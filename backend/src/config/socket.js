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
  const Membership = require('../models/Membership');

  io.on('connection', async (socket) => {
    logger.info(`Socket connected: ${socket.id} (user ${socket.userId})`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Join rooms for all farms the user belongs to
    try {
      const userFarms = await Membership.find({ user_id: socket.userId, status: 'active' });
      userFarms.forEach(m => {
        socket.join(`farm:${m.farm_id}`);
        logger.debug(`Socket ${socket.id} joined farm:${m.farm_id}`);
      });
    } catch (err) {
      logger.error(`Error joining farm rooms for user ${socket.userId}:`, err.message);
    }

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
const positionBatch = new Map(); // farmId -> Map(animalId -> data)
let batchInterval;

/**
 * Emit a position update to subscribers of an animal.
 */
function emitPositionUpdate(farmId, animalId, data) {
  if (!io) return;

  // 1. Direct subscription update
  io.to(`animal:${animalId}`).emit('position-update', { animalId, ...data });

  // 2. Add to batch for farm dashboard
  if (!positionBatch.has(farmId)) {
    positionBatch.set(farmId, new Map());
  }
  positionBatch.get(farmId).set(animalId, { animalId, ...data });

  // 3. Start batch loop
  if (!batchInterval) {
    batchInterval = setInterval(() => {
      positionBatch.forEach((updates, fId) => {
        if (updates.size > 0) {
          io.to(`farm:${fId}`).emit('batch-position-update', Array.from(updates.values()));
          updates.clear();
        }
      });
    }, 500);
  }
}

/**
 * Emit an alert to the farm.
 */
function emitAlert(farmId, animalId, alertData) {
  if (!io) return;
  io.to(`farm:${farmId}`).emit('alert-triggered', { animalId, ...alertData });
  io.to(`animal:${animalId}`).emit('alert-triggered', { animalId, ...alertData });
}

/**
 * Emit an animal status change.
 */
function emitStatusChange(farmId, animalId, status) {
  if (!io) return;
  io.to(`farm:${farmId}`).emit('animal-status-change', { animalId, status });
}

module.exports = {
  initSocket,
  getIO,
  emitPositionUpdate,
  emitAlert,
  emitStatusChange
};
