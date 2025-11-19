export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60 * 1000) { // Default 1 minute
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiry });
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

