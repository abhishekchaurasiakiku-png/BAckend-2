import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/database.js';

/**
 * JWT Authentication middleware
 * Extracts and verifies JWT from Authorization header
 * Attaches user object to req.user
 */
export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided. Use Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);

      // Fetch fresh user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          emailOrPhone: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TokenExpired',
          message: 'Access token has expired. Please refresh.',
        });
      }
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }
  } catch (error) {
    next(error);
  }
};
