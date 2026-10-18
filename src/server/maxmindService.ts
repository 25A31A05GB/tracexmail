/**
 * MaxMind GeoLite2 Local Database Engine for TraceXMail
 * Powered by official binary .mmdb format (O(log N) binary radix search tree)
 * Provides sub-millisecond offline lookup for City, Region, Country, Coordinates,
 * ASN, and Organization without external third-party API dependencies.
 */

import fs from 'fs';
import path from 'path';
import maxmind, { CityResponse, AsnResponse, Reader } from 'maxmind';

export interface MaxMindCityRecord {
  city?: {
    names: { en: string; [key: string]: string };
  };
  continent?: {
    code: string;
    names: { en: string; [key: string]: string };
  };
  country?: {
    iso_code: string;
    names: { en: string; [key: string]: string };
    is_in_european_union?: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    time_zone?: string;
    accuracy_radius?: number;
  };
  subdivisions?: Array<{
    iso_code: string;
    names: { en: string; [key: string]: string };
  }>;
  postal?: {
    code: string;
  };
  traits?: {
    autonomous_system_number?: number;
    autonomous_system_organization?: string;
    isp?: string;
    organization?: string;
    is_anonymous?: boolean;
    is_anonymous_proxy?: boolean;
    is_tor_exit_node?: boolean;
    is_hosting_provider?: boolean;
    is_satellite_provider?: boolean;
  };
}

export interface MaxMindAsnRecord {
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
  ip_address?: string;
}

// Helper for IPv4 CIDR calculations
export function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

// Helper for IPv6 BigInt calculations
export function ipv6ToBigInt(ip: string): bigint | null {
  try {
    let str = ip.toLowerCase().trim();
    if (str.includes('%')) {
      str = str.split('%')[0]; // strip scope id
    }
    const doubleColonCount = (str.match(/::/g) || []).length;
    if (doubleColonCount > 1) return null;

    let parts: string[] = [];
    if (str.includes('::')) {
      const [left, right] = str.split('::');
      const leftParts = left ? left.split(':') : [];
      const rightParts = right ? right.split(':') : [];
      const missing = 8 - (leftParts.length + rightParts.length);
      if (missing < 0) return null;
      parts = [...leftParts, ...Array(missing).fill('0'), ...rightParts];
    } else {
      parts = str.split(':');
    }

    if (parts.length !== 8) return null;

    let result = 0n;
    for (let i = 0; i < 8; i++) {
      const num = parseInt(parts[i] || '0', 16);
      if (isNaN(num) || num < 0 || num > 0xffff) return null;
      result = (result << 16n) | BigInt(num);
    }
    return result;
  } catch {
    return null;
  }
}

export function isIpv6InCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split('/');
    if (!bitsStr) return ip.toLowerCase().startsWith(range.toLowerCase());
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 128) return false;

    const ipBig = ipv6ToBigInt(ip);
    const rangeBig = ipv6ToBigInt(range);
    if (ipBig === null || rangeBig === null) return false;

    if (bits === 0) return true;
    const shift = 128n - BigInt(bits);
    return (ipBig >> shift) === (rangeBig >> shift);
  } catch {
    return false;
  }
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  if (!ip || !cidr) return false;
  if (ip.includes(':') || cidr.includes(':')) {
    return isIpv6InCidr(ip, cidr);
  }
  try {
    const [range, bitsStr] = cidr.split('/');
    if (!bitsStr) return ip.startsWith(range);
    const bits = parseInt(bitsStr, 10);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

export class MaxMindDatabase {
  private cityReader: Reader<CityResponse> | null = null;
  private asnReader: Reader<AsnResponse> | null = null;
  private isLoaded = false;

  constructor() {
    this.initReaders();
  }

  /**
   * Initializes or reloads binary MMDB readers from disk.
   */
  public initReaders(): void {
    const cityPaths = [
      process.env.MAXMIND_CITY_DB_PATH,
      path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-City.mmdb'),
      path.join(process.cwd(), 'data', 'geolite2', 'GeoLite2-City.mmdb'),
      path.join(process.cwd(), 'GeoLite2-City.mmdb')
    ].filter(Boolean) as string[];

    const asnPaths = [
      process.env.MAXMIND_ASN_DB_PATH,
      path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-ASN.mmdb'),
      path.join(process.cwd(), 'data', 'geolite2', 'GeoLite2-ASN.mmdb'),
      path.join(process.cwd(), 'GeoLite2-ASN.mmdb')
    ].filter(Boolean) as string[];

    // 1. Initialize City MMDB Reader
    let loadedCityPath: string | null = null;
    for (const p of cityPaths) {
      if (fs.existsSync(p)) {
        try {
          const buffer = fs.readFileSync(p);
          this.cityReader = new Reader<CityResponse>(buffer);
          loadedCityPath = p;
          break;
        } catch (err) {
          console.warn(`[MaxMind] Error reading MMDB at ${p}:`, err);
        }
      }
    }

    // 2. Initialize ASN MMDB Reader
    let loadedAsnPath: string | null = null;
    for (const p of asnPaths) {
      if (fs.existsSync(p)) {
        try {
          const buffer = fs.readFileSync(p);
          this.asnReader = new Reader<AsnResponse>(buffer);
          loadedAsnPath = p;
          break;
        } catch (err) {
          console.warn(`[MaxMind] Error reading ASN MMDB at ${p}:`, err);
        }
      }
    }

    if (loadedCityPath || loadedAsnPath) {
      this.isLoaded = true;
      console.log(`[MaxMind] Loaded binary MMDB databases (City: ${loadedCityPath ? 'active' : 'not found'}, ASN: ${loadedAsnPath ? 'active' : 'not found'}).`);
    } else {
      this.isLoaded = false;
      console.log('[MaxMind] No local .mmdb files found on disk. Operating with live fallback chain.');
    }
  }

  /**
   * Returns true if a local binary database is loaded and active.
   */
  public hasLocalDatabase(): boolean {
    return Boolean(this.cityReader);
  }

  /**
   * Looks up ASN information for an IP address.
   */
  public lookupAsn(ip: string): MaxMindAsnRecord | null {
    if (!ip || !this.asnReader) return null;
    try {
      const res = this.asnReader.get(ip);
      if (res) {
        return {
          autonomous_system_number: res.autonomous_system_number,
          autonomous_system_organization: res.autonomous_system_organization,
          ip_address: res.ip_address
        };
      }
    } catch {
      // Ignored
    }
    return null;
  }

  /**
   * Looks up City & Location information for an IP address using binary MMDB reader.
   */
  public lookupCity(ip: string): MaxMindCityRecord | null {
    if (!ip) return null;

    let cityRecord: MaxMindCityRecord | null = null;

    // 1. MMDB City Lookup
    if (this.cityReader) {
      try {
        const res = this.cityReader.get(ip);
        if (res && res.country) {
          cityRecord = {
            city: res.city ? { names: { en: res.city.names?.en || '' } } : undefined,
            continent: res.continent ? { code: res.continent.code, names: { en: res.continent.names?.en || '' } } : undefined,
            country: {
              iso_code: res.country.iso_code || '',
              names: { en: res.country.names?.en || '' },
              is_in_european_union: Boolean(res.country.is_in_european_union)
            },
            location: res.location ? {
              latitude: res.location.latitude,
              longitude: res.location.longitude,
              time_zone: res.location.time_zone,
              accuracy_radius: res.location.accuracy_radius
            } : undefined,
            subdivisions: res.subdivisions?.map(s => ({
              iso_code: s.iso_code || '',
              names: { en: s.names?.en || '' }
            })),
            postal: res.postal ? { code: res.postal.code || '' } : undefined,
            traits: res.traits ? {
              autonomous_system_number: res.traits.autonomous_system_number,
              autonomous_system_organization: res.traits.autonomous_system_organization,
              isp: res.traits.isp,
              organization: res.traits.organization,
              is_anonymous: res.traits.is_anonymous,
              is_anonymous_proxy: res.traits.is_anonymous_proxy,
              is_tor_exit_node: res.traits.is_tor_exit_node,
              is_hosting_provider: res.traits.is_hosting_provider,
              is_satellite_provider: res.traits.is_satellite_provider
            } : undefined
          };
        }
      } catch {
        // Ignored
      }
    }

    // 2. Enrich with ASN if separate ASN reader loaded
    if (cityRecord) {
      const asnInfo = this.lookupAsn(ip);
      if (asnInfo && (!cityRecord.traits || !cityRecord.traits.autonomous_system_number)) {
        cityRecord.traits = {
          ...cityRecord.traits,
          autonomous_system_number: asnInfo.autonomous_system_number,
          autonomous_system_organization: asnInfo.autonomous_system_organization,
          isp: asnInfo.autonomous_system_organization,
          organization: asnInfo.autonomous_system_organization
        };
      }
    }

    return cityRecord;
  }

  public getStatus(): { status: string; isLoaded: boolean } {
    return {
      status: this.cityReader ? 'LOADED' : 'UNLOADED',
      isLoaded: !!this.cityReader
    };
  }
}

export const maxMindDb = new MaxMindDatabase();
