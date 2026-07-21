import prisma from '../config/database.js';
import * as presenceService from '../services/presenceService.js';

/**
 * GET /api/users/me
 */
export async function getMe(req, res) {
  res.json({ user: req.user });
}

/**
 * PUT /api/users/me
 */
export async function updateMe(req, res, next) {
  try {
    const { name, avatarUrl } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        emailOrPhone: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/search?q=
 */
export async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search query must be at least 2 characters',
      });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } }, // Exclude self
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { emailOrPhone: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        emailOrPhone: true,
        avatarUrl: true,
      },
      take: 20,
    });

    // Attach online status
    const userIds = users.map(u => u.id);
    const presences = await presenceService.getBulkPresence(userIds);
    const presenceMap = Object.fromEntries(presences.map(p => [p.userId, p]));

    const usersWithPresence = users.map(u => ({
      ...u,
      status: presenceMap[u.id]?.status || 'offline',
      lastSeenAt: presenceMap[u.id]?.lastSeenAt || null,
    }));

    res.json({ users: usersWithPresence });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:id
 */
export async function getUser(req, res, next) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        emailOrPhone: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const presence = await presenceService.getPresence(id);

    res.json({
      user: {
        ...user,
        status: presence.status,
        lastSeenAt: presence.lastSeenAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
