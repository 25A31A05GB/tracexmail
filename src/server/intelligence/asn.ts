import fs from 'fs';
import path from 'path';
import maxmind, { AsnResponse, Reader } from 'maxmind';
import { validateAndClassifyIp, ipToInt } from './ipValidation';
import { asnCache } from './cache';
import { createProvenanceMetadata } from './provenance';
import { AsnResult } from './types';

let asnReaderInstance: Reader<AsnResponse> | null = null;
let asnReaderAttempted = false;

interface CsvAsnBlock {
  startIpInt: number;
  endIpInt: number;
  asn: string;
  org: string;
}

let csvAsnBlocks: CsvAsnBlock[] | null = null;
let csvAsnLoaded = false;

function parseCidr(cidr: string): { startInt: number; endInt: number } {
  const [baseIp, maskStr] = cidr.split('/');
  const mask = parseInt(maskStr, 10);
  const baseInt = ipToInt(baseIp);
  const maskInt = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
  const startInt = (baseInt & maskInt) >>> 0;
  const endInt = (startInt | ~maskInt) >>> 0;
  return { startInt, endInt };
}

function loadLocalAsnCsv(): void {
  if (csvAsnLoaded) return;
  csvAsnLoaded = true;
  try {
    const csvPath = path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-ASN-Blocks-IPv4.csv');
    if (fs.existsSync(csvPath)) {
      csvAsnBlocks = [];
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        const network = cols[0];
        const asnNum = cols[1];
        const orgName = cols.slice(2).join(',').replace(/"/g, '').trim();

        if (network && asnNum) {
          const { startInt, endInt } = parseCidr(network);
          csvAsnBlocks.push({
            startIpInt: startInt,
            endIpInt: endInt,
            asn: asnNum.startsWith('AS') ? asnNum : `AS${asnNum}`,
            org: orgName || 'Autonomous System'
          });
        }
      }
    }
  } catch (err) {
    console.warn('[MaxMind ASN] Failed to load local ASN CSV:', err);
  }
}

async function getLocalAsnReader(): Promise<Reader<AsnResponse> | null> {
  if (asnReaderInstance) return asnReaderInstance;
  if (asnReaderAttempted) return null;

  asnReaderAttempted = true;
  const configuredPath =
    process.env.MAXMIND_ASN_DB_PATH ||
    path.join(process.cwd(), 'data', 'maxmind', 'GeoLite2-ASN.mmdb') ||
    path.join(process.cwd(), 'GeoLite2-ASN.mmdb');

  if (fs.existsSync(configuredPath)) {
    try {
      asnReaderInstance = await maxmind.open<AsnResponse>(configuredPath);
      return asnReaderInstance;
    } catch (err) {
      console.warn('[MaxMind ASN] Failed to initialize ASN mmdb reader:', err);
      asnReaderInstance = null;
    }
  }
  return null;
}

export async function resolveAsn(ipAddress: string): Promise<AsnResult> {
  const validation = validateAndClassifyIp(ipAddress);

  if (!validation.isValid || !validation.isPublic) {
    return {
      ip: validation.ip || ipAddress,
      isPublic: false,
      lookupStatus: 'not_applicable',
      reason: validation.reason || 'private_address',
      asn: null,
      autonomousSystemNumber: null,
      autonomousSystemOrganization: null,
      isp: null,
      source: 'RFC Local Demarcation',
      provider: 'Internal IP Classifier',
      retrievedAt: new Date().toISOString(),
      cached: false,
      provenance: createProvenanceMetadata({
        evidenceType: 'OBSERVED',
        provider: 'RFC Protocol Boundary',
        source: 'Internal Subnet Demarcation',
        status: 'not_applicable',
        reason: validation.reason || 'private_address',
        limitation: 'Private addresses have no public BGP Autonomous System Number'
      })
    };
  }

  const cacheKey = `asn:${validation.ip}`;
  const cached = asnCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  return asnCache.getOrFetch(cacheKey, async () => {
    return await executeAsnLookup(validation.ip);
  }).then(r => r.value);
}

async function executeAsnLookup(ip: string): Promise<AsnResult> {
  const now = new Date().toISOString();

  // Tier 1: Local .mmdb Reader
  try {
    const reader = await getLocalAsnReader();
    if (reader) {
      const record = reader.get(ip);
      if (record && record.autonomous_system_number) {
        const asnStr = `AS${record.autonomous_system_number}`;
        const orgStr = record.autonomous_system_organization || 'Autonomous System';
        return {
          ip,
          isPublic: true,
          lookupStatus: 'success',
          asn: asnStr,
          autonomousSystemNumber: record.autonomous_system_number,
          autonomousSystemOrganization: orgStr,
          isp: orgStr,
          source: 'GeoLite2-ASN.mmdb',
          provider: 'MaxMind GeoLite2 Local ASN Database',
          retrievedAt: now,
          cached: false,
          provenance: createProvenanceMetadata({
            evidenceType: 'ENRICHED',
            provider: 'MaxMind GeoLite2 ASN',
            source: 'Local .mmdb ASN File',
            status: 'success'
          })
        };
      }
    }
  } catch (err) {
    console.warn('[MaxMind ASN error]', err);
  }

  // Tier 2: Local Verified CSV
  loadLocalAsnCsv();
  if (csvAsnBlocks) {
    const ipInt = ipToInt(ip);
    const matched = csvAsnBlocks.find(b => ipInt >= b.startIpInt && ipInt <= b.endIpInt);
    if (matched) {
      const num = parseInt(matched.asn.replace(/\D/g, ''), 10);
      return {
        ip,
        isPublic: true,
        lookupStatus: 'success',
        asn: matched.asn,
        autonomousSystemNumber: isNaN(num) ? null : num,
        autonomousSystemOrganization: matched.org,
        isp: matched.org,
        source: 'GeoLite2-ASN-Blocks-IPv4.csv',
        provider: 'MaxMind GeoLite2 Verified ASN Extract',
        retrievedAt: now,
        cached: false,
        provenance: createProvenanceMetadata({
          evidenceType: 'ENRICHED',
          provider: 'MaxMind GeoLite2 ASN',
          source: 'Local GeoLite2 ASN CSV Extract',
          status: 'success'
        })
      };
    }
  }

  // Tier 3: Unavailable
  return {
    ip,
    isPublic: true,
    lookupStatus: 'unavailable',
    reason: 'asn_not_mapped',
    asn: null,
    autonomousSystemNumber: null,
    autonomousSystemOrganization: null,
    isp: null,
    source: 'MaxMind ASN Engine',
    provider: 'MaxMind GeoLite2 ASN',
    retrievedAt: now,
    cached: false,
    provenance: createProvenanceMetadata({
      evidenceType: 'ENRICHED',
      provider: 'MaxMind GeoLite2 ASN',
      source: 'MaxMind Engine',
      status: 'unavailable',
      reason: 'No ASN mapped for this public IP in available databases'
    })
  };
}
