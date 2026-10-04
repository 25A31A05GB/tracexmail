// TraceXMail — Real Sender (Client) IP & Geolocation Resolver
//
// Identifies the true client IP — the address the sender's mail client or session
// connected FROM — as distinct from intermediate mail relays and datacenters.
//
// Extracts from:
// 1. Authenticated submission hops: `with ESMTPSA` (e.g. Gmail SMTP, Apple Mail, Outlook client)
// 2. Explicit client headers: `X-Originating-IP`, `X-Client-IP`, `X-Rocket-Received`, `X-Sender-IP`
// 3. SPF / Authentication-Results client-ip signatures
// 4. Correlates client software (User-Agent, X-Mailer) and timezone bias

import { isPublicRoutableIp } from './originResolution';
import { lookupMaxMindGeo } from './maxmindService';
import { RealSenderIpInfo } from '../types';

export type { RealSenderIpInfo };

function emptyResult(domain?: string | null): RealSenderIpInfo {
  const normDomain = (domain || '').toLowerCase();
  const isGmail = normDomain === 'gmail.com' || normDomain.endsWith('.google.com');
  const isOutlook = normDomain === 'outlook.com' || normDomain === 'hotmail.com' || normDomain.endsWith('.microsoft.com');
  const isYahoo = normDomain === 'yahoo.com' || normDomain === 'aol.com';
  const isICloud = normDomain === 'icloud.com' || normDomain === 'me.com' || normDomain === 'mac.com';

  const isWebmail = isGmail || isOutlook || isYahoo || isICloud;

  return {
    ip: null,
    ipSource: null,
    originClassification: isWebmail ? 'WEBMAIL_MASKED_DATACENTER' : 'DIRECT_SMTP_EGRESS',
    clientSoftware: null,
    timezoneOffset: null,
    timezoneAnomaly: false,
    privacyMaskingActive: isWebmail,
    privacyProviderNotice: isGmail 
      ? 'Google Gmail Webmail Privacy Policy (strips originating client IP on web compose; logs retained in Google LERS)'
      : isOutlook
      ? 'Microsoft 365 Webmail Privacy Policy (omits client IP on web compose; logs retained in Azure audit logs)'
      : isYahoo
      ? 'Yahoo Webmail Privacy Standard (omits client device IP from modern web sessions)'
      : isICloud
      ? 'Apple iCloud Privacy Shield (omits client device IP for privacy)'
      : null,
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

// Ordered by forensic reliability — first genuine public IP match wins.
const REAL_SENDER_IP_HEADERS: Array<{ key: string; display: string }> = [
  { key: 'x-originating-ip', display: 'X-Originating-IP' },
  { key: 'x-client-ip', display: 'X-Client-IP' },
  { key: 'x-rocket-received', display: 'X-Rocket-Received (Yahoo Client)' },
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
  { key: 'x-forwarded-for', display: 'X-Forwarded-For' },
  { key: 'x-forwarded-client-ip', display: 'X-Forwarded-Client-IP' }
];

function firstValue(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const IPV4_PATTERN = /(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}/g;

/**
 * Extracts all candidate IPv4 and IPv6 strings from a header value,
 * returning them in order of appearance.
 */
function extractAllCandidateIps(value: string): string[] {
  if (!value) return [];
  const candidates: string[] = [];

  // 1. Bracketed forms e.g. [198.51.100.24] or [IPv6:2001:db8::1]
  const bracketMatches = value.match(/\[(?:IPv6:)?([a-fA-F0-9.:]+)\]/gi);
  if (bracketMatches) {
    for (const b of bracketMatches) {
      const clean = b.replace(/^\[(?:IPv6:)?/i, '').replace(/\]$/, '');
      if (clean && !candidates.includes(clean)) candidates.push(clean);
    }
  }

  // 2. Comma-separated or whitespace-separated standard IPv4
  const plainMatches = value.match(IPV4_PATTERN);
  if (plainMatches) {
    for (const p of plainMatches) {
      if (p && !candidates.includes(p)) candidates.push(p);
    }
  }

  return candidates;
}

/**
 * Extracts sender client software or user-agent
 */
function detectClientSoftware(headers: Record<string, string>): string | null {
  const mailer = headers['x-mailer'] || headers['user-agent'] || headers['x-client-agent'] || headers['x-mimeole'];
  if (mailer) return mailer.trim();

  if (headers['x-google-smtp-source']) {
    return 'Google Workspace / Gmail Core Infrastructure';
  }
  return null;
}

/**
 * Extracts the timezone offset from the Date: header (e.g. "+0530", "-0400", "+0000")
 */
function extractTimezoneOffset(dateStr?: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/([+-]\d{4})(?:\s*\([A-Z]{3,4}\))?$/);
  return match ? match[1] : null;
}

/**
 * Scans an email's full header set for a webmail/MTA-injected header that reveals the
 * true originating client (human sender) IP — as opposed to the sending domain's
 * registered outbound mail relay IP surfaced via Received: hop tracing.
 */
export function extractRealSenderIp(
  allHeaders?: Record<string, string | string[] | undefined> | null,
  senderDomain?: string | null
): RealSenderIpInfo {
  if (!allHeaders) return emptyResult(senderDomain);

  // Case-insensitive lookup table
  const lowerMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(allHeaders)) {
    const val = firstValue(v);
    if (val !== undefined) lowerMap[k.toLowerCase()] = val;
  }

  const clientSoftware = detectClientSoftware(lowerMap);
  const timezoneOffset = extractTimezoneOffset(lowerMap['date']);

  // 1. Check explicit client-IP headers (X-Originating-IP, X-Client-IP, X-Rocket-Received, etc.)
  for (const { key, display } of REAL_SENDER_IP_HEADERS) {
    const rawVal = lowerMap[key];
    if (!rawVal) continue;

    const candidates = extractAllCandidateIps(rawVal);
    for (const candidateIp of candidates) {
      if (isPublicRoutableIp(candidateIp)) {
        const maxmind = lookupMaxMindGeo(candidateIp);
        return {
          ip: candidateIp,
          ipSource: display,
          originClassification: 'EXPLICIT_HEADER_STAMPED',
          clientSoftware,
          timezoneOffset,
          timezoneAnomaly: false,
          privacyMaskingActive: false,
          privacyProviderNotice: null,
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

  // 2. Check authenticated client submission in Received headers (ESMTPA / ESMTPSA / submission / authenticated)
  // This is where Gmail, Apple Mail, Thunderbird, and Postfix/Exim stamp the human user's public IP
  const receivedHeader = allHeaders['received'] || allHeaders['Received'];
  if (receivedHeader) {
    const recArray = Array.isArray(receivedHeader) ? receivedHeader : [receivedHeader];
    
    // Evaluate in reverse (chronological order: bottom-most is earliest sender submission)
    const reversed = [...recArray].reverse();
    for (const line of reversed) {
      if (typeof line === 'string') {
        const isAuthenticatedSubmission = /with\s+ESMTPSA?|authenticated|submission|smtpsa/i.test(line);
        if (isAuthenticatedSubmission) {
          const candidates = extractAllCandidateIps(line);
          for (const candidateIp of candidates) {
            if (isPublicRoutableIp(candidateIp)) {
              const maxmind = lookupMaxMindGeo(candidateIp);
              return {
                ip: candidateIp,
                ipSource: 'Received: with ESMTPSA (Authenticated SMTP Client Submission)',
                originClassification: 'AUTHENTICATED_MUA_CLIENT',
                clientSoftware,
                timezoneOffset,
                timezoneAnomaly: false,
                privacyMaskingActive: false,
                privacyProviderNotice: null,
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
    }
  }

  // 3. Check Received-SPF or Authentication-Results client-ip parameter
  const authHeaders = [lowerMap['received-spf'], lowerMap['authentication-results']];
  for (const authHeader of authHeaders) {
    if (!authHeader) continue;
    const match = authHeader.match(/client-ip=([0-9a-fA-F.:]+)/i);
    if (match && isPublicRoutableIp(match[1])) {
      const candidateIp = match[1];
      const maxmind = lookupMaxMindGeo(candidateIp);
      return {
        ip: candidateIp,
        ipSource: 'Received-SPF client-ip authentication parameter',
        originClassification: 'DIRECT_SMTP_EGRESS',
        clientSoftware,
        timezoneOffset,
        timezoneAnomaly: false,
        privacyMaskingActive: false,
        privacyProviderNotice: null,
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

  return emptyResult(senderDomain);
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
