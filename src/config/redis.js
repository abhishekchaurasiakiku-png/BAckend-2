import Redis from 'ioredis';
import env from './env.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

// Connect on import
redis.connect().catch((err) => {
  console.error('❌ Redis initial connection failed:', err.message);
  console.warn('⚠️  Continuing without Redis — presence features disabled');
});

export default redis;
