import env from '../config/env.js';

// In-memory rate limiter (use Redis in production for multi-server)
const requestCounts = new Map();

/**
 * Simple rate limiter middleware
 * Limits requests per IP within a time window
 */
export const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - env.RATE_LIMIT_WINDOW;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const requests = requestCounts.get(ip).filter(ts => ts > windowStart);
  requests.push(now);
  requestCounts.set(ip, requests);

  if (requests.length > env.RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${env.RATE_LIMIT_MAX} requests per ${env.RATE_LIMIT_WINDOW / 1000}s`,
      retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW / 1000),
    });
  }

  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': env.RATE_LIMIT_MAX,
    'X-RateLimit-Remaining': env.RATE_LIMIT_MAX - requests.length,
    'X-RateLimit-Reset': new Date(now + env.RATE_LIMIT_WINDOW).toISOString(),
  });

  next();
};

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const windowStart = now - env.RATE_LIMIT_WINDOW;
  for (const [ip, timestamps] of requestCounts.entries()) {
    const valid = timestamps.filter(ts => ts > windowStart);
    if (valid.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, valid);
    }
  }
}, 5 * 60 * 1000);
