import prisma from '../config/database.js';

/**
 * POST /api/conversations
 * Create a new conversation (direct or group)
 */
export async function createConversation(req, res, next) {
  try {
    const { type, title, memberIds } = req.body;
    const currentUserId = req.user.id;

    // Validate
    if (type === 'direct') {
      if (!memberIds || memberIds.length !== 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Direct conversations require exactly 1 other member',
        });
      }

      // Check if direct conversation already exists between these two users
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          AND: [
            { members: { some: { userId: currentUserId } } },
            { members: { some: { userId: memberIds[0] } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true, emailOrPhone: true },
              },
            },
          },
        },
      });

      if (existingConversation) {
        return res.json({ conversation: serializeConversation(existingConversation) });
      }
    }

    if (type === 'group' && (!memberIds || memberIds.length < 1)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Group conversations require at least 1 other member',
      });
    }

    // Create conversation with members
    const allMemberIds = [currentUserId, ...memberIds];

    const conversation = await prisma.conversation.create({
      data: {
        type,
        title: type === 'group' ? (title || 'New Group') : null,
        members: {
          create: allMemberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? 'admin' : 'default_role',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, emailOrPhone: true },
            },
          },
        },
      },
    });

    res.status(201).json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/conversations
 * List all conversations for the current user, with last message
 */
export async function listConversations(req, res, next) {
  try {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, emailOrPhone: true },
            },
          },
        },
        messages: {
          orderBy: { id: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.messageReceipt.count({
          where: {
            userId,
            readAt: null,
            message: { conversationId: conv.id },
          },
        });

        const lastMessage = conv.messages[0] ? {
          ...conv.messages[0],
          id: conv.messages[0].id.toString(),
        } : null;

        return {
          ...serializeConversation(conv),
          lastMessage,
          unreadCount,
        };
      })
    );

    res.json({ conversations: conversationsWithUnread });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/conversations/:id
 */
export async function getConversation(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, emailOrPhone: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found or you are not a member',
      });
    }

    res.json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/conversations/:id
 * Update group title/settings
 */
export async function updateConversation(req, res, next) {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    // Verify membership and admin role
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: id, userId },
      },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Not Found', message: 'Conversation not found' });
    }

    if (membership.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only admins can update conversations' });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, emailOrPhone: true },
            },
          },
        },
      },
    });

    res.json({ conversation: serializeConversation(updated) });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/conversations/:id/members
 * Add a member to a group conversation
 */
export async function addMember(req, res, next) {
  try {
    const { id } = req.params;
    const { userId: newMemberId } = req.body;
    const currentUserId = req.user.id;

    // Verify admin
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: id, userId: currentUserId },
      },
    });

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only admins can add members' });
    }

    // Verify conversation is a group
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (conversation.type !== 'group') {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot add members to direct conversations' });
    }

    // Add member
    await prisma.conversationMember.create({
      data: {
        conversationId: id,
        userId: newMemberId,
        role: 'default_role',
      },
    });

    res.status(201).json({ message: 'Member added' });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/conversations/:id/members/:userId
 * Remove a member from a group conversation
 */
export async function removeMember(req, res, next) {
  try {
    const { id, userId: targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Allow self-removal or admin removal
    if (targetUserId !== currentUserId) {
      const membership = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId: id, userId: currentUserId },
        },
      });

      if (!membership || membership.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden', message: 'Only admins can remove members' });
      }
    }

    await prisma.conversationMember.delete({
      where: {
        conversationId_userId: { conversationId: id, userId: targetUserId },
      },
    });

    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
}

/**
 * Serialize conversation (handle BigInt in nested messages)
 */
function serializeConversation(conv) {
  return {
    ...conv,
    messages: conv.messages?.map(m => ({
      ...m,
      id: m.id.toString(),
    })),
  };
}
