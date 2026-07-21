import * as presenceService from '../../services/presenceService.js';
import prisma from '../../config/database.js';

/**
 * Register presence (online/offline) WebSocket event handlers
 */
export function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;

  // ─── On Connect ─────────────────────────────────────
  handleConnect(io, socket, userId);

  // ─── Heartbeat ──────────────────────────────────────
  socket.on('presence:ping', () => {
    // Extend online status (no-op in current impl, but useful for future TTL-based presence)
    socket.emit('presence:pong', { timestamp: Date.now() });
  });

  // ─── On Disconnect ──────────────────────────────────
  socket.on('disconnect', () => {
    handleDisconnect(io, socket, userId);
  });
}

/**
 * Handle user coming online
 */
async function handleConnect(io, socket, userId) {
  try {
    // Mark online in Redis
    await presenceService.setOnline(userId, 'main');

    // Join personal room (for direct message delivery)
    socket.join(`user:${userId}`);

    // Join all conversation rooms
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    for (const m of memberships) {
      socket.join(`conversation:${m.conversationId}`);
    }

    // Broadcast online status to all conversation peers
    const conversationIds = memberships.map(m => m.conversationId);
    for (const convId of conversationIds) {
      socket.to(`conversation:${convId}`).emit('presence:update', {
        userId,
        status: 'online',
        lastSeenAt: null,
      });
    }

    console.log(`👤 ${socket.user.name} is online — joined ${memberships.length} rooms`);
  } catch (error) {
    console.error('Presence connect error:', error.message);
  }
}

/**
 * Handle user going offline
 */
async function handleDisconnect(io, socket, userId) {
  try {
    // Mark offline in Redis
    const lastSeenAt = await presenceService.setOffline(userId);

    // Broadcast offline status to peers
    // (socket.rooms are auto-cleaned on disconnect, so we broadcast via userId lookup)
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    for (const m of memberships) {
      io.to(`conversation:${m.conversationId}`).emit('presence:update', {
        userId,
        status: 'offline',
        lastSeenAt,
      });
    }

    console.log(`👤 ${socket.user.name} is offline — last seen: ${lastSeenAt}`);
  } catch (error) {
    console.error('Presence disconnect error:', error.message);
  }
}
