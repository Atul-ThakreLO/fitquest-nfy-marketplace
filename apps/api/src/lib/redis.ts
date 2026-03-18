import Redis from 'ioredis'
import config from '../config'

export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => console.error('Redis error:', err))

// Generic typed helpers
export async function getCache<T>(key: string): Promise<T | null> {
  const val = await redis.get(key)
  return val ? (JSON.parse(val) as T) : null
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key)
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
