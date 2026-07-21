import * as messageService from '../../services/messageService.js';
import * as deliveryService from '../../services/deliveryService.js';
import prisma from '../../config/database.js';

/**
 * Register message-related WebSocket event handlers
 */
export function registerMessageHandlers(io, socket) {
  const userId = socket.user.id;

  /**
   * message:send — Client sends a new message
   * Payload: { conversationId, content, clientMessageId }
   */
  socket.on('message:send', async (data, callback) => {
    try {
      const { conversationId, content, clientMessageId } = data;

      if (!conversationId || !content?.trim()) {
        return callback?.({ error: 'conversationId and content are required' });
      }

      // Create message in DB
      const message = await messageService.createMessage({
        conversationId,
        senderId: userId,
        content: content.trim(),
      });

      const serializedMessage = {
        ...message,
        id: message.id.toString(),
      };

      // Confirm to sender (sent acknowledgment)
      socket.emit('message:sent', {
        clientMessageId,
        messageId: serializedMessage.id,
        createdAt: message.createdAt,
      });

      // Deliver to all other members
      await deliveryService.deliverMessage(io, serializedMessage, userId);

      callback?.({ success: true, messageId: serializedMessage.id });
    } catch (error) {
      console.error('message:send error:', error.message);
      callback?.({ error: error.message });
    }
  });

  /**
   * message:delivered — Client acknowledges message delivery
   * Payload: { messageId }
   */
  socket.on('message:delivered', async (data) => {
    try {
      const { messageId } = data;

      await messageService.markDelivered({ messageId, userId });

      // Find the original sender to notify them
      const message = await prisma.message.findUnique({
        where: { id: BigInt(messageId) },
        select: { senderId: true },
      });

      if (message) {
        deliveryService.broadcastDeliveryReceipt(io, {
          messageId,
          userId,
          deliveredAt: new Date(),
          senderId: message.senderId,
        });
      }
    } catch (error) {
      console.error('message:delivered error:', error.message);
    }
  });

  /**
   * message:read — Client marks messages as read
   * Payload: { conversationId, messageId }
   */
  socket.on('message:read', async (data) => {
    try {
      const { conversationId, messageId } = data;

      const result = await messageService.markRead({
        conversationId,
        messageId,
        userId,
      });

      if (result.count > 0) {
        // Notify all senders in the conversation about read receipts
        const members = await prisma.conversationMember.findMany({
          where: {
            conversationId,
            userId: { not: userId },
          },
          select: { userId: true },
        });

        for (const member of members) {
          deliveryService.broadcastReadReceipt(io, {
            conversationId,
            userId,
            readAt: result.readAt,
            senderId: member.userId,
          });
        }
      }
    } catch (error) {
      console.error('message:read error:', error.message);
    }
  });
}
