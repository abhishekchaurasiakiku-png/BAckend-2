import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  addMember,
  removeMember,
} from '../controllers/conversationController.js';
import { getMessages, sendMessage } from '../controllers/messageController.js';

const router = Router();

// All conversation routes require authentication
router.use(auth);

// Conversation CRUD
router.post('/', createConversation);
router.get('/', listConversations);
router.get('/:id', getConversation);
router.put('/:id', updateConversation);

// Member management
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

// Messages within a conversation
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);

export default router;
