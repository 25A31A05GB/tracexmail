import net from 'net';
import { IpValidationResult } from './types';

// RFC 5737 / RFC 1918 / RFC 3927 / RFC 6598 / RFC 1122 IP classifier
export function validateAndClassifyIp(rawIp?: string | null): IpValidationResult {
  const sanitized = (rawIp || '').trim().replace(/^\[|\]$/g, '');

  if (!sanitized) {
    return {
      ip: '',
      isValid: false,
      isIpv4: false,
      isIpv6: false,
      isPublic: false,
      isPrivate: false,
      isRfc1918: false,
      isLoopback: false,
      isLinkLocal: false,
      isCarrierNat: false,
      isReserved: false,
      isMulticast: false,
      scope: 'INVALID_SYNTAX',
      subnetType: 'Empty / Unspecified',
      cidr: 'N/A',
      description: 'No IP address provided',
      lookupStatus: 'invalid',
      reason: 'empty_address'
    };
  }

  // Reject URLs or scheme prefixes
  if (sanitized.includes('://') || sanitized.includes('/') || sanitized.includes('?') || sanitized.includes('#')) {
    return {
      ip: sanitized,
      isValid: false,
      isIpv4: false,
      isIpv6: false,
      isPublic: false,
      isPrivate: false,
      isRfc1918: false,
      isLoopback: false,
      isLinkLocal: false,
      isCarrierNat: false,
      isReserved: false,
      isMulticast: false,
      scope: 'INVALID_SYNTAX',
      subnetType: 'Invalid Format / URL',
      cidr: 'N/A',
      description: 'URLs, paths, or CIDR notations are rejected for host IP lookups',
      lookupStatus: 'invalid',
      reason: 'url_or_path_not_allowed'
    };
  }

  const ipFamily = net.isIP(sanitized);

  if (ipFamily === 0) {
    return {
      ip: sanitized,
      isValid: false,
      isIpv4: false,
      isIpv6: false,
      isPublic: false,
      isPrivate: false,
      isRfc1918: false,
      isLoopback: false,
      isLinkLocal: false,
      isCarrierNat: false,
      isReserved: false,
      isMulticast: false,
      scope: 'INVALID_SYNTAX',
      subnetType: 'Malformed / Hostname',
      cidr: 'N/A',
      description: 'Hostnames or malformed addresses are rejected for IP validation',
      lookupStatus: 'invalid',
      reason: 'invalid_ip_format'
    };
  }

  // IPv4 processing
  if (ipFamily === 4) {
    const octets = sanitized.split('.').map(p => parseInt(p, 10));
    const [p0, p1, p2] = octets;

    // 127.0.0.0/8 - Loopback (RFC 1122)
    if (p0 === 127) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: true,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: true,
        isMulticast: false,
        scope: 'LOOPBACK_RFC1122',
        subnetType: 'RFC 1122 Loopback',
        cidr: '127.0.0.0/8',
        description: 'Loopback interface internal to local machine',
        lookupStatus: 'not_applicable',
        reason: 'loopback_address'
      };
    }

    // 0.0.0.0/8 - "This network" (RFC 1122)
    if (p0 === 0) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: true,
        isMulticast: false,
        scope: 'RESERVED',
        subnetType: 'RFC 1122 Current Network',
        cidr: '0.0.0.0/8',
        description: 'Non-routable source address',
        lookupStatus: 'not_applicable',
        reason: 'reserved_address'
      };
    }

    // 10.0.0.0/8 - RFC 1918 Class A
    if (p0 === 10) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: true,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: false,
        isMulticast: false,
        scope: 'PRIVATE_RFC1918',
        subnetType: 'RFC 1918 Class A',
        cidr: '10.0.0.0/8',
        description: 'Private Enterprise Intranet relay node',
        lookupStatus: 'not_applicable',
        reason: 'private_address'
      };
    }

    // 172.16.0.0/12 - RFC 1918 Class B
    if (p0 === 172 && p1 >= 16 && p1 <= 31) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: true,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: false,
        isMulticast: false,
        scope: 'PRIVATE_RFC1918',
        subnetType: 'RFC 1918 Class B',
        cidr: '172.16.0.0/12',
        description: 'Private Corporate LAN relay node',
        lookupStatus: 'not_applicable',
        reason: 'private_address'
      };
    }

    // 192.168.0.0/16 - RFC 1918 Class C
    if (p0 === 192 && p1 === 168) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: true,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: false,
        isMulticast: false,
        scope: 'PRIVATE_RFC1918',
        subnetType: 'RFC 1918 Class C',
        cidr: '192.168.0.0/16',
        description: 'Private Local Area Network node',
        lookupStatus: 'not_applicable',
        reason: 'private_address'
      };
    }

    // 169.254.0.0/16 - Link-Local / APIPA (RFC 3927)
    if (p0 === 169 && p1 === 254) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: false,
        isLinkLocal: true,
        isCarrierNat: false,
        isReserved: false,
        isMulticast: false,
        scope: 'LINK_LOCAL_RFC3927',
        subnetType: 'RFC 3927 Link-Local (APIPA)',
        cidr: '169.254.0.0/16',
        description: 'Non-routable auto-configured link-local address',
        lookupStatus: 'not_applicable',
        reason: 'link_local_address'
      };
    }

    // 100.64.0.0/10 - Carrier-Grade NAT (RFC 6598)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: true,
        isReserved: false,
        isMulticast: false,
        scope: 'SHARED_CGNAT_RFC6598',
        subnetType: 'RFC 6598 Carrier-Grade NAT',
        cidr: '100.64.0.0/10',
        description: 'ISP Shared Address Space / CGNAT',
        lookupStatus: 'not_applicable',
        reason: 'carrier_nat_address'
      };
    }

    // 224.0.0.0/4 - Multicast (RFC 5771)
    if (p0 >= 224 && p0 <= 239) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: true,
        isMulticast: true,
        scope: 'MULTICAST',
        subnetType: 'RFC 5771 Multicast',
        cidr: '224.0.0.0/4',
        description: 'Multicast Group address',
        lookupStatus: 'not_applicable',
        reason: 'multicast_address'
      };
    }

    // 240.0.0.0/4 - Reserved (RFC 1112)
    if (p0 >= 240) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: true,
        isMulticast: false,
        scope: 'RESERVED',
        subnetType: 'RFC 1112 Reserved',
        cidr: '240.0.0.0/4',
        description: 'Reserved for future use',
        lookupStatus: 'not_applicable',
        reason: 'reserved_address'
      };
    }

    // 192.0.2.0/24 (TEST-NET-1), 198.51.100.0/24 (TEST-NET-2), 203.0.113.0/24 (TEST-NET-3)
    if ((p0 === 192 && p1 === 0 && p2 === 2) || (p0 === 198 && p1 === 51 && p2 === 100) || (p0 === 203 && p1 === 0 && p2 === 113)) {
      return {
        ip: sanitized,
        isValid: true,
        isIpv4: true,
        isIpv6: false,
        isPublic: false,
        isPrivate: true,
        isRfc1918: false,
        isLoopback: false,
        isLinkLocal: false,
        isCarrierNat: false,
        isReserved: true,
        isMulticast: false,
        scope: 'RESERVED',
        subnetType: 'RFC 5737 Documentation Network',
        cidr: 'TEST-NET',
        description: 'Documentation and benchmark test network',
        lookupStatus: 'not_applicable',
        reason: 'reserved_address'
      };
    }

    // Routable Public IPv4
    return {
      ip: sanitized,
      isValid: true,
      isIpv4: true,
      isIpv6: false,
      isPublic: true,
      isPrivate: false,
      isRfc1918: false,
      isLoopback: false,
      isLinkLocal: false,
      isCarrierNat: false,
      isReserved: false,
      isMulticast: false,
      scope: 'PUBLIC_ROUTABLE',
      subnetType: 'Public Routable IPv4',
      cidr: `${sanitized}/32`,
      description: 'Globally routed public IPv4 Internet relay node',
      lookupStatus: 'valid'
    };
  }

  // IPv6 processing
  const lowerV6 = sanitized.toLowerCase();

  // ::1 - Loopback (RFC 4291)
  if (lowerV6 === '::1' || lowerV6 === '0:0:0:0:0:0:0:1') {
    return {
      ip: sanitized,
      isValid: true,
      isIpv4: false,
      isIpv6: true,
      isPublic: false,
      isPrivate: true,
      isRfc1918: false,
      isLoopback: true,
      isLinkLocal: false,
      isCarrierNat: false,
      isReserved: true,
      isMulticast: false,
      scope: 'LOOPBACK_RFC1122',
      subnetType: 'RFC 4291 IPv6 Loopback',
      cidr: '::1/128',
      description: 'IPv6 Loopback interface',
      lookupStatus: 'not_applicable',
      reason: 'loopback_address'
    };
  }

  // fe80::/10 - Link-Local (RFC 4291)
  if (lowerV6.startsWith('fe8') || lowerV6.startsWith('fe9') || lowerV6.startsWith('fea') || lowerV6.startsWith('feb')) {
    return {
      ip: sanitized,
      isValid: true,
      isIpv4: false,
      isIpv6: true,
      isPublic: false,
      isPrivate: true,
      isRfc1918: false,
      isLoopback: false,
      isLinkLocal: true,
      isCarrierNat: false,
      isReserved: false,
      isMulticast: false,
      scope: 'LINK_LOCAL_RFC3927',
      subnetType: 'RFC 4291 IPv6 Link-Local',
      cidr: 'fe80::/10',
      description: 'Non-routable IPv6 Link-Local address',
      lookupStatus: 'not_applicable',
      reason: 'link_local_address'
    };
  }

  // fc00::/7 - Unique Local Address (RFC 4193)
  if (lowerV6.startsWith('fc') || lowerV6.startsWith('fd')) {
    return {
      ip: sanitized,
      isValid: true,
      isIpv4: false,
      isIpv6: true,
      isPublic: false,
      isPrivate: true,
      isRfc1918: true, // Functionally private intranet
      isLoopback: false,
      isLinkLocal: false,
      isCarrierNat: false,
      isReserved: false,
      isMulticast: false,
      scope: 'PRIVATE_RFC1918',
      subnetType: 'RFC 4193 IPv6 Unique Local (ULA)',
      cidr: 'fc00::/7',
      description: 'Private IPv6 Unique Local Address',
      lookupStatus: 'not_applicable',
      reason: 'private_address'
    };
  }

  // Public IPv6
  return {
    ip: sanitized,
    isValid: true,
    isIpv4: false,
    isIpv6: true,
    isPublic: true,
    isPrivate: false,
    isRfc1918: false,
    isLoopback: false,
    isLinkLocal: false,
    isCarrierNat: false,
    isReserved: false,
    isMulticast: false,
    scope: 'PUBLIC_ROUTABLE',
    subnetType: 'Public Routable IPv6',
    cidr: `${sanitized}/128`,
    description: 'Globally routed public IPv6 Internet relay node',
    lookupStatus: 'valid'
  };
}

/**
 * Converts a standard IPv4 dotted string into a 32-bit unsigned integer.
 */
export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return 0;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}
