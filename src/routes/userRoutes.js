import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getMe, updateMe, searchUsers, getUser } from '../controllers/userController.js';

const router = Router();

// All user routes require authentication
router.use(auth);

router.get('/me', getMe);
router.put('/me', updateMe);
router.get('/search', searchUsers);
router.get('/:id', getUser);

export default router;
