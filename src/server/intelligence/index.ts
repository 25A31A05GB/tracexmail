import { validateAndClassifyIp } from './ipValidation';
import { resolveGeoIp } from './geoip';
import { resolveAsn } from './asn';
import { resolveDns } from './dns';
import { resolveRdap } from './rdap';
import { resolveDomainIntelligence, extractBaseDomain, analyzeTyposquatting } from './domain';
import {
  lookupVirusTotalUrl,
  lookupVirusTotalFileHash,
  enrichWithVirusTotal,
  isVirusTotalConfigured,
  getVirusTotalStatus,
  vtUrlLookupCache,
  vtFileLookupCache
} from './virustotal';
import { isTorExitNode, checkTorExitNode, refreshTorExitNodes, getTorExitNodeStatus, torExitNodeCache } from './torExitNodes';
import { geoIpCache, asnCache, dnsCache, rdapCache, threatIntelCache } from './cache';
import { providerRateLimiter } from './rateLimiter';
import { createProvenanceMetadata, MAXMIND_COPYRIGHT_NOTICE, MAXMIND_LICENSE_NOTICE } from './provenance';
import { IpEnrichmentResult } from './types';

// Reverse DNS PTR lookup with timeout
import dns from 'dns';
async function resolvePtrSafe(ip: string): Promise<{ found: boolean; ptr: string | null; note: string }> {
  try {
    const ptrs = await dns.promises.reverse(ip);
    if (ptrs && ptrs.length > 0) {
      return {
        found: true,
        ptr: ptrs[0],
        note: 'Authoritative in-addr.arpa PTR record'
      };
    }
  } catch {
    // Expected for many IPs without PTR
  }
  return {
    found: false,
    ptr: null,
    note: 'No in-addr.arpa PTR record configured by network operator'
  };
}

// Full IP Enrichment Pipeline combining Validation, GeoIP, ASN, and Reverse DNS
export async function enrichIpFull(ipAddress: string): Promise<IpEnrichmentResult> {
  const validation = validateAndClassifyIp(ipAddress);

  if (!validation.isValid || !validation.isPublic) {
    const geo = await resolveGeoIp(validation.ip);
    const asn = await resolveAsn(validation.ip);

    return {
      ip: validation.ip,
      validation,
      geo,
      asn,
      reverseDns: {
        found: false,
        ptr: null,
        note: 'RFC 1918 / Private addresses do not publish public reverse DNS delegations'
      },
      threat: {
        lookupStatus: 'not_applicable',
        abuseConfidenceScore: null,
        isTor: false,
        isProxyOrVpn: false,
        isBlacklisted: false,
        source: 'Local Demarcation',
        reason: validation.reason || 'private_address'
      },
      provenance: createProvenanceMetadata({
        evidenceType: 'OBSERVED',
        provider: 'RFC Boundary Classifier',
        source: 'Internal Protocol Boundary',
        status: 'not_applicable',
        reason: validation.reason
      })
    };
  }

  // Concurrent enrichment for public IP
  const [geo, asn, reverseDns] = await Promise.all([
    resolveGeoIp(validation.ip),
    resolveAsn(validation.ip),
    resolvePtrSafe(validation.ip)
  ]);

  // Tor check using deterministic exit node indicators and official Tor Project directory
  const isTor = Boolean(geo.isTorExitNode) || isTorExitNode(validation.ip) || Boolean(geo.isAnonymousProxy) || (reverseDns.ptr?.includes('tor-exit') ?? false);

  return {
    ip: validation.ip,
    validation,
    geo,
    asn,
    reverseDns,
    threat: {
      lookupStatus: geo.lookupStatus === 'success' ? 'success' : geo.lookupStatus,
      abuseConfidenceScore: isTor ? 95 : (geo.lookupStatus === 'success' ? 0 : null),
      isTor,
      isTorExitNode: isTor,
      isProxyOrVpn: Boolean(geo.isAnonymousProxy) || isTor,
      isBlacklisted: isTor,
      source: isTor ? 'Tor Project Directory / MaxMind' : geo.provider,
      reason: geo.reason
    },
    provenance: createProvenanceMetadata({
      evidenceType: 'ENRICHED',
      provider: 'TraceXMail Multi-Source Enrichment Engine',
      source: `${geo.provider} + ${asn.provider}`,
      status: geo.lookupStatus
    })
  };
}

export * from './types';
export * from './errors';
export * from './provenance';
export * from './virustotal';
export * from './torExitNodes';
export {
  validateAndClassifyIp,
  resolveGeoIp,
  resolveAsn,
  resolveDns,
  resolveRdap,
  resolveDomainIntelligence,
  extractBaseDomain,
  analyzeTyposquatting,
  lookupVirusTotalUrl,
  lookupVirusTotalFileHash,
  enrichWithVirusTotal,
  isVirusTotalConfigured,
  getVirusTotalStatus,
  vtUrlLookupCache,
  vtFileLookupCache,
  isTorExitNode,
  checkTorExitNode,
  refreshTorExitNodes,
  getTorExitNodeStatus,
  torExitNodeCache,
  geoIpCache,
  asnCache,
  dnsCache,
  rdapCache,
  threatIntelCache,
  providerRateLimiter,
  MAXMIND_COPYRIGHT_NOTICE,
  MAXMIND_LICENSE_NOTICE
};
