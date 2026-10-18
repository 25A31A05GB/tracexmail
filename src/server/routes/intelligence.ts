import express, { Request, Response } from 'express';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, requireRole, type AuthenticatedRequest, logAuditAction } from '../compliance';
import { validateRequest } from '../validation';
import { z } from 'zod';
import {
  enrichIpFull,
  resolveDomainIntelligence as resolveIntelligenceDomain,
  resolveDns as resolveIntelligenceDns,
  resolveRdap as resolveIntelligenceRdap,
  resolveGeoIp,
  resolveAsn,
  lookupVirusTotalUrl,
  lookupVirusTotalFileHash,
  enrichWithVirusTotal,
  isVirusTotalConfigured,
  getVirusTotalStatus,
  geoIpCache,
  asnCache,
  dnsCache,
  rdapCache,
  threatIntelCache,
  MAXMIND_COPYRIGHT_NOTICE,
  MAXMIND_LICENSE_NOTICE
} from '../intelligence';
import { queryOtxIndicator, getOtxStatus, isOtxConfigured } from '../otxService';
import { resolveIpGeolocation } from '../geoService';
import { maxMindDb } from '../maxmindService';
import { refreshMaxMindDatabases } from '../../../scripts/refresh_maxmind_db';
import { getLiveThreatFeed, REAL_WORLD_THREAT_FEED, createDynamicRealWorldCase } from '../realWorldThreatService';
import { getSupabaseClient, DEFAULT_ORG_ID } from '../supabase';
import { broadcastAlert, broadcastWebSocketEvent } from '../websocket';
import { logger } from '../logger';

const virustotalUrlSchema = z.object({
  url: z.string().url('A valid URL is required')
});

const virustotalFileSchema = z.object({
  hash: z.string().min(32, 'A valid MD5, SHA-1, or SHA-256 hash is required')
});

export function registerIntelligenceRoutes(app: express.Express): void {
  // Domain Intelligence Lookup
  app.get(['/api/v1/cases/:caseId/domain-intelligence', '/api/domain-intelligence/:domain'], publicLimiter, async (req: Request, res: Response) => {
    let domain = req.params.domain || (req.params.caseId?.includes('.') ? req.params.caseId : '');
    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required' });
    }
    try {
      const intel = await resolveIntelligenceDomain(domain);
      res.json(intel);
    } catch (err: any) {
      logger.error({ error: err?.message, domain }, '[Intelligence] Domain intelligence error');
      res.status(500).json({ error: 'Failed to resolve domain intelligence' });
    }
  });

  // Individual Indicator Intelligence Endpoints
  app.get('/api/intelligence/ip/:ip', publicLimiter, async (req: Request, res: Response) => {
    try {
      const data = await enrichIpFull(req.params.ip);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to query IP intelligence' });
    }
  });

  app.get('/api/intelligence/domain/:domain', publicLimiter, async (req: Request, res: Response) => {
    try {
      const data = await resolveIntelligenceDomain(req.params.domain);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to query domain intelligence' });
    }
  });

  app.get('/api/intelligence/dns/:domain', publicLimiter, async (req: Request, res: Response) => {
    try {
      const data = await resolveIntelligenceDns(req.params.domain);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to resolve DNS records' });
    }
  });

  app.get('/api/intelligence/rdap/:domain', publicLimiter, async (req: Request, res: Response) => {
    try {
      const data = await resolveIntelligenceRdap(req.params.domain);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to query RDAP' });
    }
  });

  app.get('/api/intelligence/otx/:type/:indicator', publicLimiter, async (req: Request, res: Response) => {
    try {
      const { type, indicator } = req.params;
      const data = await queryOtxIndicator(type as any, indicator);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to query AlienVault OTX' });
    }
  });

  app.get('/api/intelligence/status', publicLimiter, (_req: Request, res: Response) => {
    res.json({
      status: 'operational',
      maxmind: maxMindDb.getStatus(),
      virustotal: getVirusTotalStatus(),
      otx: getOtxStatus(),
      caches: {
        geoip_size: geoIpCache.size(),
        asn_size: asnCache.size(),
        dns_size: dnsCache.size(),
        rdap_size: rdapCache.size(),
        threat_size: threatIntelCache.size()
      }
    });
  });

  // Admin-only Cache Clear with Audit Log
  app.post(
    '/api/intelligence/cache/clear',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const user = (req as AuthenticatedRequest).user!;
      const scope = req.body?.scope || 'all';

      if (scope === 'all' || scope === 'geoip') geoIpCache.clear();
      if (scope === 'all' || scope === 'asn') asnCache.clear();
      if (scope === 'all' || scope === 'dns') dnsCache.clear();
      if (scope === 'all' || scope === 'rdap') rdapCache.clear();
      if (scope === 'all' || scope === 'threat') threatIntelCache.clear();

      await logAuditAction(
        {
          organization_id: user.organizationId,
          user_id: user.userId,
          user_email: user.email,
          user_role: user.role,
          action: 'INTEL_CACHE_CLEARED',
          resource_type: 'system_cache',
          resource_id: scope,
          details: { scope, requested_by: user.email }
        },
        getSupabaseClient()
      );

      res.json({
        status: 'success',
        clearedScope: scope,
        remainingSizes: {
          geoip: geoIpCache.size(),
          asn: asnCache.size(),
          dns: dnsCache.size(),
          rdap: rdapCache.size(),
          threat: threatIntelCache.size()
        }
      });
    }
  );

  // Dedicated Origin Intelligence & IP Geolocation endpoint
  app.get(['/api/origin-intelligence/:ip', '/api/v1/lookup-ip/:ip', '/api/ip/:ip'], publicLimiter, async (req: Request, res: Response) => {
    const ip = req.params.ip;
    const geo = await resolveIpGeolocation(ip);
    res.json(geo);
  });

  // MaxMind Status, Refresh & Attribution
  app.get('/api/maxmind/status', publicLimiter, (_req: Request, res: Response) => {
    res.json({
      ...maxMindDb.getStatus(),
      copyright: MAXMIND_COPYRIGHT_NOTICE,
      license: MAXMIND_LICENSE_NOTICE
    });
  });

  app.post(['/api/maxmind/refresh', '/api/v1/maxmind/refresh'], authenticatedLimiter, requireAuth, requireRole(['admin']), async (_req: Request, res: Response) => {
    try {
      const refreshed = await refreshMaxMindDatabases();
      res.json({ status: refreshed ? 'refreshed' : 'noop', details: maxMindDb.getStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Database refresh failed' });
    }
  });

  app.get('/api/maxmind/readme', publicLimiter, (_req: Request, res: Response) => {
    res.type('text/plain').send(`${MAXMIND_COPYRIGHT_NOTICE}\n\n${MAXMIND_LICENSE_NOTICE}\n`);
  });

  // VirusTotal Status & Enrichment
  app.get('/api/virustotal/status', publicLimiter, (_req: Request, res: Response) => {
    res.json(getVirusTotalStatus());
  });

  app.get('/api/virustotal/url', authenticatedLimiter, async (req: Request, res: Response) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: 'url query parameter is required' });
    const result = await lookupVirusTotalUrl(targetUrl);
    res.json(result);
  });

  app.post('/api/virustotal/url', authenticatedLimiter, validateRequest({ body: virustotalUrlSchema }), async (req: Request, res: Response) => {
    const result = await lookupVirusTotalUrl(req.body.url);
    res.json(result);
  });

  app.get('/api/virustotal/file/:hash', authenticatedLimiter, async (req: Request, res: Response) => {
    const result = await lookupVirusTotalFileHash(req.params.hash);
    res.json(result);
  });

  app.post('/api/virustotal/file', authenticatedLimiter, validateRequest({ body: virustotalFileSchema }), async (req: Request, res: Response) => {
    const result = await lookupVirusTotalFileHash(req.body.hash);
    res.json(result);
  });

  app.post('/api/virustotal/enrich', authenticatedLimiter, async (req: Request, res: Response) => {
    const { urls, hashes } = req.body || {};
    const result = await enrichWithVirusTotal({ urls, hashes });
    res.json(result);
  });

  // Real-world Threat Feeds
  app.get('/api/threat-intel/live-feed', publicLimiter, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50);
      const feed = await getLiveThreatFeed(limit);
      res.json(feed);
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        isSimulated: true,
        error: err?.message || 'Failed to retrieve live threat feed',
        feeds: REAL_WORLD_THREAT_FEED.slice(0, 10).map((i) => ({ ...i, isSimulated: true }))
      });
    }
  });

  app.get('/api/threat-feeds/real-world', publicLimiter, async (req: Request, res: Response) => {
    try {
      const isLiveRequested = req.query.live === 'true' || req.query.source === 'live';
      if (isLiveRequested) {
        const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50);
        const liveFeed = await getLiveThreatFeed(limit);
        return res.json(liveFeed);
      }
      res.json({
        status: 'active',
        feed_type: 'curated_benchmark_library',
        count: REAL_WORLD_THREAT_FEED.length,
        feeds: REAL_WORLD_THREAT_FEED,
        sources: ['CISA Advisory Archetypes', 'OpenPhish Signatures', 'PhishTank Patterns', 'VirusTotal Telemetry Archetypes'],
        last_synced: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  });

  app.post('/api/threat-feeds/sync', authenticatedLimiter, requireAuth, requireRole(['admin', 'analyst']), async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const user = (req as AuthenticatedRequest).user!;
    const orgId = user?.organizationId || DEFAULT_ORG_ID;

    const newAlerts: any[] = [];
    for (const item of REAL_WORLD_THREAT_FEED) {
      const alertItem = {
        id: `alt_feed_${item.id}`,
        organization_id: orgId,
        case_id: `case-real-${item.id}`,
        title: `[${item.source}] ${item.title}`,
        description: item.description,
        severity: item.severity,
        threat_score: item.threat_score,
        category: item.threat_type,
        source: item.source.toLowerCase(),
        sender: item.sample_headers.from,
        subject: item.sample_headers.subject,
        read: false,
        is_demo: false,
        timestamp: new Date().toISOString()
      };

      newAlerts.push(alertItem);

      if (supabase) {
        try {
          await supabase.from('alerts').upsert([alertItem]);
        } catch (e: any) {
          logger.warn({ error: e?.message }, '[ThreatFeed] Alert persist warning');
        }
      }

      broadcastAlert(alertItem);
    }

    res.json({
      status: 'success',
      synced_count: newAlerts.length,
      alerts: newAlerts,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/threat-feeds/convert-to-case', authenticatedLimiter, requireAuth, requireRole(['admin', 'analyst']), async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const { threat_id } = req.body || {};
    const threatItem = REAL_WORLD_THREAT_FEED.find((t) => t.id === threat_id) || REAL_WORLD_THREAT_FEED[0];

    try {
      const created = await createDynamicRealWorldCase(threatItem, user.organizationId, user.email || 'Lead SOC Analyst');
      broadcastWebSocketEvent({
        type: 'CASE_CREATED',
        case: created.case,
        caseId: created.case.id,
        source_feed: threatItem.source,
        timestamp: new Date().toISOString()
      }, user.organizationId);

      await logAuditAction(
        {
          organization_id: user.organizationId,
          case_id: created.case.id,
          user_id: user.userId,
          user_email: user.email,
          user_role: user.role,
          action: 'REAL_WORLD_THREAT_CONVERTED',
          resource_type: 'case',
          resource_id: created.case.id,
          details: { threat_id: threatItem.id, source: threatItem.source, title: threatItem.title }
        },
        getSupabaseClient()
      );

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to convert threat feed to case' });
    }
  });
}
