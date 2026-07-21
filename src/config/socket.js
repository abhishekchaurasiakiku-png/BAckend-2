import { Server } from 'socket.io';
import env from './env.js';
import { socketAuth } from '../socket/middleware/socketAuth.js';
import { registerMessageHandlers } from '../socket/handlers/messageHandler.js';
import { registerTypingHandlers } from '../socket/handlers/typingHandler.js';
import { registerPresenceHandlers } from '../socket/handlers/presenceHandler.js';

/**
 * Initialize Socket.IO server and attach to HTTP server
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 10000,
    transports: ['websocket', 'polling'],
  });

  // Authenticate WebSocket connections via JWT
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userName = socket.user.name;
    console.log(`🔌 User connected: ${userName} (${userId}) — socket: ${socket.id}`);

    // Register event handlers
    registerPresenceHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${userName} (${userId}) — reason: ${reason}`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}
