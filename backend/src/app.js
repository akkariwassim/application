'use strict'; // Triggering restart after .env change


const express        = require('express');
const http           = require('http');
const cors           = require('cors');
const helmet         = require('helmet');
const compression    = require('compression');
const morgan         = require('morgan');
const rateLimit      = require('express-rate-limit');
require('dotenv').config();

const logger         = require('./utils/logger');
const { initSocket } = require('./config/socket');
const connectDB     = require('./config/mongoose');

// Routes
const authRoutes      = require('./routes/auth');
const animalsRoutes   = require('./routes/animals');
const positionsRoutes = require('./routes/positions');
const alertsRoutes    = require('./routes/alerts');
const geofencesRoutes = require('./routes/geofences');
const userRoutes      = require('./routes/user');
const devicesRoutes    = require('./routes/devices');
const aiRoutes         = require('./routes/ai');
const statsRoutes      = require('./routes/stats');
const membershipRoutes = require('./routes/membership');
const backupRoutes     = require('./routes/backups');

// Middleware
const errorHandler   = require('./middleware/errorHandler');

const app  = express();
const server = http.createServer(app);

// ── Global Error Traps (IOT Reliability) ──────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ── Security ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL === '*' ? true : (process.env.CLIENT_URL || '*'),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

// ── DATA AUDIT LOGGING ─────────────────────────────────────────
app.use((req, res, next) => {
  const body = { ...req.body };
  if (body.password) body.password = '********';
  
  logger.info(`[Data Audit] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    body: Object.keys(body).length ? body : undefined
  });
  next();
});

// ── Rate limiting (DISABLED FOR DEBUG) ─────────────────────────
/*
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);
*/

// ── Body parsing & compression ─────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP logging ───────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) }
}));

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/animals',   animalsRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/alerts',    alertsRoutes);
app.use('/api/geofences', geofencesRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/devices',   devicesRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/stats',     statsRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/backups',     backupRoutes);

// ── 404 handler ────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 - ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found (DEBUG V1)' });
});

// ── Global error handler ───────────────────────────────────────
app.use(errorHandler);

// ── Socket.io ─────────────────────────────────────────────────
initSocket(server);

// ── Start ──────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3000;

async function start() {
  await connectDB();
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server };