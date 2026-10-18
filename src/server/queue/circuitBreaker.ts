import { logger } from '../logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  successThreshold?: number;
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 10000; // 10s cooldown
    this.successThreshold = options.successThreshold || 2;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info({ breaker: this.name }, `Circuit breaker ${this.name} entered HALF_OPEN (probing)`);
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const err = new Error(`CircuitBreaker[${this.name}] is OPEN. Call rejected to protect upstream dependency.`);
      (err as any).circuitOpen = true;
      throw err;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error: any) {
      this.recordFailure(error);
      throw error;
    }
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        logger.info({ breaker: this.name }, `Circuit breaker ${this.name} recovered to CLOSED`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  public recordFailure(err?: any): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.warn({ breaker: this.name, error: err?.message }, `Probe failed. Circuit breaker ${this.name} returned to OPEN`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn({ breaker: this.name, failures: this.failureCount }, `Circuit breaker ${this.name} tripped OPEN`);
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// ---------------------------------------------------------------------------
// Provider Breakers & Enrichment Cache
// ---------------------------------------------------------------------------

const providerBreakers = new Map<string, CircuitBreaker>();

export function getProviderBreaker(providerName: string): CircuitBreaker {
  let breaker = providerBreakers.get(providerName);
  if (!breaker) {
    breaker = new CircuitBreaker(providerName, {
      failureThreshold: 3,
      cooldownMs: 15000,
      successThreshold: 1
    });
    providerBreakers.set(providerName, breaker);
  }
  return breaker;
}

// In-memory enrichment cache with TTL
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const enrichmentCache = new Map<string, CacheEntry<any>>();

export function getCachedEnrichment<T>(key: string): T | null {
  const entry = enrichmentCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    enrichmentCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedEnrichment<T>(key: string, data: T, ttlSeconds: number = 3600): void {
  enrichmentCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}
