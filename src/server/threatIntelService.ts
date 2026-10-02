/**
 * Real-Time Threat Intelligence & Reputation Service for TraceXMail
 * Performs live AbuseIPDB, VirusTotal, ICANN/IANA RDAP, and authoritative DNS lookups
 * with an in-memory TTL Cache and in-flight de-duplication.
 * 
 * STRICT PROVENANCE CONTRACT:
 * Never fabricate intelligence numbers, scores, ISPs, or registrar entities.
 * If API keys are unconfigured or calls fail, explicit status UNCONFIGURED or ERROR is returned.
 */

import dns from 'dns';
import { isTorExitNode } from './intelligence/torExitNodes';
import { resolveRdap } from './intelligence/rdap';
import { lookupVirusTotalUrl, isVirusTotalConfigured } from './intelligence/virustotal';

export type IntelStatus = 'LIVE' | 'UNCONFIGURED' | 'ERROR';

export interface IntelProvenance {
  source: string;
  queriedAt: string;
  isLive: boolean;
  status: IntelStatus;
  reason?: string;
}

export interface IpThreatIntel {
  ip: string;
  abuseConfidenceScore: number | null;
  totalReports: number;
  lastReportedAt?: string;
  isTor: boolean;
  isVpnOrProxy: boolean;
  usageType?: string;
  isp?: string;
  countryCode?: string;
  cached: boolean;
  queriedAt: string;
  provenance: IntelProvenance;
}

export interface DomainThreatIntel {
  domain: string;
  status: 'active' | 'nxdomain' | 'parked' | 'unregistered';
  registeredDate?: string;
  domainAgeDays?: number;
  isNewlyRegistered: boolean;
  registrar?: string;
  dns: {
    spf?: string;
    spfQualifier?: string;
    dmarc?: string;
    dmarcPolicy?: string;
    mxRecords: string[];
    nsRecords: string[];
  };
  reputation: 'BENIGN' | 'SUSPICIOUS' | 'MALICIOUS';
  cached: boolean;
  queriedAt: string;
  provenance: IntelProvenance;
}

export interface UrlThreatIntel {
  url: string;
  domain: string;
  isMalicious: boolean;
  positives: number;
  totalScans: number;
  scanDate?: string;
  categories: string[];
  cached: boolean;
  provenance: IntelProvenance;
}

// In-Memory TTL Cache Storage (2-Hour TTL)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const INTEL_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const IP_INTEL_CACHE = new Map<string, CacheEntry<IpThreatIntel>>();
const DOMAIN_INTEL_CACHE = new Map<string, CacheEntry<DomainThreatIntel>>();
const URL_INTEL_CACHE = new Map<string, CacheEntry<UrlThreatIntel>>();

// In-flight de-duplication maps
const inFlightIpRequests = new Map<string, Promise<IpThreatIntel>>();
const inFlightDomainRequests = new Map<string, Promise<DomainThreatIntel>>();
const inFlightUrlRequests = new Map<string, Promise<UrlThreatIntel>>();

/**
 * Live IP Threat Intelligence via AbuseIPDB API & Authoritative Tor Exit Node directory
 */
export async function queryIpThreatIntel(ip: string): Promise<IpThreatIntel> {
  const cleanIp = (ip || '').trim();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 1. Check TTL cache
  const cached = IP_INTEL_CACHE.get(cleanIp);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data, cached: true };
  }

  // 2. In-flight de-duplication
  const inFlight = inFlightIpRequests.get(cleanIp);
  if (inFlight) {
    return inFlight;
  }

  const queryPromise = (async (): Promise<IpThreatIntel> => {
    // Derive isTor STRICTLY from downloaded Tor exit list
    const isTor = isTorExitNode(cleanIp);
    const apiKey = (process.env.ABUSEIPDB_API_KEY || '').trim();

    // If AbuseIPDB key is missing, return honest UNCONFIGURED provenance without fabricated scores
    if (!apiKey || apiKey.includes('placeholder') || apiKey.includes('your_')) {
      const unconfiguredResult: IpThreatIntel = {
        ip: cleanIp,
        abuseConfidenceScore: null,
        totalReports: 0,
        isTor,
        isVpnOrProxy: isTor,
        usageType: isTor ? 'Tor Exit Node / Anonymizer' : undefined,
        isp: undefined,
        countryCode: undefined,
        cached: false,
        queriedAt: nowIso,
        provenance: {
          source: 'AbuseIPDB',
          queriedAt: nowIso,
          isLive: false,
          status: 'UNCONFIGURED',
          reason: 'ABUSEIPDB_API_KEY is not configured in server environment'
        }
      };
      IP_INTEL_CACHE.set(cleanIp, { data: unconfiguredResult, expiresAt: now + INTEL_CACHE_TTL_MS });
      return unconfiguredResult;
    }

    // Live API lookup
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(cleanIp)}&maxAgeInDays=90`,
        {
          headers: {
            Key: apiKey,
            Accept: 'application/json'
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json();
        const data = json.data || {};
        const abuseScore = typeof data.abuseConfidenceScore === 'number' ? data.abuseConfidenceScore : 0;
        const totalReports = typeof data.totalReports === 'number' ? data.totalReports : 0;
        const isTorReported = Boolean(data.isTor) || isTor;
        const isVpnOrProxy = isTorReported || Boolean(data.isPublicProxy);

        const liveResult: IpThreatIntel = {
          ip: cleanIp,
          abuseConfidenceScore: abuseScore,
          totalReports,
          lastReportedAt: data.lastReportedAt || (totalReports > 0 ? nowIso : undefined),
          isTor: isTorReported,
          isVpnOrProxy,
          usageType: data.usageType || (isTorReported ? 'Tor Exit Node / Anonymizer' : undefined),
          isp: data.isp || undefined,
          countryCode: data.countryCode || undefined,
          cached: false,
          queriedAt: nowIso,
          provenance: {
            source: 'AbuseIPDB',
            queriedAt: nowIso,
            isLive: true,
            status: 'LIVE'
          }
        };
        IP_INTEL_CACHE.set(cleanIp, { data: liveResult, expiresAt: now + INTEL_CACHE_TTL_MS });
        return liveResult;
      } else {
        const errorResult: IpThreatIntel = {
          ip: cleanIp,
          abuseConfidenceScore: null,
          totalReports: 0,
          isTor,
          isVpnOrProxy: isTor,
          usageType: isTor ? 'Tor Exit Node' : undefined,
          isp: undefined,
          countryCode: undefined,
          cached: false,
          queriedAt: nowIso,
          provenance: {
            source: 'AbuseIPDB',
            queriedAt: nowIso,
            isLive: false,
            status: 'ERROR',
            reason: `AbuseIPDB HTTP ${response.status}: ${response.statusText}`
          }
        };
        return errorResult;
      }
    } catch (err: any) {
      console.warn(`[ThreatIntel] AbuseIPDB live query failed for IP ${cleanIp}:`, err?.message || err);
      const errorResult: IpThreatIntel = {
        ip: cleanIp,
        abuseConfidenceScore: null,
        totalReports: 0,
        isTor,
        isVpnOrProxy: isTor,
        usageType: isTor ? 'Tor Exit Node' : undefined,
        isp: undefined,
        countryCode: undefined,
        cached: false,
        queriedAt: nowIso,
        provenance: {
          source: 'AbuseIPDB',
          queriedAt: nowIso,
          isLive: false,
          status: 'ERROR',
          reason: err?.message || 'Network request timeout or connection failure'
        }
      };
      return errorResult;
    }
  })();

  inFlightIpRequests.set(cleanIp, queryPromise);
  try {
    return await queryPromise;
  } finally {
    inFlightIpRequests.delete(cleanIp);
  }
}

/**
 * Live Domain Threat Intelligence via Authoritative DNS (MX, TXT/SPF, DMARC) and RDAP
 */
export async function queryDomainThreatIntel(domain: string): Promise<DomainThreatIntel> {
  const cleanDomain = (domain || '').toLowerCase().trim().replace(/^@/, '');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const cached = DOMAIN_INTEL_CACHE.get(cleanDomain);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data, cached: true };
  }

  const inFlight = inFlightDomainRequests.get(cleanDomain);
  if (inFlight) {
    return inFlight;
  }

  const queryPromise = (async (): Promise<DomainThreatIntel> => {
    const mxRecords: string[] = [];
    const nsRecords: string[] = [];
    let spfRecord: string | undefined = undefined;
    let dmarcRecord: string | undefined = undefined;
    let dmarcPolicy: string | undefined = undefined;
    let spfQualifier: string | undefined = undefined;
    let status: DomainThreatIntel['status'] = 'active';

    // 1. Authoritative DNS Lookups
    try {
      const mx = await dns.promises.resolveMx(cleanDomain);
      mx.forEach(r => mxRecords.push(r.exchange));
    } catch (e: any) {
      if (e.code === 'ENOTFOUND' || e.code === 'ENODATA' || e.code === 'ESERVFAIL') {
        status = 'nxdomain';
      }
    }

    try {
      const ns = await dns.promises.resolveNs(cleanDomain);
      ns.forEach(r => nsRecords.push(r));
    } catch {}

    try {
      const txtRecords = await dns.promises.resolveTxt(cleanDomain);
      for (const txtArr of txtRecords) {
        const fullTxt = txtArr.join('');
        if (fullTxt.startsWith('v=spf1')) {
          spfRecord = fullTxt;
          if (fullTxt.includes('-all')) spfQualifier = 'Fail (-all)';
          else if (fullTxt.includes('~all')) spfQualifier = 'SoftFail (~all)';
          else if (fullTxt.includes('+all')) spfQualifier = 'Permissive (+all)';
          else if (fullTxt.includes('?all')) spfQualifier = 'Neutral (?all)';
        }
      }
    } catch {}

    try {
      const dmarcTxt = await dns.promises.resolveTxt(`_dmarc.${cleanDomain}`);
      for (const txtArr of dmarcTxt) {
        const fullTxt = txtArr.join('');
        if (fullTxt.startsWith('v=DMARC1')) {
          dmarcRecord = fullTxt;
          const pMatch = fullTxt.match(/p=([a-zA-Z]+)/);
          if (pMatch) dmarcPolicy = pMatch[1].toLowerCase();
        }
      }
    } catch {}

    // 2. Resolve Real RDAP (No fake registrar string)
    let registrar: string | undefined = undefined;
    let registeredDate: string | undefined = undefined;
    let domainAgeDays: number | undefined = undefined;
    let isNewlyRegistered = false;

    if (status !== 'nxdomain') {
      try {
        const rdap = await resolveRdap(cleanDomain);
        if (rdap && rdap.lookupStatus === 'success') {
          registrar = rdap.registrar || undefined;
          registeredDate = rdap.registeredDate || undefined;
          domainAgeDays = rdap.domainAgeDays || undefined;
          isNewlyRegistered = typeof domainAgeDays === 'number' && domainAgeDays < 30;
        }
      } catch {}
    }

    let reputation: DomainThreatIntel['reputation'] = 'BENIGN';
    if (status === 'nxdomain' || (isNewlyRegistered && domainAgeDays !== undefined && domainAgeDays < 7)) {
      reputation = 'MALICIOUS';
    } else if (isNewlyRegistered || !spfRecord || (spfQualifier && spfQualifier.includes('Permissive'))) {
      reputation = 'SUSPICIOUS';
    }

    const intelResult: DomainThreatIntel = {
      domain: cleanDomain,
      status,
      registeredDate,
      domainAgeDays,
      isNewlyRegistered,
      registrar,
      dns: {
        spf: spfRecord,
        spfQualifier,
        dmarc: dmarcRecord,
        dmarcPolicy,
        mxRecords,
        nsRecords
      },
      reputation,
      cached: false,
      queriedAt: nowIso,
      provenance: {
        source: 'Authoritative DNS & RDAP',
        queriedAt: nowIso,
        isLive: true,
        status: 'LIVE'
      }
    };

    DOMAIN_INTEL_CACHE.set(cleanDomain, { data: intelResult, expiresAt: now + INTEL_CACHE_TTL_MS });
    return intelResult;
  })();

  inFlightDomainRequests.set(cleanDomain, queryPromise);
  try {
    return await queryPromise;
  } finally {
    inFlightDomainRequests.delete(cleanDomain);
  }
}

/**
 * Live URL Threat Intelligence via VirusTotal
 */
export async function queryUrlThreatIntel(rawUrl: string): Promise<UrlThreatIntel> {
  const normalized = (rawUrl || '').trim();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const cached = URL_INTEL_CACHE.get(normalized);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data, cached: true };
  }

  const inFlight = inFlightUrlRequests.get(normalized);
  if (inFlight) {
    return inFlight;
  }

  const queryPromise = (async (): Promise<UrlThreatIntel> => {
    let domain = '';
    try {
      const parsed = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
      domain = parsed.hostname;
    } catch {
      domain = normalized.split('/')[0];
    }

    if (!isVirusTotalConfigured()) {
      const unconfiguredResult: UrlThreatIntel = {
        url: normalized,
        domain,
        isMalicious: false,
        positives: 0,
        totalScans: 0,
        scanDate: undefined,
        categories: [],
        cached: false,
        provenance: {
          source: 'VirusTotal v3',
          queriedAt: nowIso,
          isLive: false,
          status: 'UNCONFIGURED',
          reason: 'VIRUSTOTAL_API_KEY is not configured in server environment'
        }
      };
      URL_INTEL_CACHE.set(normalized, { data: unconfiguredResult, expiresAt: now + INTEL_CACHE_TTL_MS });
      return unconfiguredResult;
    }

    try {
      const vtResult = await lookupVirusTotalUrl(normalized);
      const isLive = vtResult.lookupStatus === 'success';
      const isUnconfigured = !vtResult.isConfigured;

      const intelResult: UrlThreatIntel = {
        url: normalized,
        domain,
        isMalicious: vtResult.isMalicious,
        positives: vtResult.positives,
        totalScans: vtResult.totalEngines,
        scanDate: vtResult.retrievedAt,
        categories: vtResult.tags || (vtResult.category ? [vtResult.category] : []),
        cached: false,
        provenance: {
          source: 'VirusTotal v3',
          queriedAt: nowIso,
          isLive,
          status: isUnconfigured ? 'UNCONFIGURED' : isLive ? 'LIVE' : 'ERROR',
          reason: isUnconfigured ? 'VIRUSTOTAL_API_KEY is not configured' : undefined
        }
      };

      URL_INTEL_CACHE.set(normalized, { data: intelResult, expiresAt: now + INTEL_CACHE_TTL_MS });
      return intelResult;
    } catch (err: any) {
      const errorResult: UrlThreatIntel = {
        url: normalized,
        domain,
        isMalicious: false,
        positives: 0,
        totalScans: 0,
        scanDate: undefined,
        categories: [],
        cached: false,
        provenance: {
          source: 'VirusTotal v3',
          queriedAt: nowIso,
          isLive: false,
          status: 'ERROR',
          reason: err?.message || 'VirusTotal query failed'
        }
      };
      return errorResult;
    }
  })();

  inFlightUrlRequests.set(normalized, queryPromise);
  try {
    return await queryPromise;
  } finally {
    inFlightUrlRequests.delete(normalized);
  }
}
