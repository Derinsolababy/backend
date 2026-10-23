/**
 * In-memory stand-in for the small subset of Redis the app uses (cache with
 * TTL). The method names match node-redis, so a real client can replace this
 * file without touching call sites.
 */
class MemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async flushAll(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }

  async quit(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }
}

export type RedisLike = MemoryRedis;

let client: MemoryRedis | null = null;

export async function connectRedis(): Promise<RedisLike> {
  client ??= new MemoryRedis();
  return client;
}

export function getRedis(): RedisLike {
  if (!client) throw new Error('Redis not connected. Call connectRedis() first.');
  return client;
}
