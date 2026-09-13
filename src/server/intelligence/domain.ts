import { resolveDns } from './dns';
import { resolveRdap } from './rdap';
import { resolveGeoIp } from './geoip';
import { resolveAsn } from './asn';
import { createProvenanceMetadata } from './provenance';
import { DomainIntelligenceResult, TyposquattingAnalysis } from './types';

// High-value targeted enterprise brands
const HIGH_VALUE_BRANDS = [
  'paypal',
  'microsoft',
  'google',
  'apple',
  'amazon',
  'netflix',
  'chase',
  'bankofamerica',
  'wellsfargo',
  'citi',
  'irs',
  'usps',
  'fedex',
  'dhl',
  'meta',
  'facebook',
  'instagram',
  'dropbox',
  'adobe',
  'docusign',
  'coinbase',
  'binance',
  'linkedin'
];

export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

export function extractBaseDomain(input: string): string {
  let clean = input.toLowerCase().trim();
  clean = clean.replace(/^[a-z]+:\/\//, ''); // Strip protocol
  clean = clean.split('/')[0];               // Strip path
  clean = clean.split('?')[0];               // Strip query
  clean = clean.split(':')[0];               // Strip port
  clean = clean.replace(/@.+/, '');          // Strip email if passed reversed
  if (clean.includes('@')) {
    clean = clean.split('@')[1];
  }
  return clean.replace(/^\.+|\.+$/g, '');
}

export function analyzeTyposquatting(domain: string): TyposquattingAnalysis {
  const base = extractBaseDomain(domain);
  const parts = base.split('.');
  const namePart = parts.length > 1 ? parts[parts.length - 2] : parts[0];

  let minDistance = 999;
  let targetBrand: string | null = null;
  let technique: string | null = null;
  const reasons: string[] = [];

  for (const brand of HIGH_VALUE_BRANDS) {
    if (namePart === brand) {
      // Exact match to brand name (e.g. paypal.com)
      continue;
    }

    // Substring brand impersonation (e.g. paypal-security-update.com)
    if (namePart.includes(brand) && namePart.length > brand.length) {
      return {
        isTyposquat: true,
        targetBrand: brand,
        distance: 1,
        similarityScore: 0.92,
        technique: 'Brand Substring / Hyphenated Impersonation',
        reasons: [`Domain label "${namePart}" embeds authentic brand keyword "${brand}"`]
      };
    }

    const dist = levenshteinDistance(namePart, brand);
    if (dist > 0 && dist <= 2 && dist < minDistance) {
      minDistance = dist;
      targetBrand = brand;
      technique = dist === 1 ? 'Single Character Substitution/Omission' : 'Double Character Transposition';
    }
  }

  if (targetBrand && minDistance <= 2) {
    const maxLen = Math.max(namePart.length, targetBrand.length);
    const similarity = Math.max(0, 1 - (minDistance / maxLen));
    reasons.push(`Domain label "${namePart}" is edit distance ${minDistance} from brand "${targetBrand}"`);

    return {
      isTyposquat: true,
      targetBrand,
      distance: minDistance,
      similarityScore: parseFloat(similarity.toFixed(2)),
      technique: technique || 'Lookalike Typosquatting',
      reasons
    };
  }

  return {
    isTyposquat: false,
    targetBrand: null,
    distance: 0,
    similarityScore: 0,
    technique: null,
    reasons: []
  };
}

export async function resolveDomainIntelligence(domainInput: string): Promise<DomainIntelligenceResult> {
  const domain = extractBaseDomain(domainInput);
  const now = new Date().toISOString();

  const [dnsResult, rdapResult] = await Promise.all([
    resolveDns(domain),
    resolveRdap(domain)
  ]);

  const typosquat = analyzeTyposquatting(domain);

  // Correlate domain A records with GeoIP and ASN
  const correlatedIps: Array<{ ip: string; geo: any; asn: any }> = [];
  const candidateIps = (dnsResult.a || []).slice(0, 3); // Top 3 A records

  for (const ip of candidateIps) {
    const [geo, asn] = await Promise.all([
      resolveGeoIp(ip),
      resolveAsn(ip)
    ]);
    correlatedIps.push({ ip, geo, asn });
  }

  const overallStatus = dnsResult.lookupStatus === 'success' || rdapResult.lookupStatus === 'success'
    ? 'success'
    : (dnsResult.lookupStatus === 'nxdomain' ? 'nxdomain' : 'unavailable');

  return {
    domain,
    status: overallStatus,
    error: overallStatus === 'unavailable' ? dnsResult.reason || rdapResult.reason : undefined,
    retrievedAt: now,
    cached: dnsResult.cached && rdapResult.cached,
    dns: dnsResult,
    rdap: rdapResult,
    typosquatting: typosquat,
    correlatedIps,
    provenance: createProvenanceMetadata({
      evidenceType: 'ENRICHED',
      provider: 'TraceXMail Multi-Source Intelligence Engine',
      source: 'DNS + RDAP + MaxMind Correlation',
      status: overallStatus
    })
  };
}
