import * as presenceService from '../../services/presenceService.js';

/**
 * Register typing indicator WebSocket event handlers
 */
export function registerTypingHandlers(io, socket) {
  const userId = socket.user.id;
  const userName = socket.user.name;

  /**
   * typing:start — User started typing in a conversation
   * Payload: { conversationId }
   */
  socket.on('typing:start', async (data) => {
    try {
      const { conversationId } = data;

      if (!conversationId) return;

      // Set typing status in Redis (auto-expires in 5s)
      await presenceService.setTyping(userId, conversationId, true);

      // Broadcast to conversation room (except sender)
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName,
        isTyping: true,
      });
    } catch (error) {
      console.error('typing:start error:', error.message);
    }
  });

  /**
   * typing:stop — User stopped typing
   * Payload: { conversationId }
   */
  socket.on('typing:stop', async (data) => {
    try {
      const { conversationId } = data;

      if (!conversationId) return;

      // Clear typing status
      await presenceService.setTyping(userId, conversationId, false);

      // Broadcast to conversation room
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName,
        isTyping: false,
      });
    } catch (error) {
      console.error('typing:stop error:', error.message);
    }
  });
}
