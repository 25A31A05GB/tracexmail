import { EmailHop } from '../types';

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
