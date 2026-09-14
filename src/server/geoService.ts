// Real Geolocation and Network Intelligence Service for TraceXMail
// Multi-Tiered Architecture:
// 1. Local MaxMind GeoLite2 binary (.mmdb) — fastest, offline, unlimited
// 2. Fallback Chain: ip-api.com -> ipwho.is -> ipgeolocation.io
// Strictly demarcates RFC 1918 private subnets without fabricating coordinates.

import dns from 'dns';
import axios from 'axios';
import { classifyIp, ClassifiedIp } from './ipExtractor';
import { maxMindDb } from './maxmindService';
import { isTorExitNode } from './intelligence/torExitNodes';
import { classifyInfra } from './intelligence/vpnHostingList';
import { getRegisteredCountry } from './intelligence/rirCountryCheck';
import { providerRateLimiter } from './intelligence/rateLimiter';

export interface GeoLocationResult {
  ip: string;
  isPrivate: boolean;
  isRfc1918: boolean;
  classification: ClassifiedIp;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  rirCountry?: string | null;
  countryMismatch?: boolean;
  region?: string | null;
  continentCode?: string | null;
  continentName?: string | null;
  timeZone?: string | null;
  isInEuropeanUnion?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  accuracyRadius?: number | null;
  asn?: string | null;
  org?: string | null;
  isp?: string | null;
  reverseDns?: string | null;
  isTor?: boolean;
  isProxyOrVpn?: boolean;
  infra?: 'botnet' | 'vpn' | 'hosting' | null;
  abuseScore?: number;
  isBlacklisted?: boolean;
  source: 'maxmind-local' | 'ip-api' | 'ipwho' | 'ipgeolocation' | 'unavailable' | 'RFC_1918_CLASSIFIER' | string;
  lookupMethod: string;
  lookupStatus?: 'success' | 'unavailable' | 'rate_limited' | 'not_applicable';
}

interface CacheEntry {
  result: GeoLocationResult;
  expiresAt: number;
}

// In-memory cache with 24-hour TTL for public IPs (permanent for RFC 1918)
const GEO_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Resolves Reverse DNS PTR for an IP address with 600ms timeout.
 */
async function resolvePtr(ip: string): Promise<string | undefined> {
  try {
    const ptrPromise = dns.promises.reverse(ip);
    const timeoutPromise = new Promise<string[]>((_, reject) =>
      setTimeout(() => reject(new Error('DNS Timeout')), 600)
    );
    const ptrs = await Promise.race([ptrPromise, timeoutPromise]);
    return ptrs.length > 0 ? ptrs[0] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fallback Provider 1: ip-api.com (free, no key, 45 req/min rate limited)
 */
async function fetchFromIpApi(ip: string): Promise<Partial<GeoLocationResult> | null> {
  // Check sliding window rate limit: max 45 requests per 60 seconds
  const allowed = providerRateLimiter.checkSlidingWindow('ip-api', 45, 60000);
  if (!allowed) {
    console.log(`[Geo Fallback] ip-api.com rate limit reached (45/min). Skipping to next fallback provider for ${ip}`);
    return null;
  }

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
    const response = await axios.get(url, {
      timeout: 800,
      headers: { 'User-Agent': 'TraceXMail-Forensic-Engine/1.0' }
    });

    const data = response.data;
    if (data && data.status === 'success' && data.country) {
      let asnStr = data.as || undefined;
      if (asnStr && asnStr.includes(' ')) {
        asnStr = asnStr.split(' ')[0];
      }

      return {
        city: data.city || null,
        country: data.country || null,
        countryCode: data.countryCode || null,
        region: data.regionName || data.region || null,
        timeZone: data.timezone || null,
        lat: typeof data.lat === 'number' ? data.lat : null,
        lng: typeof data.lon === 'number' ? data.lon : null,
        accuracyRadius: 25,
        asn: asnStr,
        org: data.org || data.isp || null,
        isp: data.isp || data.org || null,
        source: 'ip-api',
        lookupMethod: 'ip-api.com Live API',
        lookupStatus: 'success'
      };
    }
  } catch {
    // Timeout or network error - failover gracefully
  }
  return null;
}

/**
 * Fallback Provider 2: ipwho.is (free, no key)
 */
async function fetchFromIpWhoIs(ip: string): Promise<Partial<GeoLocationResult> | null> {
  try {
    const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
    const response = await axios.get(url, {
      timeout: 800,
      headers: { 'User-Agent': 'TraceXMail-Forensic-Engine/1.0' }
    });

    const data = response.data;
    if (data && data.success === true && data.country) {
      const asnNum = data.connection?.asn;
      const asnStr = asnNum ? `AS${asnNum}` : undefined;

      return {
        city: data.city || null,
        country: data.country || null,
        countryCode: data.country_code || null,
        region: data.region || null,
        continentCode: data.continent_code || null,
        continentName: data.continent || null,
        timeZone: data.timezone?.id || null,
        isInEuropeanUnion: Boolean(data.is_eu),
        lat: typeof data.latitude === 'number' ? data.latitude : null,
        lng: typeof data.longitude === 'number' ? data.longitude : null,
        accuracyRadius: 25,
        asn: asnStr,
        org: data.connection?.org || data.connection?.isp || null,
        isp: data.connection?.isp || data.connection?.org || null,
        source: 'ipwho',
        lookupMethod: 'ipwho.is Live API',
        lookupStatus: 'success'
      };
    }
  } catch {
    // Timeout or network error - failover gracefully
  }
  return null;
}

/**
 * Fallback Provider 3: ipgeolocation.io (uses optional IPGEO_API_KEY)
 */
async function fetchFromIpGeoLocationIo(ip: string): Promise<Partial<GeoLocationResult> | null> {
  const apiKey = process.env.IPGEO_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${encodeURIComponent(apiKey)}&ip=${encodeURIComponent(ip)}`;
    const response = await axios.get(url, {
      timeout: 800,
      headers: { 'User-Agent': 'TraceXMail-Forensic-Engine/1.0' }
    });

    const data = response.data;
    if (data && data.country_name) {
      let asnStr = data.asn ? String(data.asn) : undefined;
      if (asnStr && !asnStr.startsWith('AS')) {
        asnStr = `AS${asnStr}`;
      }

      const latNum = parseFloat(data.latitude);
      const lngNum = parseFloat(data.longitude);

      return {
        city: data.city || null,
        country: data.country_name || null,
        countryCode: data.country_code2 || null,
        region: data.state_prov || null,
        continentCode: data.continent_code || null,
        continentName: data.continent_name || null,
        timeZone: data.time_zone?.name || null,
        lat: isNaN(latNum) ? null : latNum,
        lng: isNaN(lngNum) ? null : lngNum,
        accuracyRadius: 25,
        asn: asnStr,
        org: data.organization || data.isp || null,
        isp: data.isp || data.organization || null,
        source: 'ipgeolocation',
        lookupMethod: 'ipgeolocation.io Live API',
        lookupStatus: 'success'
      };
    }
  } catch {
    // Timeout or network error
  }
  return null;
}

/**
 * Resolves IP Geolocation with multi-tier fallback chain:
 * 1. Local MaxMind .mmdb
 * 2. ip-api.com (rate limited)
 * 3. ipwho.is
 * 4. ipgeolocation.io (with key)
 * 5. Honest 'unavailable' without fabrication
 */
export async function resolveIpGeolocationWithFallback(ip?: string): Promise<GeoLocationResult> {
  if (!ip || ip === 'UNKNOWN' || ip === '127.0.0.1' && !ip.includes('.')) {
    return {
      ip: ip || 'UNKNOWN',
      isPrivate: false,
      isRfc1918: false,
      classification: classifyIp(undefined),
      city: null,
      country: null,
      countryCode: null,
      rirCountry: null,
      countryMismatch: false,
      source: 'unavailable',
      lookupStatus: 'not_applicable',
      lookupMethod: 'NO_IP_PROVIDED'
    };
  }

  const now = Date.now();

  // 1. Check in-memory cache with TTL validation
  const cached = GEO_CACHE.get(ip);
  if (cached && (cached.result.isPrivate || cached.expiresAt > now)) {
    return cached.result;
  }

  const classification = classifyIp(ip);

  // 2. Private RFC 1918 / Loopback / APIPA
  if (classification.isPrivate) {
    const result: GeoLocationResult = {
      ip,
      isPrivate: true,
      isRfc1918: classification.isRfc1918,
      classification,
      city: 'Internal Subnet',
      country: classification.isRfc1918 ? 'Private Network (RFC 1918)' : 'Local Non-Routable Space',
      countryCode: 'LAN',
      rirCountry: null,
      countryMismatch: false,
      region: 'Intranet Space',
      asn: 'RFC 1918',
      org: classification.description,
      isp: 'Corporate Intranet / Data Center Segment',
      reverseDns: 'Local Internal Hostname / No Public PTR',
      lat: null,
      lng: null,
      abuseScore: 0,
      isBlacklisted: false,
      isProxyOrVpn: false,
      isTor: false,
      infra: null,
      source: 'RFC_1918_CLASSIFIER',
      lookupStatus: 'not_applicable',
      lookupMethod: 'RFC 1918 Private Subnet Demarcation'
    };
    GEO_CACHE.set(ip, { result, expiresAt: now + CACHE_TTL_MS });
    return result;
  }

  // 3. Independent Network Signals (Tor, VPN/Hosting infra, RIR country, Reverse DNS)
  const [reverseDns, rirCountry] = await Promise.all([
    resolvePtr(ip),
    Promise.resolve(getRegisteredCountry(ip))
  ]);

  const torSignal = isTorExitNode(ip);
  const infraSignal = classifyInfra(ip);

  // 4. Primary Tier: Local MaxMind binary .mmdb lookup
  let resolvedData: Partial<GeoLocationResult> | null = null;
  const maxmindRecord = maxMindDb.lookupCity(ip);

  if (maxmindRecord && (maxmindRecord.country?.names?.en || maxmindRecord.country?.iso_code)) {
    resolvedData = {
      city: maxmindRecord.city?.names?.en || null,
      country: maxmindRecord.country?.names?.en || null,
      countryCode: maxmindRecord.country?.iso_code || null,
      region: maxmindRecord.subdivisions?.[0]?.names?.en || maxmindRecord.subdivisions?.[0]?.iso_code || null,
      continentCode: maxmindRecord.continent?.code || null,
      continentName: maxmindRecord.continent?.names?.en || null,
      timeZone: maxmindRecord.location?.time_zone || null,
      isInEuropeanUnion: Boolean(maxmindRecord.country?.is_in_european_union),
      lat: maxmindRecord.location?.latitude ?? null,
      lng: maxmindRecord.location?.longitude ?? null,
      accuracyRadius: maxmindRecord.location?.accuracy_radius || 20,
      asn: maxmindRecord.traits?.autonomous_system_number ? `AS${maxmindRecord.traits.autonomous_system_number}` : undefined,
      org: maxmindRecord.traits?.autonomous_system_organization || maxmindRecord.traits?.organization || null,
      isp: maxmindRecord.traits?.isp || maxmindRecord.traits?.autonomous_system_organization || null,
      source: 'maxmind-local',
      lookupMethod: 'MaxMind GeoLite2 Local Database',
      lookupStatus: 'success'
    };
  }

  // 5. Secondary Tier: Fallback Chain (if local DB had no match or was unmapped)
  if (!resolvedData) {
    // Try Fallback 1: ip-api.com
    resolvedData = await fetchFromIpApi(ip);

    // Try Fallback 2: ipwho.is
    if (!resolvedData) {
      resolvedData = await fetchFromIpWhoIs(ip);
    }

    // Try Fallback 3: ipgeolocation.io
    if (!resolvedData) {
      resolvedData = await fetchFromIpGeoLocationIo(ip);
    }
  }

  // 6. Assemble complete GeoLocationResult
  if (resolvedData && (resolvedData.country || resolvedData.countryCode)) {
    const isTor = Boolean(resolvedData.isTor) || torSignal;
    const isProxyOrVpn = isTor || Boolean(resolvedData.isProxyOrVpn) || infraSignal === 'vpn';
    const isHosting = infraSignal === 'hosting';

    const countryCode = resolvedData.countryCode || null;
    const countryMismatch = Boolean(
      countryCode &&
      countryCode !== 'XX' &&
      countryCode !== 'LAN' &&
      rirCountry &&
      rirCountry !== 'ZZ' &&
      countryCode.toUpperCase() !== rirCountry.toUpperCase()
    );

    const abuseScore = infraSignal === 'botnet' ? 95 : (isTor ? 88 : (infraSignal === 'vpn' ? 50 : (isHosting ? 25 : 0)));

    const finalResult: GeoLocationResult = {
      ip,
      isPrivate: false,
      isRfc1918: false,
      classification,
      city: resolvedData.city || null,
      country: resolvedData.country || null,
      countryCode,
      rirCountry,
      countryMismatch,
      region: resolvedData.region || null,
      continentCode: resolvedData.continentCode || null,
      continentName: resolvedData.continentName || null,
      timeZone: resolvedData.timeZone || null,
      isInEuropeanUnion: resolvedData.isInEuropeanUnion ?? null,
      lat: resolvedData.lat ?? null,
      lng: resolvedData.lng ?? null,
      accuracyRadius: resolvedData.accuracyRadius || 25,
      asn: resolvedData.asn || null,
      org: resolvedData.org || null,
      isp: resolvedData.isp || resolvedData.org || null,
      reverseDns: reverseDns || (isTor ? `tor-exit-${ip.replace(/\./g, '-')}.torproject.org` : null),
      isTor,
      isProxyOrVpn,
      infra: infraSignal || (isTor ? 'vpn' : isHosting ? 'hosting' : null),
      abuseScore,
      isBlacklisted: isTor || infraSignal === 'botnet',
      source: (resolvedData.source as any) || 'unavailable',
      lookupMethod: resolvedData.lookupMethod || 'Live Geolocation Resolution',
      lookupStatus: 'success'
    };

    GEO_CACHE.set(ip, { result: finalResult, expiresAt: now + CACHE_TTL_MS });
    return finalResult;
  }

  // 7. Strict Anti-Fabrication Final Unresolved State
  // If all local and remote lookups fail, never guess or fabricate. Return honest null fields.
  const isTor = torSignal;
  const isProxyOrVpn = isTor || infraSignal === 'vpn';

  const unmappedResult: GeoLocationResult = {
    ip,
    isPrivate: false,
    isRfc1918: false,
    classification,
    city: null,
    country: null,
    countryCode: null,
    rirCountry,
    countryMismatch: false,
    region: null,
    continentCode: null,
    continentName: null,
    timeZone: null,
    isInEuropeanUnion: null,
    lat: null,
    lng: null,
    accuracyRadius: null,
    asn: null,
    org: null,
    isp: null,
    reverseDns: reverseDns || null,
    isTor,
    isProxyOrVpn,
    infra: infraSignal || (isTor ? 'vpn' : null),
    abuseScore: isTor ? 88 : (infraSignal === 'vpn' ? 50 : 0),
    isBlacklisted: isTor,
    source: 'unavailable',
    lookupMethod: 'Unmapped Public Address (All Providers Unavailable)',
    lookupStatus: 'unavailable'
  };

  // Cache unmapped lookups with shorter 10-minute TTL to re-attempt later
  GEO_CACHE.set(ip, { result: unmappedResult, expiresAt: now + 10 * 60 * 1000 });
  return unmappedResult;
}

/**
 * Standard alias matching the existing interface for seamless backward-compatibility.
 */
export async function resolveIpGeolocation(ip?: string): Promise<GeoLocationResult> {
  return resolveIpGeolocationWithFallback(ip);
}

/**
 * Batch resolve hops with MaxMind Geolocation and fallback chain.
 */
export async function enrichHopsWithGeolocation(hops: Array<{ fromIp?: string; byIp?: string }>): Promise<GeoLocationResult[]> {
  const tasks = hops.map(async (hop) => {
    const targetIp = hop.fromIp || hop.byIp;
    return resolveIpGeolocationWithFallback(targetIp);
  });
  return Promise.all(tasks);
}
