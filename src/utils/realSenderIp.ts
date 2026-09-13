// TraceXMail — Real Sender (Client) IP Resolver
//
// The "Origin Relay IP" resolved from Received: headers is the IP of the sending
// MAIL SERVER / infrastructure that accepted the message for the domain (i.e. the
// domain's own registered outbound relay — Gmail's smtp-relay, O365's front-door,
// a company's mail gateway, etc). That is NOT the human being's actual device/network IP.
//
// Many mail systems additionally stamp the true client IP — the address the sender's
// mail client or webmail session connected FROM — into a separate, non-Received header
// before the message is handed off to the outbound relay. This module looks for that
// signal specifically, keeps it clearly separate from the relay/origin IP, and geolocates
// it using the same offline MaxMind pipeline used everywhere else in the app.
//
// Principle: ZERO FAKE DATA. If no such header exists (most consumer webmail providers,
// e.g. Gmail's browser compose, do not leak it for privacy reasons), we return
// resolved: false rather than inventing a value.

import { isPublicRoutableIp } from './originResolution';
import { lookupMaxMindGeo } from './maxmindService';

export interface RealSenderIpInfo {
  ip: string | null;
  /** Which header the IP was recovered from, e.g. "X-Originating-IP" */
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
  isProxyOrVpn: boolean;
  isTor: boolean;
  maxmindVerified: boolean;
  /** true only if a genuine public client IP was recovered from a known header */
  resolved: boolean;
}

function emptyResult(): RealSenderIpInfo {
  return {
    ip: null,
    ipSource: null,
    city: null,
    region: null,
    country: null,
    countryCode: null,
    lat: null,
    lng: null,
    asn: null,
    org: null,
    isp: null,
    reverseDns: null,
    isProxyOrVpn: false,
    isTor: false,
    maxmindVerified: false,
    resolved: false
  };
}

// Ordered by reliability — first genuine public IP match wins.
// Display-name kept alongside the lookup key so the UI/reports can cite the exact header.
const REAL_SENDER_IP_HEADERS: Array<{ key: string; display: string }> = [
  { key: 'x-originating-ip', display: 'X-Originating-IP' },
  { key: 'x-client-ip', display: 'X-Client-IP' },
  { key: 'x-sender-ip', display: 'X-Sender-IP' },
  { key: 'x-real-ip', display: 'X-Real-IP' },
  { key: 'x-source-ip', display: 'X-Source-IP' },
  { key: 'x-remote-ip', display: 'X-Remote-IP' },
  { key: 'x-yahoo-post-ip', display: 'X-Yahoo-Post-IP' },
  { key: 'x-aol-ip', display: 'X-AOL-IP' },
  { key: 'x-mailgun-sending-ip', display: 'X-Mailgun-Sending-Ip' },
  { key: 'x-originating-email', display: 'X-Originating-Email' },
  // X-Forwarded-For is a last resort: it's added by HTTP webmail front-ends and can
  // legitimately carry a proxy chain. We take the left-most (client-facing) entry.
  { key: 'x-forwarded-for', display: 'X-Forwarded-For' }
];

function firstValue(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const IPV4_RE = /((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})/;
const IPV6_RE = /([a-fA-F0-9]{0,4}:[a-fA-F0-9:]{2,})/;

function extractIpFromHeaderValue(value: string): string | null {
  if (!value) return null;

  // Bracketed forms: [1.2.3.4] or [IPv6:2001:db8::1]
  const bracketMatch = value.match(/\[(?:IPv6:)?([a-fA-F0-9.:]+)\]/i);
  if (bracketMatch) {
    const candidate = bracketMatch[1];
    if (IPV4_RE.test(candidate) || candidate.includes(':')) return candidate;
  }

  // X-Forwarded-For style comma-separated chain — take the left-most (originating) hop
  const firstSegment = value.split(',')[0].trim();

  const ipv4Match = firstSegment.match(IPV4_RE);
  if (ipv4Match) return ipv4Match[1];

  const ipv6Match = firstSegment.match(IPV6_RE);
  if (ipv6Match && ipv6Match[1].includes(':') && ipv6Match[1].split(':').length > 2) {
    return ipv6Match[1];
  }

  return null;
}

/**
 * Scans an email's full header set for a webmail/MTA-injected header that reveals the
 * true originating client (human sender) IP — as opposed to the sending domain's
 * registered outbound mail relay IP surfaced via Received: hop tracing.
 */
export function extractRealSenderIp(
  allHeaders?: Record<string, string | string[] | undefined> | null
): RealSenderIpInfo {
  if (!allHeaders) return emptyResult();

  // Case-insensitive lookup table
  const lowerMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(allHeaders)) {
    const val = firstValue(v);
    if (val !== undefined) lowerMap[k.toLowerCase()] = val;
  }

  for (const { key, display } of REAL_SENDER_IP_HEADERS) {
    const rawVal = lowerMap[key];
    if (!rawVal) continue;

    const candidateIp = extractIpFromHeaderValue(rawVal);
    if (!candidateIp || !isPublicRoutableIp(candidateIp)) continue;

    const maxmind = lookupMaxMindGeo(candidateIp);

    return {
      ip: candidateIp,
      ipSource: display,
      city: maxmind.found ? maxmind.city ?? null : null,
      region: maxmind.found ? maxmind.region ?? null : null,
      country: maxmind.found ? maxmind.country ?? null : null,
      countryCode: maxmind.found ? maxmind.countryCode ?? null : null,
      lat: maxmind.found ? maxmind.lat ?? null : null,
      lng: maxmind.found ? maxmind.lng ?? null : null,
      asn: maxmind.found ? maxmind.asn ?? null : null,
      org: maxmind.found ? maxmind.org ?? null : null,
      isp: maxmind.found ? (maxmind.isp ?? maxmind.org ?? null) : null,
      reverseDns: maxmind.found ? maxmind.reverseDns ?? null : null,
      isProxyOrVpn: Boolean(maxmind.isAnonymousProxy),
      isTor: Boolean(maxmind.isTor),
      maxmindVerified: Boolean(maxmind.isVerified),
      resolved: true
    };
  }

  return emptyResult();
}

/**
 * Standardized user-facing IP string for the real sender.
 */
export function formatRealSenderIp(info: RealSenderIpInfo): string {
  if (!info.resolved || !info.ip) {
    return 'Not disclosed by sending platform (no client-IP header present)';
  }
  return info.ip;
}

/**
 * Standardized user-facing location string for the real sender.
 */
export function formatRealSenderLocation(info: RealSenderIpInfo): string {
  if (!info.resolved) {
    return 'Unresolved — sending platform did not leak the sender\'s real client IP';
  }
  const parts: string[] = [];
  if (info.city && info.country) {
    parts.push(`${info.city}, ${info.country}`);
  } else if (info.country) {
    parts.push(info.country);
  } else if (info.city) {
    parts.push(info.city);
  } else {
    parts.push('Location Unmapped');
  }
  if (info.asn) {
    parts.push(info.org ? `(${info.asn} · ${info.org})` : `(${info.asn})`);
  }
  return parts.join(' ');
}
