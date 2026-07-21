import express from 'express';
// Trigger nodemon restart to load updated CORS in .env
import http from 'http';
import cors from 'cors';
import env from './config/env.js';
import { initializeSocket } from './config/socket.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

// ─── Express App Setup ─────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Middleware ─────────────────────────────────────────
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// ─── Health Check ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// ─── 404 Handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ───────────────────────────────
app.use(errorHandler);

// ─── Socket.IO ──────────────────────────────────────────
const io = initializeSocket(server);

// Make io accessible to routes/controllers
app.set('io', io);

// ─── Start Server ───────────────────────────────────────
server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🚀 ChatHub Server Running               ║
  ║                                           ║
  ║   🌐 HTTP:   http://localhost:${env.PORT}       ║
  ║   🔌 WS:     ws://localhost:${env.PORT}         ║
  ║   📊 Health: http://localhost:${env.PORT}/health ║
  ║   🌍 Env:    ${env.NODE_ENV.padEnd(27)}║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
});

export { app, server, io };
