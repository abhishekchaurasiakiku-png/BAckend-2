import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import prisma from '../../config/database.js';

/**
 * Socket.IO authentication middleware
 * Verifies JWT from handshake auth or query
 */
export async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1]
      || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        emailOrPhone: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket
    socket.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    return next(new Error('Authentication failed'));
  }
}
