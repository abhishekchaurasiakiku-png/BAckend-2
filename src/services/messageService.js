import prisma from '../config/database.js';

/**
 * Create a new message in a conversation
 */
export async function createMessage({ conversationId, senderId, content }) {
  // Verify sender is a member of the conversation
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!membership) {
    const error = new Error('You are not a member of this conversation');
    error.status = 403;
    throw error;
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  // Update conversation's updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Create message receipts for all other members
  const otherMembers = await prisma.conversationMember.findMany({
    where: {
      conversationId,
      userId: { not: senderId },
    },
    select: { userId: true },
  });

  if (otherMembers.length > 0) {
    await prisma.messageReceipt.createMany({
      data: otherMembers.map(m => ({
        messageId: message.id,
        userId: m.userId,
      })),
    });
  }

  return message;
}

/**
 * Get messages for a conversation with cursor-based pagination
 */
export async function getMessages({ conversationId, userId, cursor, limit = 50 }) {
  // Verify membership
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    const error = new Error('You are not a member of this conversation');
    error.status = 403;
    throw error;
  }

  const where = { conversationId };

  // Cursor-based pagination (fetch messages before a certain ID)
  if (cursor) {
    where.id = { lt: BigInt(cursor) };
  }

  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true },
      },
      receipts: {
        select: {
          userId: true,
          deliveredAt: true,
          readAt: true,
        },
      },
    },
    orderBy: { id: 'desc' },
    take: limit,
  });

  // Reverse to get chronological order
  messages.reverse();

  // Convert BigInt to string for JSON serialization
  const serialized = messages.map(serializeMessage);

  const hasMore = messages.length === limit;
  const nextCursor = hasMore ? serialized[0].id : null;

  return {
    messages: serialized,
    hasMore,
    nextCursor,
  };
}

/**
 * Get missed messages after a given message ID (for reconnect recovery)
 */
export async function getMissedMessages({ userId, afterMessageId }) {
  // Get all conversation IDs for this user
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  const conversationIds = memberships.map(m => m.conversationId);

  if (conversationIds.length === 0) return [];

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      id: { gt: BigInt(afterMessageId) },
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { id: 'asc' },
    take: 500, // Safety limit
  });

  return messages.map(serializeMessage);
}

/**
 * Mark message as delivered
 */
export async function markDelivered({ messageId, userId }) {
  return prisma.messageReceipt.updateMany({
    where: {
      messageId: BigInt(messageId),
      userId,
      deliveredAt: null,
    },
    data: {
      deliveredAt: new Date(),
    },
  });
}

/**
 * Mark messages as read up to a given message in a conversation
 */
export async function markRead({ conversationId, messageId, userId }) {
  // Get all unread message IDs in the conversation up to messageId
  const receipts = await prisma.messageReceipt.findMany({
    where: {
      userId,
      readAt: null,
      message: {
        conversationId,
        id: { lte: BigInt(messageId) },
      },
    },
    select: { messageId: true },
  });

  if (receipts.length === 0) return { count: 0 };

  const messageIds = receipts.map(r => r.messageId);

  const now = new Date();

  const result = await prisma.messageReceipt.updateMany({
    where: {
      messageId: { in: messageIds },
      userId,
      readAt: null,
    },
    data: {
      readAt: now,
      deliveredAt: now, // Also mark as delivered if not already
    },
  });

  return { count: result.count, readAt: now };
}

/**
 * Serialize message for JSON (BigInt → string)
 */
function serializeMessage(msg) {
  return {
    ...msg,
    id: msg.id.toString(),
    receipts: msg.receipts?.map(r => ({
      ...r,
      messageId: r.messageId?.toString(),
    })),
  };
}
