import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getMissedMessages } from '../controllers/messageController.js';

const router = Router();

router.use(auth);

// GET /api/messages?afterMessageId=100
router.get('/', getMissedMessages);

export default router;
