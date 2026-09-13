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
import { RealSenderIpInfo } from '../types';

export type { RealSenderIpInfo };

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
  { key: 'x-auth-ip', display: 'X-Auth-IP' },
  { key: 'x-authenticated-ip', display: 'X-Authenticated-IP' },
  { key: 'x-sender-client-ip', display: 'X-Sender-Client-IP' },
  { key: 'x-originating-client-ip', display: 'X-Originating-Client-IP' },
  { key: 'x-http-client-ip', display: 'X-HTTP-Client-IP' },
  { key: 'x-yahoo-post-ip', display: 'X-Yahoo-Post-IP' },
  { key: 'x-aol-ip', display: 'X-AOL-IP' },
  { key: 'x-mailgun-sending-ip', display: 'X-Mailgun-Sending-Ip' },
  { key: 'x-originating-email', display: 'X-Originating-Email' },
  { key: 'x-proxied-for', display: 'X-Proxied-For' },
  // X-Forwarded-For is added by HTTP webmail front-ends and can
  // legitimately carry a proxy chain. We take the left-most (client-facing) entry.
  { key: 'x-forwarded-for', display: 'X-Forwarded-For' },
  { key: 'x-forwarded-client-ip', display: 'X-Forwarded-Client-IP' }
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

  // Check authenticated client submission in Received headers (ESMTPA / ESMTPSA)
  const receivedHeader = allHeaders['received'] || allHeaders['Received'];
  if (receivedHeader) {
    const recArray = Array.isArray(receivedHeader) ? receivedHeader : [receivedHeader];
    for (const line of recArray) {
      if (typeof line === 'string' && /with\s+ESMTPSA?|authenticated|submission/i.test(line)) {
        const candidateIp = extractIpFromHeaderValue(line);
        if (candidateIp && isPublicRoutableIp(candidateIp)) {
          const maxmind = lookupMaxMindGeo(candidateIp);
          return {
            ip: candidateIp,
            ipSource: 'Received (Authenticated SMTP Submission - ESMTPSA)',
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
      }
    }
  }

  return emptyResult();
}

/**
 * Standardized user-facing IP string for the real sender.
 * Provides provider-aware explanation when an email originates from privacy-preserving webmail like Gmail.
 */
export function formatRealSenderIp(info: RealSenderIpInfo, senderDomain?: string | null): string {
  if (!info.resolved || !info.ip) {
    const domain = (senderDomain || '').toLowerCase();
    if (domain === 'gmail.com' || domain === 'googlemail.com' || domain.endsWith('.google.com')) {
      return "Not disclosed by Gmail (Google strips client device IP for privacy; outbound Google relay MTA shown above). Only Google holds this — law enforcement can request it via Google's Law Enforcement Request System, or civil parties via subpoena through legal counsel. Cite the exact Message-ID and UTC send time below.";
    }
    if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain.endsWith('.microsoft.com')) {
      return "Not disclosed by Microsoft (client device IP omitted by webmail; outbound Microsoft relay MTA shown above). Only Microsoft holds this — law enforcement can request it via Microsoft's Law Enforcement Request System, or civil parties via subpoena through legal counsel. Cite the exact Message-ID and UTC send time below.";
    }
    if (domain === 'yahoo.com' || domain === 'aol.com') {
      return "Not disclosed by Yahoo/AOL (client device IP omitted; outbound relay MTA shown above). Only Yahoo holds this — law enforcement can request it via Yahoo's Law Enforcement Portal, or civil parties via subpoena through legal counsel. Cite the exact Message-ID and UTC send time below.";
    }
    if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
      return "Not disclosed by Apple iCloud (Apple omits client device IP for privacy; outbound relay MTA shown above). Only Apple holds this — law enforcement can request it via Apple's Law Enforcement Portal, or civil parties via subpoena through legal counsel. Cite the exact Message-ID and UTC send time below.";
    }
    return "Not disclosed by sending platform (no client-IP header present; relay MTA IP shown above). Only the sending mail provider holds this — law enforcement can request it via legal process, or civil parties via subpoena through legal counsel. Cite the exact Message-ID and UTC send time below.";
  }
  return info.ip;
}

/**
 * Standardized user-facing location string for the real sender.
 */
export function formatRealSenderLocation(info: RealSenderIpInfo, senderDomain?: string | null): string {
  if (!info.resolved) {
    const domain = (senderDomain || '').toLowerCase();
    if (domain === 'gmail.com' || domain === 'googlemail.com' || domain.endsWith('.google.com')) {
      return 'Unresolved — Gmail client devices connect via HTTPS; Google retains client IP logs internally (accessible via Google LERS / legal process).';
    }
    if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain.endsWith('.microsoft.com')) {
      return 'Unresolved — Microsoft webmail does not publish client device IP in headers; retained in Azure/M365 audit logs.';
    }
    if (domain === 'yahoo.com' || domain === 'aol.com') {
      return 'Unresolved — Yahoo/AOL webmail omits client device IP from modern headers; retained in Yahoo legal response records.';
    }
    if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
      return 'Unresolved — Apple iCloud strips client device IP for privacy; retained in Apple Law Enforcement Records.';
    }
    return "Unresolved — sending platform did not disclose the sender's real client IP; retained in provider authentication/session logs.";
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
