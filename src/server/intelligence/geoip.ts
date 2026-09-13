import fs from 'fs';
import path from 'path';
import axios from 'axios';
import maxmind, { CityResponse, Reader } from 'maxmind';
import { validateAndClassifyIp, ipToInt } from './ipValidation';
import { geoIpCache } from './cache';
import { providerRateLimiter } from './rateLimiter';
import { createProvenanceMetadata, MAXMIND_COPYRIGHT_NOTICE, MAXMIND_LICENSE_NOTICE } from './provenance';
import { GeoIpResult, IntelligenceLookupStatus } from './types';
import { isTorExitNode } from './torExitNodes';

// Long-lived Reader instances for performance
let cityReaderInstance: Reader<CityResponse> | null = null;
let cityReaderAttempted = false;

// Local CSV dataset cache
interface CsvLocation {
  geonameId: number;
  continentCode: string;
  continentName: string;
  countryCode: string;
  countryName: string;
  subdivisionName: string;
  cityName: string;
  timeZone: string;
  isInEuropeanUnion: boolean;
}

interface CsvBlock {
  network: string; // CIDR
  startIpInt: number;
  endIpInt: number;
  geonameId: number;
  latitude: number;
  longitude: number;
  accuracyRadius: number;
  isAnonymousProxy: boolean;
  isSatelliteProvider: boolean;
}

let csvLocationsMap: Map<number, CsvLocation> | null = null;
let csvBlocksArray: CsvBlock[] | null = null;
let csvLoaded = false;

function parseCidrRange(cidr: string): { startInt: number; endInt: number } {
  const [baseIp, maskStr] = cidr.split('/');
  const mask = parseInt(maskStr, 10);
  const baseInt = ipToInt(baseIp);
  const maskInt = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
  const startInt = (baseInt & maskInt) >>> 0;
  const endInt = (startInt | ~maskInt) >>> 0;
  return { startInt, endInt };
}

function loadLocalMaxMindCsv(): void {
  if (csvLoaded) return;
  csvLoaded = true;
  try {
    const locationsPath = path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-City-Locations-en.csv');
    const blocksPath = path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-City-Blocks-IPv4.csv');

    if (fs.existsSync(locationsPath)) {
      csvLocationsMap = new Map();
      const locContent = fs.readFileSync(locationsPath, 'utf-8');
      const lines = locContent.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        const geonameId = parseInt(cols[0], 10);
        if (!isNaN(geonameId)) {
          csvLocationsMap.set(geonameId, {
            geonameId,
            continentCode: cols[2] || 'UN',
            continentName: cols[3] || 'Unknown',
            countryCode: cols[4] || '',
            countryName: cols[5] || '',
            subdivisionName: cols[7] || '',
            cityName: cols[10] || '',
            timeZone: cols[12] || '',
            isInEuropeanUnion: cols[13] === '1'
          });
        }
      }
    }

    if (fs.existsSync(blocksPath)) {
      csvBlocksArray = [];
      const blocksContent = fs.readFileSync(blocksPath, 'utf-8');
      const lines = blocksContent.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        const network = cols[0];
        const geonameId = parseInt(cols[1], 10);
        const lat = parseFloat(cols[7]);
        const lng = parseFloat(cols[8]);
        const radius = parseInt(cols[9], 10);

        if (network && !isNaN(geonameId) && !isNaN(lat) && !isNaN(lng)) {
          const { startInt, endInt } = parseCidrRange(network);
          csvBlocksArray.push({
            network,
            startIpInt: startInt,
            endIpInt: endInt,
            geonameId,
            latitude: lat,
            longitude: lng,
            accuracyRadius: isNaN(radius) ? 20 : radius,
            isAnonymousProxy: cols[4] === '1',
            isSatelliteProvider: cols[5] === '1'
          });
        }
      }
    }
  } catch (err) {
    console.warn('[MaxMind Intelligence] Failed to load local CSV datasets:', err);
  }
}

async function getLocalCityReader(): Promise<Reader<CityResponse> | null> {
  if (cityReaderInstance) return cityReaderInstance;
  if (cityReaderAttempted) return null;

  cityReaderAttempted = true;
  const configuredPath =
    process.env.MAXMIND_CITY_DB_PATH ||
    path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-City.mmdb') ||
    path.join(process.cwd(), 'GeoLite2-City.mmdb');

  if (fs.existsSync(configuredPath)) {
    try {
      cityReaderInstance = await maxmind.open<CityResponse>(configuredPath);
      return cityReaderInstance;
    } catch (err) {
      console.warn('[MaxMind] Failed to initialize mmdb reader from:', configuredPath, err);
      cityReaderInstance = null;
    }
  }
  return null;
}

export async function resolveGeoIp(ipAddress: string): Promise<GeoIpResult> {
  const validation = validateAndClassifyIp(ipAddress);

  // Return immediately for private/reserved/loopback addresses
  if (!validation.isValid || !validation.isPublic) {
    return {
      ip: validation.ip || ipAddress,
      isPublic: false,
      lookupStatus: 'not_applicable',
      reason: validation.reason || 'private_address',
      country: null,
      countryCode: null,
      region: null,
      city: null,
      postalCode: null,
      latitude: null,
      longitude: null,
      accuracyRadius: null,
      timeZone: null,
      isInEuropeanUnion: null,
      isAnonymousProxy: null,
      isSatelliteProvider: null,
      source: 'RFC 1918 / RFC 1122 Local Demarcation',
      provider: 'Internal IP Classifier',
      lookupMethod: 'RFC Boundary Check',
      retrievedAt: new Date().toISOString(),
      cached: false,
      provenance: createProvenanceMetadata({
        evidenceType: 'OBSERVED',
        provider: 'RFC Protocol Boundary',
        source: 'Internal Subnet Demarcation',
        status: 'not_applicable',
        reason: validation.reason || 'private_address',
        limitation: 'Private, link-local, and loopback addresses do not route across public AS boundaries'
      })
    };
  }

  // Check in-memory cache with deduplication
  const cacheKey = `geoip:${validation.ip}`;
  const cachedEntry = geoIpCache.get(cacheKey);
  if (cachedEntry) {
    return { ...cachedEntry, cached: true };
  }

  return geoIpCache.getOrFetch(cacheKey, async () => {
    return await executeGeoIpLookup(validation.ip);
  }).then(r => r.value);
}

async function executeGeoIpLookup(ip: string): Promise<GeoIpResult> {
  const now = new Date().toISOString();
  const isTor = isTorExitNode(ip);

  // Tier 1: Local MaxMind .mmdb database
  try {
    const reader = await getLocalCityReader();
    if (reader) {
      const record = reader.get(ip);
      if (record && record.country) {
        return {
          ip,
          isPublic: true,
          lookupStatus: 'success',
          country: record.country.names?.en || null,
          countryCode: record.country.iso_code || null,
          region: record.subdivisions?.[0]?.names?.en || null,
          city: record.city?.names?.en || null,
          postalCode: record.postal?.code || null,
          latitude: record.location?.latitude ?? null,
          longitude: record.location?.longitude ?? null,
          accuracyRadius: record.location?.accuracy_radius ?? 20,
          timeZone: record.location?.time_zone || null,
          isInEuropeanUnion: Boolean(record.country.is_in_european_union),
          isAnonymousProxy: Boolean(record.traits?.is_anonymous_proxy),
          isTorExitNode: isTor,
          isSatelliteProvider: Boolean(record.traits?.is_satellite_provider),
          source: 'GeoLite2-City.mmdb',
          provider: 'MaxMind GeoLite2 Local Database',
          lookupMethod: 'MaxMind .mmdb Reader',
          retrievedAt: now,
          cached: false,
          copyrightNotice: MAXMIND_COPYRIGHT_NOTICE,
          licenseNotice: MAXMIND_LICENSE_NOTICE,
          provenance: createProvenanceMetadata({
            evidenceType: 'ENRICHED',
            provider: 'MaxMind GeoLite2',
            source: 'Local .mmdb Database File',
            status: 'success',
            copyright: MAXMIND_COPYRIGHT_NOTICE,
            license: MAXMIND_LICENSE_NOTICE,
            limitation: 'Network geolocation is approximate to city/region level; does not identify physical building'
          })
        };
      }
    }
  } catch (dbErr) {
    console.warn('[MaxMind mmdb error]', dbErr);
  }

  // Tier 2: Verified Local MaxMind CSV database
  loadLocalMaxMindCsv();
  if (csvBlocksArray && csvLocationsMap) {
    const ipInt = ipToInt(ip);
    const matchedBlock = csvBlocksArray.find(b => ipInt >= b.startIpInt && ipInt <= b.endIpInt);
    if (matchedBlock) {
      const loc = csvLocationsMap.get(matchedBlock.geonameId);
      if (loc) {
        return {
          ip,
          isPublic: true,
          lookupStatus: 'success',
          country: loc.countryName || null,
          countryCode: loc.countryCode || null,
          region: loc.subdivisionName || null,
          city: loc.cityName || null,
          postalCode: null,
          latitude: matchedBlock.latitude,
          longitude: matchedBlock.longitude,
          accuracyRadius: matchedBlock.accuracyRadius,
          timeZone: loc.timeZone || null,
          isInEuropeanUnion: loc.isInEuropeanUnion,
          isAnonymousProxy: matchedBlock.isAnonymousProxy,
          isTorExitNode: isTor,
          isSatelliteProvider: matchedBlock.isSatelliteProvider,
          source: 'backend/data/maxmind/GeoLite2-City-Locations-en.csv',
          provider: 'MaxMind GeoLite2 Verified Extract',
          lookupMethod: 'MaxMind Verified CSV Mapping',
          retrievedAt: now,
          cached: false,
          copyrightNotice: MAXMIND_COPYRIGHT_NOTICE,
          licenseNotice: MAXMIND_LICENSE_NOTICE,
          provenance: createProvenanceMetadata({
            evidenceType: 'ENRICHED',
            provider: 'MaxMind GeoLite2',
            source: 'Local GeoLite2 CSV Extract',
            status: 'success',
            copyright: MAXMIND_COPYRIGHT_NOTICE,
            license: MAXMIND_LICENSE_NOTICE,
            limitation: 'Network geolocation is approximate to city/region level'
          })
        };
      }
    }
  }

  // Tier 3: Official MaxMind Web Service (geolite.info)
  const accountId = process.env.MAXMIND_ACCOUNT_ID;
  const licenseKey = process.env.MAXMIND_LICENSE_KEY;

  if (accountId && licenseKey) {
    const quotaCheck = providerRateLimiter.checkDailyQuota('maxmind-geolite', 1000);
    if (!quotaCheck.allowed) {
      return {
        ip,
        isPublic: true,
        lookupStatus: 'rate_limited',
        reason: 'daily_limit_reached',
        country: null,
        countryCode: null,
        region: null,
        city: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        accuracyRadius: null,
        timeZone: null,
        isInEuropeanUnion: null,
        isTorExitNode: isTor,
        source: 'geolite.info',
        provider: 'MaxMind GeoLite Web Service',
        lookupMethod: 'MaxMind Web Service Rate-Limited',
        retrievedAt: now,
        cached: false,
        provenance: createProvenanceMetadata({
          evidenceType: 'ENRICHED',
          provider: 'MaxMind GeoLite Web Service',
          source: 'geolite.info',
          status: 'rate_limited',
          reason: 'GeoLite web service daily quota (1000 lookups/day) reached'
        })
      };
    }

    try {
      providerRateLimiter.recordUsage('maxmind-geolite');
      const response = await axios.get(`https://geolite.info/geoip/v2.1/city/${ip}`, {
        auth: {
          username: accountId,
          password: licenseKey
        },
        timeout: 4500,
        headers: {
          'User-Agent': 'TraceXMail-Forensic-Engine/1.0'
        }
      });

      const data = response.data;
      if (data && data.country) {
        return {
          ip,
          isPublic: true,
          lookupStatus: 'success',
          country: data.country?.names?.en || null,
          countryCode: data.country?.iso_code || null,
          region: data.subdivisions?.[0]?.names?.en || null,
          city: data.city?.names?.en || null,
          postalCode: data.postal?.code || null,
          latitude: data.location?.latitude ?? null,
          longitude: data.location?.longitude ?? null,
          accuracyRadius: data.location?.accuracy_radius ?? 25,
          timeZone: data.location?.time_zone || null,
          isInEuropeanUnion: Boolean(data.country?.is_in_european_union),
          isAnonymousProxy: Boolean(data.traits?.is_anonymous_proxy),
          isTorExitNode: isTor,
          isSatelliteProvider: Boolean(data.traits?.is_satellite_provider),
          source: 'geolite.info',
          provider: 'MaxMind GeoLite2 Web Service',
          lookupMethod: 'Official MaxMind Web API',
          retrievedAt: now,
          cached: false,
          copyrightNotice: MAXMIND_COPYRIGHT_NOTICE,
          licenseNotice: MAXMIND_LICENSE_NOTICE,
          provenance: createProvenanceMetadata({
            evidenceType: 'ENRICHED',
            provider: 'MaxMind GeoLite2',
            source: 'MaxMind Web Service',
            status: 'success',
            copyright: MAXMIND_COPYRIGHT_NOTICE,
            license: MAXMIND_LICENSE_NOTICE
          })
        };
      }
    } catch (wsErr: any) {
      if (wsErr.response?.status === 401) {
        console.warn('[MaxMind Web Service] Authentication failed (Invalid Account ID or License Key)');
      } else if (wsErr.response?.status === 429) {
        return {
          ip,
          isPublic: true,
          lookupStatus: 'rate_limited',
          reason: 'http_429_too_many_requests',
          country: null,
          countryCode: null,
          region: null,
          city: null,
          postalCode: null,
          latitude: null,
          longitude: null,
          accuracyRadius: null,
          timeZone: null,
          isInEuropeanUnion: null,
          isTorExitNode: isTor,
          source: 'geolite.info',
          provider: 'MaxMind GeoLite Web Service',
          lookupMethod: 'MaxMind Web Service (Rate Limited)',
          retrievedAt: now,
          cached: false,
          provenance: createProvenanceMetadata({
            evidenceType: 'ENRICHED',
            provider: 'MaxMind GeoLite Web Service',
            source: 'geolite.info',
            status: 'rate_limited'
          })
        };
      }
    }
  }

  // Tier 4: Unmapped / Unavailable
  // PRINCIPLE: NEVER invent fake cities or coordinates. Return null and unavailable status.
  return {
    ip,
    isPublic: true,
    lookupStatus: 'unavailable',
    reason: 'database_not_configured_or_unmapped',
    country: null,
    countryCode: null,
    region: null,
    city: null,
    postalCode: null,
    latitude: null,
    longitude: null,
    accuracyRadius: null,
    timeZone: null,
    isInEuropeanUnion: null,
    isAnonymousProxy: null,
    isTorExitNode: isTor,
    isSatelliteProvider: null,
    source: 'MaxMind Local/Remote Engine',
    provider: 'MaxMind GeoLite2',
    lookupMethod: 'Unresolved Public Address',
    retrievedAt: now,
    cached: false,
    provenance: createProvenanceMetadata({
      evidenceType: 'ENRICHED',
      provider: 'MaxMind GeoLite2',
      source: 'MaxMind Engine',
      status: 'unavailable',
      reason: 'IP address is not mapped in local database and web service credentials not configured',
      limitation: 'Analysis proceeds with observed protocol headers and network telemetry'
    })
  };
}
