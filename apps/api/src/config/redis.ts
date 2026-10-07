/**
 * In-Memory & Optional Redis Queue Adapter
 * SecuAI operates with PostgreSQL background polling workers by default,
 * with optional Redis connection when REDIS_URL is provided.
 */
export const redisConfig = {
  enabled: Boolean(process.env.REDIS_URL),
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

export default redisConfig;
