// Intelligence In-Memory & Supabase Durable Cache with In-Flight Promise Deduplication
import { getSupabaseAdminClient, DEFAULT_ORG_ID } from '../supabase';

export interface CacheOptions {
  ttlMs: number;
  maxEntries?: number;
  cacheType?: string;
}

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

// Module-level tracking for database table availability
let isDbCacheAvailable: boolean | null = null;
let lastDbCheckTime = 0;
const DB_RETRY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes backoff if table is absent

function shouldAttemptDb(): boolean {
  if (isDbCacheAvailable === true) return true;
  if (isDbCacheAvailable === false) {
    if (Date.now() - lastDbCheckTime > DB_RETRY_INTERVAL_MS) {
      // Periodic retry to see if table has been migrated
      isDbCacheAvailable = null;
      return true;
    }
    return false;
  }
  return true;
}

function handleDbSchemaError(errMessage?: string) {
  if (!errMessage) return;
  const lower = errMessage.toLowerCase();
  if (
    lower.includes('could not find the table') ||
    lower.includes('schema cache') ||
    lower.includes('relation "intelligence_cache" does not exist') ||
    lower.includes('pgrst205') ||
    lower.includes('42p01') ||
    lower.includes('invalid api key') ||
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('permission denied') ||
    lower.includes('apikey')
  ) {
    if (isDbCacheAvailable !== false) {
      isDbCacheAvailable = false;
      lastDbCheckTime = Date.now();
      console.info(`[IntelligenceCache] Supabase L2 persistence unavailable (${errMessage}). Operating with in-memory L1 cache.`);
    }
  }
}

export class IntelligenceCache<T> {
  private readonly store = new Map<string, CacheItem<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly cacheType: string;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries || 5000;
    this.cacheType = options.cacheType || 'generic';
  }

  public get(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }

  public set(key: string, value: T, customTtlMs?: number): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest 10%
      const keysToDelete = Array.from(this.store.keys()).slice(0, Math.floor(this.maxEntries * 0.1));
      for (const k of keysToDelete) {
        this.store.delete(k);
      }
    }
    const expiresAt = Date.now() + (customTtlMs || this.ttlMs);
    this.store.set(key, {
      value,
      expiresAt
    });

    // Asynchronously save to Supabase L2 persistent cache if available
    if (shouldAttemptDb()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const sanitizedId = `ic_${this.cacheType}_${Buffer.from(key).toString('base64url').slice(0, 48)}`;
        const serializedData = value instanceof Set ? Array.from(value) : (value as any);

        (async () => {
          try {
            const { error } = await supabase.from('intelligence_cache')
              .upsert({
                id: sanitizedId,
                organization_id: DEFAULT_ORG_ID,
                cache_type: this.cacheType,
                lookup_key: key,
                data: serializedData,
                expires_at: new Date(expiresAt).toISOString()
              }, { onConflict: 'organization_id,cache_type,lookup_key' });

            if (error) {
              handleDbSchemaError(error.message);
              if (isDbCacheAvailable !== false) {
                console.warn(`[IntelligenceCache:${this.cacheType}] Error persisting key ${key} to DB:`, error.message);
              }
            } else {
              isDbCacheAvailable = true;
            }
          } catch (err: any) {
            handleDbSchemaError(err?.message);
          }
        })();
      }
    }
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    const deleted = this.store.delete(key);
    if (shouldAttemptDb()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        (async () => {
          try {
            const { error } = await supabase.from('intelligence_cache')
              .delete()
              .eq('organization_id', DEFAULT_ORG_ID)
              .eq('cache_type', this.cacheType)
              .eq('lookup_key', key);
            if (error) handleDbSchemaError(error.message);
          } catch (err: any) {
            handleDbSchemaError(err?.message);
          }
        })();
      }
    }
    return deleted;
  }

  public clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  public size(): number {
    return this.store.size;
  }

  // Deduplicate concurrent requests for the exact same key with L1 memory + L2 Supabase cache
  public async getOrFetch(key: string, fetcher: () => Promise<T>, customTtlMs?: number): Promise<{ value: T; cached: boolean }> {
    // 1. Check L1 memory cache
    const cached = this.get(key);
    if (cached !== undefined) {
      return { value: cached, cached: true };
    }

    // 2. Check deduplication flight
    const running = this.inFlight.get(key);
    if (running) {
      const value = await running;
      return { value, cached: true };
    }

    // 3. Check L2 Supabase persistent cache
    if (shouldAttemptDb()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('intelligence_cache')
            .select('data, expires_at')
            .eq('organization_id', DEFAULT_ORG_ID)
            .eq('cache_type', this.cacheType)
            .eq('lookup_key', key)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

          if (error) {
            handleDbSchemaError(error.message);
          } else if (data && data.data !== undefined) {
            isDbCacheAvailable = true;
            const expiresAt = new Date(data.expires_at).getTime();
            let parsedVal = data.data;
            if (this.cacheType === 'tor' && Array.isArray(parsedVal)) {
              parsedVal = new Set(parsedVal);
            }
            this.store.set(key, { value: parsedVal as T, expiresAt });
            return { value: parsedVal as T, cached: true };
          }
        } catch (err: any) {
          handleDbSchemaError(err?.message);
        }
      }
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, customTtlMs);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    const value = await promise;
    return { value, cached: false };
  }
}

// Global Intelligence Caches with production RFC-compliant TTLs and Supabase L2 persistence
export const geoIpCache = new IntelligenceCache<any>({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 10000, cacheType: 'geoip' }); // 24h
export const asnCache = new IntelligenceCache<any>({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 10000, cacheType: 'asn' }); // 24h
export const dnsCache = new IntelligenceCache<any>({ ttlMs: 60 * 60 * 1000, maxEntries: 5000, cacheType: 'dns' }); // 1h
export const rdapCache = new IntelligenceCache<any>({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 5000, cacheType: 'rdap' }); // 24h
export const threatIntelCache = new IntelligenceCache<any>({ ttlMs: 12 * 60 * 60 * 1000, maxEntries: 5000, cacheType: 'threat_intel' }); // 12h
