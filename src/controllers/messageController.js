import * as messageService from '../services/messageService.js';

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation (cursor-based pagination)
 */
export async function getMessages(req, res, next) {
  try {
    const { id: conversationId } = req.params;
    const { cursor, limit } = req.query;

    const result = await messageService.getMessages({
      conversationId,
      userId: req.user.id,
      cursor: cursor || null,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/conversations/:id/messages
 * Send a message (REST fallback — primary send is via WebSocket)
 */
export async function sendMessage(req, res, next) {
  try {
    const { id: conversationId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message content is required',
      });
    }

    const message = await messageService.createMessage({
      conversationId,
      senderId: req.user.id,
      content: content.trim(),
    });

    // Deliver via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const { deliverMessage } = await import('../services/deliveryService.js');
      const serializedMessage = {
        ...message,
        id: message.id.toString(),
      };
      await deliverMessage(io, serializedMessage, req.user.id);
    }

    res.status(201).json({
      message: {
        ...message,
        id: message.id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/messages?afterMessageId=
 * Get missed messages after reconnection
 */
export async function getMissedMessages(req, res, next) {
  try {
    const { afterMessageId } = req.query;

    if (!afterMessageId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'afterMessageId query parameter is required',
      });
    }

    const messages = await messageService.getMissedMessages({
      userId: req.user.id,
      afterMessageId,
    });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
}
