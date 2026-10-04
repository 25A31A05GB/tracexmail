import { EmailHop } from '../types';
import { lookupMaxMindGeo } from './maxmindService';

export interface ResolvedOrigin {
  ip: string | null;
  asn: string | null;
  org: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  resolved: boolean; // true only if a real hop with a real public IP was found
}

/**
 * Checks whether an IP string is a valid, routable public IP address.
 * Excludes private RFC 1918, loopback, link-local, carrier-grade NAT, and unmapped entries.
 */
export function isPublicRoutableIp(ip?: string | null): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.trim();
  if (
    clean === '' ||
    clean === 'UNKNOWN' ||
    clean === 'unknown' ||
    clean === 'none' ||
    clean === 'N/A' ||
    clean.startsWith('127.') ||
    clean === '::1' ||
    clean === '0.0.0.0'
  ) {
    return false;
  }

  // IPv6 checks
  if (clean.includes(':')) {
    const lower = clean.toLowerCase();
    if (
      lower === '::1' ||
      lower.startsWith('fe80:') || // Link-local
      lower.startsWith('fc00:') || // ULA
      lower.startsWith('fd00:')
    ) {
      return false;
    }
    return true;
  }

  // IPv4 checks
  const parts = clean.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [p0, p1] = parts;
  // 10.0.0.0/8 (RFC 1918 Class A)
  if (p0 === 10) return false;
  // 172.16.0.0/12 (RFC 1918 Class B)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return false;
  // 192.168.0.0/16 (RFC 1918 Class C)
  if (p0 === 192 && p1 === 168) return false;
  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return false;
  // 169.254.0.0/16 (Link-Local APIPA)
  if (p0 === 169 && p1 === 254) return false;
  // 100.64.0.0/10 (Carrier-Grade NAT / RFC 6598)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return false;
  // 224.0.0.0+ (Multicast / Reserved)
  if (p0 >= 224) return false;

  return true;
}

/**
 * Centrally resolves the true origin hop across an email's Received hops chain.
 * Follows the principle: ZERO FAKE DATA.
 * Returns resolved: false with null fields if no genuine public relay IP was found.
 */
export function resolveOrigin(hops?: EmailHop[] | null): ResolvedOrigin {
  if (!hops || !Array.isArray(hops) || hops.length === 0) {
    return {
      ip: null,
      asn: null,
      org: null,
      city: null,
      country: null,
      lat: null,
      lng: null,
      resolved: false
    };
  }

  // 1. Look for explicit isOrigin hop that has a genuine public IP
  const explicitOrigin = hops.find(
    (h) => h.isOrigin && !h.isPrivate && !h.isRfc1918 && isPublicRoutableIp(h.fromIp)
  );

  // 2. Look for verifiable gateway / public boundary hop
  const gatewayHop = hops.find(
    (h) => (h.isPublicGateway || (h as any).isVerifiableOrigin) && !h.isPrivate && !h.isRfc1918 && isPublicRoutableIp(h.fromIp)
  );

  // 3. Fallback to any hop in the chain with a genuine public IP
  const anyPublicHop = hops.find(
    (h) => !h.isPrivate && !h.isRfc1918 && isPublicRoutableIp(h.fromIp)
  );

  const matched = explicitOrigin || gatewayHop || anyPublicHop;

  if (!matched || !matched.fromIp || !isPublicRoutableIp(matched.fromIp)) {
    return {
      ip: null,
      asn: null,
      org: null,
      city: null,
      country: null,
      lat: null,
      lng: null,
      resolved: false
    };
  }

  const validLat =
    typeof matched.lat === 'number' && !isNaN(matched.lat) ? matched.lat : null;
  const validLng =
    typeof matched.lng === 'number' && !isNaN(matched.lng) ? matched.lng : null;

  return {
    ip: matched.fromIp,
    asn: matched.asn || null,
    org: matched.org || matched.isp || null,
    city: matched.city || null,
    country: matched.country || matched.countryCode || null,
    lat: validLat,
    lng: validLng,
    resolved: true
  };
}

/**
 * Standardized user-facing location string.
 */
export function formatOriginLocation(origin: ResolvedOrigin): string {
  if (!origin.resolved) {
    return 'Origin unresolved — no public relay IP found in Received chain';
  }
  const parts: string[] = [];
  const cleanCity = origin.city ? origin.city.trim() : '';
  const cleanCountry = origin.country ? origin.country.trim() : '';

  if (cleanCity && cleanCountry) {
    if (cleanCity.toLowerCase() === cleanCountry.toLowerCase()) {
      parts.push(cleanCountry);
    } else {
      parts.push(`${cleanCity}, ${cleanCountry}`);
    }
  } else if (cleanCountry) {
    parts.push(cleanCountry);
  } else if (cleanCity) {
    parts.push(cleanCity);
  } else {
    parts.push('Location Unmapped');
  }

  if (origin.asn) {
    const netDetails = origin.org ? `${origin.asn} · ${origin.org}` : origin.asn;
    parts.push(`(${netDetails})`);
  }

  return parts.join(' ');
}

/**
 * Standardized user-facing IP string.
 */
export function formatOriginIp(origin: ResolvedOrigin): string {
  if (!origin.resolved || !origin.ip) {
    return 'Not resolved from headers';
  }
  return origin.ip;
}

/**
 * Helper function to extract Received header chain IPs, identify internal vs external hops,
 * and format them for GeoTracer path visualization.
 * 
 * - Traverses Received headers in chronological order (bottom-to-top).
 * - Distinguishes between Internal (Private RFC 1918 / Loopback) and External (Public Routable Internet) hops.
 * - Resolves External hops against MaxMind GeoLite2 for accurate geographic pathing.
 * - Demarcates the perimeter boundary where traffic transitions from internal intranet to public internet.
 */
export function extractReceivedChainHops(
  rawReceived?: string | string[] | null,
  existingHops?: EmailHop[] | null
): EmailHop[] {
  // If rawReceived is provided, parse the Received headers chronologically
  const receivedLines: string[] = [];
  if (rawReceived) {
    if (Array.isArray(rawReceived)) {
      receivedLines.push(...rawReceived.filter((r): r is string => typeof r === 'string' && r.trim().length > 0));
    } else if (typeof rawReceived === 'string' && rawReceived.trim().length > 0) {
      receivedLines.push(rawReceived);
    }
  }

  // If no rawReceived headers, but existingHops exist, classify and enrich existing hops
  if (receivedLines.length === 0 && existingHops && existingHops.length > 0) {
    let firstExternalFound = false;
    return existingHops.map((hop, idx) => {
      const ip = hop.fromIp || '';
      const isPublic = isPublicRoutableIp(ip);
      const isInternal = !isPublic;
      const hopType: 'internal' | 'external' = isInternal ? 'internal' : 'external';
      
      let hopRole: 'INTERNAL_ORIGIN' | 'EXTERNAL_ORIGIN' | 'TRANSIT_RELAY' | 'INGRESS_GATEWAY';
      if (idx === existingHops.length - 1 && existingHops.length > 1) {
        hopRole = 'INGRESS_GATEWAY';
      } else if (!isInternal && !firstExternalFound) {
        firstExternalFound = true;
        hopRole = 'EXTERNAL_ORIGIN';
      } else if (idx === 0 && isInternal) {
        hopRole = 'INTERNAL_ORIGIN';
      } else {
        hopRole = 'TRANSIT_RELAY';
      }

      const geo = ip && isPublic ? lookupMaxMindGeo(ip) : null;

      return {
        ...hop,
        hopType,
        hopRole,
        isPrivate: isInternal,
        isRfc1918: isInternal,
        isPublicGateway: hopRole === 'EXTERNAL_ORIGIN',
        city: isInternal ? 'Internal Subnet' : (hop.city || geo?.city || 'Public Relay Space'),
        country: isInternal ? 'Private Network (RFC 1918)' : (hop.country || geo?.country || 'Global Routing Area'),
        countryCode: isInternal ? 'LAN' : (hop.countryCode || geo?.countryCode || 'NET'),
        lat: isInternal ? undefined : (typeof hop.lat === 'number' ? hop.lat : geo?.lat),
        lng: isInternal ? undefined : (typeof hop.lng === 'number' ? hop.lng : geo?.lng),
        asn: isInternal ? 'RFC 1918' : (hop.asn || (geo?.asn ? `AS${geo.asn}` : 'Unannounced')),
        org: isInternal ? 'Corporate Intranet Segment' : (hop.org || geo?.org || 'Internet Relay Host'),
        maxmindVerified: isPublic && Boolean(geo?.isVerified)
      };
    });
  }

  // Parse raw Received headers chronologically (bottom-to-top is Hop 1 -> Hop N)
  const orderedReceived = [...receivedLines].reverse();
  const hops: EmailHop[] = [];
  let firstExternalFound = false;

  orderedReceived.forEach((recv, idx) => {
    // 1. IP extraction (brackets, parentheses, plain IPv4/IPv6)
    const bracketMatch = recv.match(/\[(?:IPv6:)?([a-fA-F0-9.:]+)\]/);
    const parenMatch = recv.match(/\(((?:[a-zA-Z0-9.-]+\s+)?(?:\[)?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(?:\])?)\)/);
    const rawIps = recv.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g) || [];
    const extractedIp = bracketMatch ? bracketMatch[1] : parenMatch ? parenMatch[2] : rawIps[0];
    const ip = extractedIp && extractedIp !== '127.0.0.1' ? extractedIp : (rawIps[0] || extractedIp);

    // 2. Host extraction
    const fromMatch = recv.match(/\bfrom\s+([^\s;()\[\]]+)/i);
    const rawFromHost = fromMatch && fromMatch[1] !== '(' && fromMatch[1] !== '[' ? fromMatch[1].trim() : undefined;
    const fromHost = rawFromHost || (ip ? `host-${ip.replace(/[.:]/g, '-')}` : 'mailer-relay');

    const byMatch = recv.match(/\bby\s+([^\s;()\[\]]+)/i);
    const byHost = byMatch ? byMatch[1].trim() : 'mx-ingress';

    // 3. Protocol
    const protoMatch = recv.match(/\bwith\s+([a-zA-Z0-9_-]+)/i);
    const protocol = protoMatch ? protoMatch[1].toUpperCase() : 'ESMTP';

    // 4. Timestamp & Delay calculation
    let timestamp = new Date().toUTCString();
    let parsedDateMs: number | null = null;
    const semiIdx = recv.lastIndexOf(';');
    if (semiIdx !== -1) {
      const rawDateStr = recv.substring(semiIdx + 1).trim();
      const d = new Date(rawDateStr);
      if (!isNaN(d.getTime())) {
        timestamp = d.toUTCString();
        parsedDateMs = d.getTime();
      } else if (rawDateStr) {
        timestamp = rawDateStr;
      }
    }

    let delaySec = 0;
    if (idx > 0 && parsedDateMs !== null) {
      const prevHop = hops[idx - 1];
      if (prevHop && prevHop.timestamp) {
        const prevTimeMs = new Date(prevHop.timestamp).getTime();
        if (!isNaN(prevTimeMs) && parsedDateMs >= prevTimeMs) {
          delaySec = Math.round((parsedDateMs - prevTimeMs) / 1000);
        }
      }
    }

    // 5. Internal vs External Identification
    const isPublic = isPublicRoutableIp(ip);
    const isInternal = !isPublic;
    const hopType: 'internal' | 'external' = isInternal ? 'internal' : 'external';

    // 6. Role Assignment & Perimeter Demarcation
    const isLast = idx === orderedReceived.length - 1;
    let hopRole: 'INTERNAL_ORIGIN' | 'EXTERNAL_ORIGIN' | 'TRANSIT_RELAY' | 'INGRESS_GATEWAY';
    if (isLast && idx > 0) {
      hopRole = 'INGRESS_GATEWAY';
    } else if (!isInternal && !firstExternalFound) {
      firstExternalFound = true;
      hopRole = 'EXTERNAL_ORIGIN';
    } else if (idx === 0 && isInternal) {
      hopRole = 'INTERNAL_ORIGIN';
    } else {
      hopRole = 'TRANSIT_RELAY';
    }

    // 7. MaxMind GeoIP resolution for external hops
    const geo = ip && isPublic ? lookupMaxMindGeo(ip) : null;
    const isTor = Boolean(geo?.isTor);
    const isVpn = Boolean(geo?.isAnonymousProxy && !geo?.isTor);

    hops.push({
      hopNumber: idx + 1,
      fromHost,
      fromIp: ip,
      byHost,
      protocol,
      timestamp,
      delaySec,
      hopType,
      hopRole,
      city: isInternal ? 'Internal Subnet' : (geo?.city || 'Public Relay Space'),
      country: isInternal ? 'Private Network (RFC 1918)' : (geo?.country || 'Global Routing Area'),
      countryCode: isInternal ? 'LAN' : (geo?.countryCode || 'NET'),
      lat: isInternal ? undefined : geo?.lat,
      lng: isInternal ? undefined : geo?.lng,
      asn: isInternal ? 'RFC 1918' : (geo?.asn ? `AS${geo.asn}` : 'Unannounced'),
      org: isInternal ? 'Corporate Intranet Segment' : (geo?.org || 'Internet Relay Host'),
      reverseDns: ip ? (isInternal ? 'Internal Hostname (No PTR)' : geo?.reverseDns) : undefined,
      abuseScore: 0,
      isBlacklisted: false,
      isProxyOrVpn: isVpn,
      isTorExitNode: isTor,
      is_tor: isTor,
      is_vpn: isVpn,
      isOrigin: hopRole === 'EXTERNAL_ORIGIN' || (idx === 0 && !firstExternalFound),
      isPublicGateway: hopRole === 'EXTERNAL_ORIGIN',
      isPrivate: isInternal,
      isRfc1918: isInternal,
      lookupMethod: isInternal ? 'RFC 1918 Subnet Classifier' : (geo?.lookupMethod || 'MaxMind GeoLite2'),
      geonameId: geo?.geonameId,
      continentCode: geo?.continentCode,
      continentName: geo?.continentName,
      timeZone: geo?.timeZone,
      isInEuropeanUnion: geo?.isInEuropeanUnion,
      accuracyRadius: geo?.accuracyRadius || 25,
      maxmindVerified: isPublic && Boolean(geo?.isVerified),
      maxmindSource: geo?.sourceFile,
      maxmindCopyright: geo?.copyright,
      maxmindLicense: geo?.license
    });
  });

  return hops;
}

