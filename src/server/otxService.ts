/**
 * Real-Time AlienVault OTX DirectConnect Threat Intelligence Integration
 * 
 * Queries AlienVault Open Threat Exchange (OTX) API v1 for IP, domain, URL, and file indicators.
 * Implements an in-memory 2-hour TTL cache with in-flight Promise deduplication.
 * 
 * STRICT PROVENANCE CONTRACT:
 * Never invent adversary names, pulse counts, or malware families.
 * If OTX_API_KEY is unconfigured, return status UNCONFIGURED with 0 pulses.
 */

export type OtxIndicatorType = 'IPv4' | 'domain' | 'url' | 'file' | 'hostname';

export interface OtxIndicatorResult {
  indicator: string;
  type: OtxIndicatorType;
  pulseCount: number;
  pulseNames: string[];
  adversary?: string;
  malwareFamilies: string[];
  tags: string[];
  references: string[];
  cached: boolean;
  provenance: {
    source: 'AlienVault OTX';
    queriedAt: string;
    isLive: boolean;
    status: 'LIVE' | 'UNCONFIGURED' | 'ERROR';
    reason?: string;
  };
}

interface CacheEntry {
  data: OtxIndicatorResult;
  expiresAt: number;
}

const OTX_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 Hours
const OTX_CACHE = new Map<string, CacheEntry>();
const inFlightOtxRequests = new Map<string, Promise<OtxIndicatorResult>>();

/**
 * Checks if OTX API Key is configured in environment
 */
export function isOtxConfigured(): boolean {
  const key = (process.env.OTX_API_KEY || '').trim();
  return key.length > 0 && !key.includes('placeholder') && !key.includes('your_');
}

/**
 * Returns OTX service status for /api/intelligence/status
 */
export function getOtxStatus() {
  const configured = isOtxConfigured();
  return {
    configured,
    active: configured,
    provider: 'AlienVault OTX DirectConnect API',
    endpoint: 'https://otx.alienvault.com/api/v1/indicators',
    cacheSize: OTX_CACHE.size,
    ttlMinutes: OTX_CACHE_TTL_MS / (60 * 1000),
    message: configured
      ? 'AlienVault OTX API key is active for live indicator & adversary threat pulse lookups.'
      : 'OTX_API_KEY is not configured. Indicator queries return unconfigured status without fabricated pulses.'
  };
}

/**
 * Normalizes indicator type for the OTX DirectConnect path
 */
function normalizeOtxType(type: string): OtxIndicatorType {
  const lower = (type || '').toLowerCase();
  if (lower === 'ip' || lower === 'ipv4') return 'IPv4';
  if (lower === 'domain' || lower === 'hostname') return 'domain';
  if (lower === 'url' || lower === 'uri') return 'url';
  if (lower === 'file' || lower === 'hash' || lower === 'sha256' || lower === 'md5') return 'file';
  return 'IPv4';
}

/**
 * Queries AlienVault OTX for indicator intelligence
 */
export async function queryOtxIndicator(
  type: string,
  rawIndicator: string
): Promise<OtxIndicatorResult> {
  const normalizedType = normalizeOtxType(type);
  const cleanIndicator = (rawIndicator || '').trim();
  const cacheKey = `${normalizedType}:${cleanIndicator.toLowerCase()}`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 1. Check TTL Cache
  const cached = OTX_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data, cached: true };
  }

  // 2. In-flight Promise deduplication
  const inFlight = inFlightOtxRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const queryPromise = (async (): Promise<OtxIndicatorResult> => {
    // Unconfigured Key Handling
    if (!isOtxConfigured()) {
      const unconfiguredResult: OtxIndicatorResult = {
        indicator: cleanIndicator,
        type: normalizedType,
        pulseCount: 0,
        pulseNames: [],
        adversary: undefined,
        malwareFamilies: [],
        tags: [],
        references: [],
        cached: false,
        provenance: {
          source: 'AlienVault OTX',
          queriedAt: nowIso,
          isLive: false,
          status: 'UNCONFIGURED',
          reason: 'OTX_API_KEY is not configured in server environment'
        }
      };
      OTX_CACHE.set(cacheKey, { data: unconfiguredResult, expiresAt: now + OTX_CACHE_TTL_MS });
      return unconfiguredResult;
    }

    const apiKey = process.env.OTX_API_KEY!.trim();
    const endpoint = `https://otx.alienvault.com/api/v1/indicators/${normalizedType}/${encodeURIComponent(cleanIndicator)}/general`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-OTX-API-KEY': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'TraceXMail-Forensics/2.5'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      // OTX returns 404 if indicator has zero threat pulses (clean/unindexed)
      if (response.status === 404) {
        const cleanResult: OtxIndicatorResult = {
          indicator: cleanIndicator,
          type: normalizedType,
          pulseCount: 0,
          pulseNames: [],
          adversary: undefined,
          malwareFamilies: [],
          tags: [],
          references: [],
          cached: false,
          provenance: {
            source: 'AlienVault OTX',
            queriedAt: nowIso,
            isLive: true,
            status: 'LIVE'
          }
        };
        OTX_CACHE.set(cacheKey, { data: cleanResult, expiresAt: now + OTX_CACHE_TTL_MS });
        return cleanResult;
      }

      if (!response.ok) {
        const errorResult: OtxIndicatorResult = {
          indicator: cleanIndicator,
          type: normalizedType,
          pulseCount: 0,
          pulseNames: [],
          adversary: undefined,
          malwareFamilies: [],
          tags: [],
          references: [],
          cached: false,
          provenance: {
            source: 'AlienVault OTX',
            queriedAt: nowIso,
            isLive: false,
            status: 'ERROR',
            reason: `OTX HTTP ${response.status}: ${response.statusText}`
          }
        };
        return errorResult;
      }

      const json = await response.json();
      const pulseInfo = json.pulse_info || {};
      const pulseCount = typeof pulseInfo.count === 'number' ? pulseInfo.count : (pulseInfo.pulses?.length || 0);

      const pulseNames: string[] = [];
      const tagsSet = new Set<string>();
      const malwareSet = new Set<string>();
      const refSet = new Set<string>();
      let adversary: string | undefined = undefined;

      if (Array.isArray(pulseInfo.pulses)) {
        for (const pulse of pulseInfo.pulses) {
          if (pulse.name) pulseNames.push(pulse.name);
          if (pulse.adversary && !adversary) adversary = pulse.adversary;
          if (Array.isArray(pulse.tags)) {
            pulse.tags.forEach((t: string) => tagsSet.add(t));
          }
          if (Array.isArray(pulse.malware_families)) {
            pulse.malware_families.forEach((m: any) => {
              const name = typeof m === 'string' ? m : m.display_name || m.name;
              if (name) malwareSet.add(name);
            });
          }
          if (Array.isArray(pulse.references)) {
            pulse.references.forEach((r: string) => refSet.add(r));
          }
        }
      }

      const liveResult: OtxIndicatorResult = {
        indicator: cleanIndicator,
        type: normalizedType,
        pulseCount,
        pulseNames: pulseNames.slice(0, 15),
        adversary: adversary || (json.adversary ? String(json.adversary) : undefined),
        malwareFamilies: Array.from(malwareSet).slice(0, 10),
        tags: Array.from(tagsSet).slice(0, 20),
        references: Array.from(refSet).slice(0, 10),
        cached: false,
        provenance: {
          source: 'AlienVault OTX',
          queriedAt: nowIso,
          isLive: true,
          status: 'LIVE'
        }
      };

      OTX_CACHE.set(cacheKey, { data: liveResult, expiresAt: now + OTX_CACHE_TTL_MS });
      return liveResult;
    } catch (err: any) {
      console.warn(`[OTX] Indicator lookup failed for ${normalizedType}:${cleanIndicator}:`, err?.message || err);
      const errResult: OtxIndicatorResult = {
        indicator: cleanIndicator,
        type: normalizedType,
        pulseCount: 0,
        pulseNames: [],
        adversary: undefined,
        malwareFamilies: [],
        tags: [],
        references: [],
        cached: false,
        provenance: {
          source: 'AlienVault OTX',
          queriedAt: nowIso,
          isLive: false,
          status: 'ERROR',
          reason: err?.message || 'Network request timeout or connection failure'
        }
      };
      return errResult;
    }
  })();

  inFlightOtxRequests.set(cacheKey, queryPromise);
  try {
    return await queryPromise;
  } finally {
    inFlightOtxRequests.delete(cacheKey);
  }
}

/**
 * Enriches multiple indicators for a forensic case with OTX intelligence
 */
export async function enrichCaseWithOtx(indicators: {
  ips?: string[];
  domains?: string[];
  urls?: string[];
  hashes?: string[];
}): Promise<{
  results: Record<string, OtxIndicatorResult>;
  summary: {
    totalPulses: number;
    activeThreats: number;
    adversaries: string[];
    malwareFamilies: string[];
  };
}> {
  const results: Record<string, OtxIndicatorResult> = {};
  let totalPulses = 0;
  let activeThreats = 0;
  const adversaries = new Set<string>();
  const malwareFamilies = new Set<string>();

  const lookupTasks: Promise<void>[] = [];

  // Look up IPs (skip private/RFC1918)
  for (const ip of indicators.ips || []) {
    if (!ip || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) continue;
    lookupTasks.push(
      queryOtxIndicator('IPv4', ip).then(res => {
        results[`ip:${ip}`] = res;
        totalPulses += res.pulseCount;
        if (res.pulseCount > 0) activeThreats++;
        if (res.adversary) adversaries.add(res.adversary);
        res.malwareFamilies.forEach(m => malwareFamilies.add(m));
      })
    );
  }

  // Look up Domains
  for (const domain of indicators.domains || []) {
    if (!domain) continue;
    lookupTasks.push(
      queryOtxIndicator('domain', domain).then(res => {
        results[`domain:${domain}`] = res;
        totalPulses += res.pulseCount;
        if (res.pulseCount > 0) activeThreats++;
        if (res.adversary) adversaries.add(res.adversary);
        res.malwareFamilies.forEach(m => malwareFamilies.add(m));
      })
    );
  }

  // Look up URLs (max 3)
  for (const url of (indicators.urls || []).slice(0, 3)) {
    if (!url) continue;
    lookupTasks.push(
      queryOtxIndicator('url', url).then(res => {
        results[`url:${url}`] = res;
        totalPulses += res.pulseCount;
        if (res.pulseCount > 0) activeThreats++;
        if (res.adversary) adversaries.add(res.adversary);
        res.malwareFamilies.forEach(m => malwareFamilies.add(m));
      })
    );
  }

  await Promise.allSettled(lookupTasks);

  return {
    results,
    summary: {
      totalPulses,
      activeThreats,
      adversaries: Array.from(adversaries),
      malwareFamilies: Array.from(malwareFamilies)
    }
  };
}
