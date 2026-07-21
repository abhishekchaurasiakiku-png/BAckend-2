import prisma from '../config/database.js';
import * as presenceService from './presenceService.js';

/**
 * Deliver a message to all recipients in a conversation
 * Handles both same-server and cross-server delivery
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {object} message - The message to deliver
 * @param {string} senderId - The sender's user ID
 */
export async function deliverMessage(io, message, senderId) {
  const conversationId = message.conversationId;

  // Get all members of the conversation except sender
  const members = await prisma.conversationMember.findMany({
    where: {
      conversationId,
      userId: { not: senderId },
    },
    select: { userId: true },
  });

  for (const member of members) {
    const presence = await presenceService.getPresence(member.userId);

    if (presence.status === 'online') {
      // User is online — deliver via WebSocket
      // Emit to the user's personal room (they join room `user:{id}` on connect)
      io.to(`user:${member.userId}`).emit('message:new', message);
    } else {
      // User is offline — queue for push notification
      await queuePushNotification(message, member.userId);
    }
  }
}

/**
 * Queue a push notification for an offline user
 * In v1, this is a placeholder — full FCM integration in Phase 5
 */
async function queuePushNotification(message, recipientId) {
  console.log(`📱 Push notification queued for user ${recipientId}: "${message.content.substring(0, 50)}..."`);

  // TODO (Phase 5): Implement actual push notification via FCM
  // 1. Look up push tokens for recipientId
  // 2. Build notification payload
  // 3. Send via FCM/APNs
}

/**
 * Broadcast delivery receipt to message sender
 */
export async function broadcastDeliveryReceipt(io, { messageId, userId, deliveredAt, senderId }) {
  io.to(`user:${senderId}`).emit('message:delivered_ack', {
    messageId: messageId.toString(),
    userId,
    deliveredAt,
  });
}

/**
 * Broadcast read receipt to message sender
 */
export async function broadcastReadReceipt(io, { conversationId, userId, readAt, senderId }) {
  io.to(`user:${senderId}`).emit('message:read_ack', {
    conversationId,
    userId,
    readAt,
  });
}
