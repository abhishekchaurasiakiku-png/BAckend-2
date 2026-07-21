import redis from '../config/redis.js';

const TYPING_TTL = 5; // seconds
const LAST_SEEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Mark user as online and store their WebSocket server
 */
export async function setOnline(userId, serverId = 'main') {
  try {
    await redis.pipeline()
      .set(`user:${userId}:status`, 'online')
      .set(`user:${userId}:server`, serverId)
      .del(`user:${userId}:last_seen_at`)
      .exec();
  } catch (err) {
    console.error('Redis setOnline error:', err.message);
  }
}

/**
 * Mark user as offline and set last_seen_at
 */
export async function setOffline(userId) {
  try {
    const lastSeen = new Date().toISOString();
    await redis.pipeline()
      .set(`user:${userId}:status`, 'offline')
      .del(`user:${userId}:server`)
      .set(`user:${userId}:last_seen_at`, lastSeen, 'EX', LAST_SEEN_TTL)
      .exec();
    return lastSeen;
  } catch (err) {
    console.error('Redis setOffline error:', err.message);
    return new Date().toISOString();
  }
}

/**
 * Get user's online status and last seen
 */
export async function getPresence(userId) {
  try {
    const [status, lastSeenAt] = await redis.mget(
      `user:${userId}:status`,
      `user:${userId}:last_seen_at`
    );
    return {
      userId,
      status: status || 'offline',
      lastSeenAt: lastSeenAt || null,
    };
  } catch (err) {
    console.error('Redis getPresence error:', err.message);
    return { userId, status: 'offline', lastSeenAt: null };
  }
}

/**
 * Get presence for multiple users
 */
export async function getBulkPresence(userIds) {
  try {
    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      pipeline.get(`user:${userId}:status`);
      pipeline.get(`user:${userId}:last_seen_at`);
    }
    const results = await pipeline.exec();

    return userIds.map((userId, i) => ({
      userId,
      status: results[i * 2]?.[1] || 'offline',
      lastSeenAt: results[i * 2 + 1]?.[1] || null,
    }));
  } catch (err) {
    console.error('Redis getBulkPresence error:', err.message);
    return userIds.map(userId => ({ userId, status: 'offline', lastSeenAt: null }));
  }
}

/**
 * Get which server a user is connected to
 */
export async function getUserServer(userId) {
  try {
    return await redis.get(`user:${userId}:server`);
  } catch {
    return null;
  }
}

/**
 * Set typing indicator (auto-expires in 5s)
 */
export async function setTyping(userId, conversationId, isTyping) {
  try {
    const key = `typing:${userId}:conversation:${conversationId}`;
    if (isTyping) {
      await redis.set(key, 'true', 'EX', TYPING_TTL);
    } else {
      await redis.del(key);
    }
  } catch (err) {
    console.error('Redis setTyping error:', err.message);
  }
}

/**
 * Check if a user is typing in a conversation
 */
export async function isTyping(userId, conversationId) {
  try {
    const val = await redis.get(`typing:${userId}:conversation:${conversationId}`);
    return val === 'true';
  } catch {
    return false;
  }
}
