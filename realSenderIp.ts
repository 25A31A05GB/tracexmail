// src/utils/realSenderIp.ts

import { isPublicRoutableIp } from './originResolution';
import { lookupMaxMindGeo } from './maxmindService';

export interface RealSenderIpInfo {
  ip: string | null;
  ipSource: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  asn: string | null;
  org: string | null;
  isp: string | null;
  reverseDns: string | null;
  isProxyOrVpn: boolean | null;
  isTor: boolean | null;
  maxmindVerified: boolean | null;
  resolved: boolean;
}

const CLIENT_IP_HEADERS = [
  'x-originating-ip',
  'x-client-ip',
  'x-sender-ip',
  'x-real-ip',
  'x-source-ip',
  'x-remote-ip',
  'x-yahoo-post-ip',
  'x-aol-ip',
  'x-mailgun-sending-ip',
  'x-originating-email',
  'x-forwarded-for'
];

function extractIpFromString(value: string): string | null {
  // Handle comma-separated lists (like X-Forwarded-For) - take the leftmost
  const firstPart = value.split(',')[0].trim();
  
  // Extract IPv4 or IPv6 from brackets e.g., [1.2.3.4] or [IPv6:...]
  const bracketMatch = firstPart.match(/\[(?:IPv6:)?([^\]]+)\]/i);
  if (bracketMatch && bracketMatch[1]) {
    return bracketMatch[1].trim();
  }
  
  // Return bare IP
  return firstPart;
}

export function extractRealSenderIp(
  allHeaders?: Record<string, string | string[] | undefined> | null
): RealSenderIpInfo {
  const defaultEmpty: RealSenderIpInfo = {
    ip: null, ipSource: null, city: null, region: null, country: null,
    countryCode: null, lat: null, lng: null, asn: null, org: null,
    isp: null, reverseDns: null, isProxyOrVpn: null, isTor: null,
    maxmindVerified: null, resolved: false
  };

  if (!allHeaders) return defaultEmpty;

  // Convert headers to lowercase for case-insensitive lookup
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(allHeaders)) {
    if (!val) continue;
    normalizedHeaders[key.toLowerCase()] = Array.isArray(val) ? val[0] : val;
  }

  for (const headerName of CLIENT_IP_HEADERS) {
    const headerValue = normalizedHeaders[headerName];
    if (headerValue) {
      const candidateIp = extractIpFromString(headerValue);
      
      if (candidateIp && isPublicRoutableIp(candidateIp)) {
        const geo = lookupMaxMindGeo(candidateIp);
        
        return {
          ip: candidateIp,
          ipSource: `via ${headerName}`,
          city: geo?.city || null,
          region: geo?.region || null,
          country: geo?.country || null,
          countryCode: geo?.countryCode || null,
          lat: geo?.lat || null,
          lng: geo?.lng || null,
          asn: geo?.asn || null,
          org: geo?.org || null,
          isp: geo?.isp || null,
          reverseDns: null, // Reverse DNS would require async lookup, keeping sync for now
          isProxyOrVpn: geo?.isProxyOrVpn || false,
          isTor: geo?.isTor || false,
          maxmindVerified: !!geo,
          resolved: true
        };
      }
    }
  }

  return defaultEmpty;
}

export function formatRealSenderIp(info: RealSenderIpInfo): string {
  if (!info.resolved || !info.ip) {
    return "Not disclosed by sending platform (no client-IP header present)";
  }
  return `${info.ip} (${info.ipSource})`;
}

export function formatRealSenderLocation(info: RealSenderIpInfo): string {
  if (!info.resolved) {
    return "Unresolved — sending platform did not leak the sender's real client IP";
  }
  
  const locationParts = [info.city, info.country].filter(Boolean);
  const locationString = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location';
  
  const networkParts = [info.asn, info.org].filter(Boolean);
  const networkString = networkParts.length > 0 ? `(${networkParts.join(' · ')})` : '';
  
  return `${locationString} ${networkString}`.trim();
}