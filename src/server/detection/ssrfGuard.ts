import dns from 'dns';
import net from 'net';

export interface SsrfCheckResult {
  isSafe: boolean;
  reason?: string;
  resolvedIp?: string;
}

// Private & reserved IPv4 CIDR blocks
const BLOCKED_IPV4_RANGES = [
  { min: ipToLong('0.0.0.0'), max: ipToLong('0.255.255.255'), desc: 'Current network' },
  { min: ipToLong('10.0.0.0'), max: ipToLong('10.255.255.255'), desc: 'Private-Use (RFC 1918)' },
  { min: ipToLong('100.64.0.0'), max: ipToLong('100.127.255.255'), desc: 'Shared Address Space' },
  { min: ipToLong('127.0.0.0'), max: ipToLong('127.255.255.255'), desc: 'Loopback' },
  { min: ipToLong('169.254.0.0'), max: ipToLong('169.254.255.255'), desc: 'Link-Local / Cloud Metadata (AWS/GCP/Azure)' },
  { min: ipToLong('172.16.0.0'), max: ipToLong('172.31.255.255'), desc: 'Private-Use (RFC 1918)' },
  { min: ipToLong('192.0.0.0'), max: ipToLong('192.0.0.255'), desc: 'IETF Protocol Assignments' },
  { min: ipToLong('192.0.2.0'), max: ipToLong('192.0.2.255'), desc: 'Documentation TEST-NET-1' },
  { min: ipToLong('192.168.0.0'), max: ipToLong('192.168.255.255'), desc: 'Private-Use (RFC 1918)' },
  { min: ipToLong('198.18.0.0'), max: ipToLong('198.19.255.255'), desc: 'Benchmarking' },
  { min: ipToLong('198.51.100.0'), max: ipToLong('198.51.100.255'), desc: 'Documentation TEST-NET-2' },
  { min: ipToLong('203.0.113.0'), max: ipToLong('203.0.113.255'), desc: 'Documentation TEST-NET-3' },
  { min: ipToLong('224.0.0.0'), max: ipToLong('239.255.255.255'), desc: 'Multicast' },
  { min: ipToLong('240.0.0.0'), max: ipToLong('255.255.255.255'), desc: 'Reserved / Broadcast' }
];

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

export function isBlockedIpv4(ip: string): { blocked: boolean; reason?: string } {
  const parts = ip.split('.');
  if (parts.length !== 4) return { blocked: true, reason: 'Invalid IPv4 octets' };
  for (const part of parts) {
    const num = Number(part);
    if (isNaN(num) || num < 0 || num > 255) {
      return { blocked: true, reason: 'Malformed IPv4 address' };
    }
  }

  const longVal = ipToLong(ip);
  for (const range of BLOCKED_IPV4_RANGES) {
    if (longVal >= range.min && longVal <= range.max) {
      return { blocked: true, reason: `Blocked IPv4 range: ${range.desc} (${ip})` };
    }
  }

  return { blocked: false };
}

export function isBlockedIpv6(ip: string): { blocked: boolean; reason?: string } {
  const lower = ip.toLowerCase().trim();
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') {
    return { blocked: true, reason: 'IPv6 loopback (::1)' };
  }
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') {
    return { blocked: true, reason: 'IPv6 unspecified address (::)' };
  }
  // IPv4-mapped IPv6 ::ffff:127.0.0.1 or ::ffff:a00:1
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.replace('::ffff:', '');
    if (net.isIPv4(mapped)) {
      return isBlockedIpv4(mapped);
    }
  }
  // Link-local: fe80::/10
  if (/^fe[89ab]/i.test(lower)) {
    return { blocked: true, reason: 'IPv6 link-local (fe80::/10)' };
  }
  // Unique local / private: fc00::/7
  if (/^f[cd]/i.test(lower)) {
    return { blocked: true, reason: 'IPv6 unique local / private address (fc00::/7)' };
  }
  return { blocked: false };
}

/**
 * Validates a target URL against SSRF threats.
 * Rejects:
 * - Non http/https schemes (e.g. file:, gopher:, ftp:, data:)
 * - Numeric/hex/octal representations (e.g. 2130706433, 0x7f000001, 017700000001)
 * - Internal hostnames (localhost, *.local, *.internal, *.lan, metadata.google.internal)
 * - DNS-resolved private or loopback IPs (preventing DNS rebinding)
 */
export async function validateSsrfTarget(targetUrl: string): Promise<SsrfCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch (err: any) {
    return { isSafe: false, reason: `Malformed URL: ${err.message}` };
  }

  // 1. Only http & https protocols allowed
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { isSafe: false, reason: `Disallowed protocol "${protocol}". Only http: and https: are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    return { isSafe: false, reason: 'Missing URL hostname' };
  }

  // 2. Reject internal hostnames and suffixes
  const blockedHostnames = ['localhost', 'metadata.google.internal', 'instance-data', '169.254.169.254'];
  if (blockedHostnames.includes(hostname)) {
    return { isSafe: false, reason: `Blocked internal hostname: ${hostname}` };
  }

  const blockedSuffixes = ['.local', '.internal', '.lan', '.home', '.corp', '.test', '.example', '.invalid', '.localhost'];
  for (const suffix of blockedSuffixes) {
    if (hostname.endsWith(suffix)) {
      return { isSafe: false, reason: `Blocked internal domain suffix: ${suffix}` };
    }
  }

  // 3. Reject hex, octal, single integer, or obfuscated IP notations
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return { isSafe: false, reason: 'Blocked decimal/hex obfuscated IP address notation' };
  }
  if (/^0[0-7]+(\.0[0-7]+)*$/.test(hostname)) {
    return { isSafe: false, reason: 'Blocked octal IP address notation' };
  }

  // 4. If hostname is raw IP
  if (net.isIPv4(hostname)) {
    const check = isBlockedIpv4(hostname);
    if (check.blocked) return { isSafe: false, reason: check.reason, resolvedIp: hostname };
    return { isSafe: true, resolvedIp: hostname };
  }

  if (net.isIPv6(hostname)) {
    const cleanIpv6 = hostname.replace(/^\[|\]$/g, '');
    const check = isBlockedIpv6(cleanIpv6);
    if (check.blocked) return { isSafe: false, reason: check.reason, resolvedIp: cleanIpv6 };
    return { isSafe: true, resolvedIp: cleanIpv6 };
  }

  // 5. DNS Resolution check (prevent DNS rebinding & resolution to private subnet)
  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { isSafe: false, reason: `DNS lookup yielded no records for ${hostname}` };
    }

    for (const record of records) {
      if (record.family === 4) {
        const v4Check = isBlockedIpv4(record.address);
        if (v4Check.blocked) {
          return {
            isSafe: false,
            reason: `DNS rebinding protection: domain ${hostname} resolves to blocked IPv4 address ${record.address} (${v4Check.reason})`,
            resolvedIp: record.address
          };
        }
      } else if (record.family === 6) {
        const v6Check = isBlockedIpv6(record.address);
        if (v6Check.blocked) {
          return {
            isSafe: false,
            reason: `DNS rebinding protection: domain ${hostname} resolves to blocked IPv6 address ${record.address} (${v6Check.reason})`,
            resolvedIp: record.address
          };
        }
      }
    }

    return { isSafe: true, resolvedIp: records[0].address };
  } catch (dnsErr: any) {
    return { isSafe: false, reason: `DNS resolution failed for ${hostname}: ${dnsErr.message}` };
  }
}
