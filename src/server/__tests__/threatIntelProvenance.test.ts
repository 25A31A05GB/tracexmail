import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { queryIpThreatIntel, queryDomainThreatIntel, queryUrlThreatIntel } from '../threatIntelService';
import { queryOtxIndicator, isOtxConfigured } from '../otxService';

describe('Threat Intelligence Provenance & Zero-Fabrication Contract', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.ABUSEIPDB_API_KEY;
    delete process.env.OTX_API_KEY;
    delete process.env.VIRUSTOTAL_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns UNCONFIGURED status and zero fabricated scores when AbuseIPDB key is missing', async () => {
    const result = await queryIpThreatIntel('198.51.100.42');
    expect(result.provenance.status).toBe('UNCONFIGURED');
    expect(result.provenance.isLive).toBe(false);
    expect(result.provenance.source).toBe('AbuseIPDB');
    expect(result.abuseConfidenceScore).toBeNull();
    expect(result.totalReports).toBe(0);
    expect(result.isp).toBeUndefined();
    expect(result.countryCode).toBeUndefined();
  });

  it('derives Tor status strictly from authoritative exit node directory, not hardcoded prefixes', async () => {
    const nonTor = await queryIpThreatIntel('8.8.8.8');
    expect(nonTor.isTor).toBe(false);

    // Known Tor exit node in directory
    const tor = await queryIpThreatIntel('185.220.101.5');
    expect(tor.isTor).toBe(true);
    expect(tor.usageType).toContain('Tor');
  });

  it('returns UNCONFIGURED status and zero pulses when OTX_API_KEY is missing', async () => {
    expect(isOtxConfigured()).toBe(false);
    const result = await queryOtxIndicator('IPv4', '198.51.100.99');
    expect(result.provenance.status).toBe('UNCONFIGURED');
    expect(result.provenance.isLive).toBe(false);
    expect(result.pulseCount).toBe(0);
    expect(result.pulseNames).toEqual([]);
    expect(result.adversary).toBeUndefined();
    expect(result.malwareFamilies).toEqual([]);
  });

  it('parses live OTX DirectConnect response with live provenance when key is provided', async () => {
    process.env.OTX_API_KEY = 'test-otx-api-key-12345';

    const mockOtxResponse = {
      pulse_info: {
        count: 2,
        pulses: [
          {
            name: 'Cobalt Strike C2 Infrastructure',
            adversary: 'APT29',
            tags: ['cobalt_strike', 'c2'],
            malware_families: [{ display_name: 'CobaltStrike' }],
            references: ['https://threatpost.example.com/apt29']
          }
        ]
      }
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockOtxResponse
    } as any);

    const result = await queryOtxIndicator('IPv4', '192.0.2.1');
    expect(result.provenance.status).toBe('LIVE');
    expect(result.provenance.isLive).toBe(true);
    expect(result.pulseCount).toBe(2);
    expect(result.pulseNames).toContain('Cobalt Strike C2 Infrastructure');
    expect(result.adversary).toBe('APT29');
    expect(result.malwareFamilies).toContain('CobaltStrike');
    expect(result.tags).toContain('cobalt_strike');
  });

  it('returns live status with zero pulses on 404 (clean indicator) without error', async () => {
    process.env.OTX_API_KEY = 'test-otx-api-key-12345';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as any);

    const result = await queryOtxIndicator('domain', 'clean-enterprise-domain.com');
    expect(result.provenance.status).toBe('LIVE');
    expect(result.pulseCount).toBe(0);
    expect(result.pulseNames).toEqual([]);
    expect(result.adversary).toBeUndefined();
  });
});
