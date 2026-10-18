import express, { Request, Response } from 'express';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../compliance';
import { getSupabaseClient, DEFAULT_ORG_ID } from '../supabase';
import { getPersistedCases, getPersistedCase } from '../caseStore';
import { generateCampaignNarrative, detectCampaignsWithAi } from '../aiCampaignService';
import { generateAiNarrativeForCase } from '../forensicPipeline';
import { correlateEmails, extractForensicRecord, compareRecords } from '../correlationEngine';
import { broadcastWebSocketEvent } from '../websocket';
import { logger } from '../logger';

export function registerCampaignsRoutes(app: express.Express): void {
  // Campaigns List (Tenant Filtered)
  app.get('/api/campaigns', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || (req.headers['x-organization-id'] as string) || DEFAULT_ORG_ID;
    const includeDemo = process.env.ENABLE_DEMO_SEED === 'true' || req.query.include_demo === 'true';

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('campaigns').select('*').order('last_seen', { ascending: false });
        if (orgId) {
          if (includeDemo) {
            q = q.or(`organization_id.eq.${orgId},is_demo.eq.true`);
          } else {
            q = q.eq('organization_id', orgId);
          }
        }
        const { data, error } = await q;
        if (!error && Array.isArray(data)) {
          return res.json(data);
        }
      } catch {}
    }

    res.json([]);
  });

  // Single Campaign by ID (Tenant Scoped)
  app.get('/api/campaigns/:campaignId', publicLimiter, async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || (req.headers['x-organization-id'] as string);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('campaigns').select('*').eq('id', campaignId);
        if (orgId) {
          q = q.or(`organization_id.eq.${orgId},is_demo.eq.true`);
        }
        const { data } = await q.maybeSingle();
        if (data) return res.json(data);
      } catch {}
    }

    res.status(404).json({ error: `Campaign '${campaignId}' not found.` });
  });

  // Create Campaign (RBAC: admin, analyst)
  app.post('/api/campaigns', authenticatedLimiter, requireAuth, requireRole(['admin', 'analyst']), async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { name, threat_actor = 'Unknown Actor', target_industry = 'General Enterprise', notes = '' } = req.body || {};
    const newCamp = {
      id: `camp-${Date.now()}`,
      organization_id: user.organizationId,
      name: name || 'New Threat Campaign',
      threat_actor,
      target_industry,
      status: 'ACTIVE',
      total_emails: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      notes,
      member_email_ids: [],
      is_demo: false
    };

    const { data, error } = await supabase.from('campaigns').insert([newCamp]).select().single();
    if (error) {
      return res.status(500).json({ error: `Failed to create campaign: ${error.message}` });
    }
    res.status(201).json(data || newCamp);
  });

  // Campaign Candidates & Member Addition
  app.get('/api/emails/:emailId/campaign-candidates', publicLimiter, async (req: Request, res: Response) => {
    const emailId = req.params.emailId;
    const supabase = getSupabaseClient();
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || DEFAULT_ORG_ID;
    let allCases = getPersistedCases(orgId);
    let dbCampaigns: any[] = [];

    if (supabase) {
      try {
        const { data: cData } = await supabase.from('cases').select('*').eq('organization_id', orgId);
        if (cData && cData.length > 0) allCases = cData;

        const { data: campData } = await supabase.from('campaigns').select('*').eq('organization_id', orgId);
        if (campData) dbCampaigns = campData;
      } catch {}
    }

    const target = allCases.find((c: any) => c.id === emailId) || getPersistedCase(emailId);
    if (!target) {
      return res.status(404).json({ error: 'Email or Case not found' });
    }

    const targetRec = extractForensicRecord(target);
    const candidates: any[] = [];

    if (dbCampaigns.length > 0) {
      for (const camp of dbCampaigns) {
        const memberIds = Array.isArray(camp.member_email_ids)
          ? camp.member_email_ids
          : (typeof camp.member_email_ids === 'string' ? JSON.parse(camp.member_email_ids || '[]') : []);
        
        const memberCases = allCases.filter((c: any) => memberIds.includes(c.id));
        let bestScore = 0;
        const sharedReasons: string[] = [];

        for (const mc of memberCases) {
          const mRec = extractForensicRecord(mc);
          const comp = compareRecords(targetRec, mRec);
          if (comp.score > bestScore) {
            bestScore = comp.score;
          }
          for (const ev of comp.evidence) {
            const desc = ev.description || ev.value;
            if (!sharedReasons.includes(desc)) {
              sharedReasons.push(desc);
            }
          }
        }

        if (bestScore >= 0.35 || sharedReasons.length > 0) {
          candidates.push({
            ...camp,
            similarity_score: Math.round(bestScore * 100) / 100,
            confidence: bestScore >= 0.75 ? 'HIGH' : (bestScore >= 0.5 ? 'MEDIUM' : 'LOW'),
            match_reasons: sharedReasons.slice(0, 3),
            total_emails: Math.max(camp.total_emails || 1, memberIds.length)
          });
        }
      }
    }

    const clusters = correlateEmails(allCases.map(extractForensicRecord));
    for (const cl of clusters) {
      if (cl.memberEmailIds.includes(emailId)) {
        if (!candidates.some(c => c.id === cl.id)) {
          candidates.push({
            id: cl.id,
            name: cl.name,
            threat_actor: cl.threatActor,
            target_industry: cl.targetIndustry,
            status: cl.status,
            similarity_score: 0.95,
            confidence: 'HIGH',
            match_reasons: cl.sharedEvidence.map(e => e.description || e.value).slice(0, 3),
            total_emails: cl.totalEmails,
            member_email_ids: cl.memberEmailIds
          });
        }
      }
    }

    res.json({ candidates });
  });

  app.post('/api/campaigns/:campaignId/members', publicLimiter, async (req: Request, res: Response) => {
    const campaignId = req.params.campaignId;
    const emailIds: string[] = Array.isArray(req.body?.email_ids) ? req.body.email_ids : (req.body?.email_id ? [req.body.email_id] : []);

    if (emailIds.length === 0) {
      return res.status(400).json({ error: 'email_ids array is required' });
    }

    const supabase = getSupabaseClient();
    let updatedCampaign: any = null;

    if (supabase) {
      try {
        const { data: existing } = await supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
        if (existing) {
          const currentMembers = Array.isArray(existing.member_email_ids)
            ? existing.member_email_ids
            : (typeof existing.member_email_ids === 'string' ? JSON.parse(existing.member_email_ids || '[]') : []);
          
          const newSet = Array.from(new Set([...currentMembers, ...emailIds]));
          const updates = {
            member_email_ids: newSet,
            total_emails: Math.max(existing.total_emails || 1, newSet.length),
            last_seen: new Date().toISOString()
          };
          const { data: updated } = await supabase.from('campaigns').update(updates).eq('id', campaignId).select().single();
          updatedCampaign = updated || { ...existing, ...updates };
        }
      } catch (err: any) {
        logger.warn({ error: err?.message }, '[Campaigns] Error updating DB campaign members');
      }
    }

    broadcastWebSocketEvent({
      type: 'CAMPAIGN_UPDATED',
      campaignId,
      addedEmailIds: emailIds,
      campaign: updatedCampaign,
      timestamp: new Date().toISOString()
    });

    res.json({
      status: 'success',
      message: `Added ${emailIds.length} email(s) to campaign ${campaignId}`,
      campaign: updatedCampaign
    });
  });

  // Campaign Auto-Correlate
  app.post(['/api/campaigns/auto-correlate', '/api/correlation/run'], publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || DEFAULT_ORG_ID;
    const cases = getPersistedCases(orgId);

    const domainGroups: Record<string, string[]> = {};
    for (const c of cases) {
      if (c.from_domain) {
        domainGroups[c.from_domain] = domainGroups[c.from_domain] || [];
        domainGroups[c.from_domain].push(c.id);
      }
    }

    const clusters = Object.entries(domainGroups)
      .filter(([_, ids]) => ids.length > 1)
      .map(([domain, ids]) => ({
        id: `clust-${domain.replace(/[^a-z0-9]/gi, '_')}`,
        name: `Campaign Cluster (${domain})`,
        domain,
        case_ids: ids,
        count: ids.length
      }));

    res.json({ status: 'success', clusters, count: clusters.length });
  });

  // AI Campaign Detection & Narrative
  app.post('/api/campaigns/ai-detect', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || DEFAULT_ORG_ID;
    const cases = getPersistedCases(orgId);

    try {
      const result = await detectCampaignsWithAi(cases);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to detect campaigns' });
    }
  });

  app.post('/api/campaigns/:campaignId/ai-narrative', publicLimiter, async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || DEFAULT_ORG_ID;
    const cases = getPersistedCases(orgId);

    try {
      const narrative = await generateCampaignNarrative(campaignId, cases);
      res.json(narrative);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate campaign narrative' });
    }
  });

  // Campaign Timeline
  app.get('/api/campaigns/:campaignId/timeline', publicLimiter, async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || DEFAULT_ORG_ID;
    const cases = getPersistedCases(orgId).filter((c: any) => c.campaign_id === campaignId);

    const timeline = cases.map((c) => ({
      case_id: c.id,
      timestamp: c.created_at,
      title: c.title,
      severity: c.severity,
      threat_score: c.threat_score,
      origin_ip: c.origin_ip,
      from_domain: c.from_domain
    })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({ campaign_id: campaignId, timeline, total_events: timeline.length });
  });

  // Temporal Analysis (Strictly Tenant-Scoped)
  app.get('/api/temporal-analysis', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || (req.headers['x-organization-id'] as string) || DEFAULT_ORG_ID;
    const cases = getPersistedCases(orgId);

    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;

    for (const c of cases) {
      if (c.created_at) {
        const hour = new Date(c.created_at).getUTCHours();
        hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
      }
    }

    res.json({
      organization_id: orgId,
      hourly_distribution: hourlyMap,
      sample_size: cases.length,
      peak_attack_hour_utc: Object.entries(hourlyMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 0
    });
  });

  // Case Relationship Graph
  app.get(['/api/cases/:caseId/graph', '/api/v1/cases/:caseId/graph'], publicLimiter, async (req: Request, res: Response) => {
    const { caseId } = req.params;
    const c = getPersistedCase(caseId);
    if (!c) return res.status(404).json({ error: 'Case not found' });

    const nodes = [
      { id: c.id, label: c.title, type: 'case', severity: c.severity },
      { id: `domain-${c.from_domain}`, label: c.from_domain, type: 'domain' },
      { id: `ip-${c.origin_ip}`, label: c.origin_ip, type: 'ip' }
    ];
    const edges = [
      { from: c.id, to: `domain-${c.from_domain}`, relation: 'origin_domain' },
      { from: c.id, to: `ip-${c.origin_ip}`, relation: 'origin_relay' }
    ];

    res.json({ nodes, edges });
  });

  // AI Narrative for Single Case
  const handleAiNarrative = async (req: Request, res: Response) => {
    const caseId = req.params.caseId;
    let targetCase: any = caseId ? getPersistedCase(caseId) : null;
    if (!targetCase && req.body?.subject) {
      targetCase = req.body;
    }
    const narrative = await generateAiNarrativeForCase(targetCase);
    res.json(narrative);
  };

  app.get('/api/v1/cases/:caseId/ai-narrative', publicLimiter, handleAiNarrative);
  app.post('/api/v1/cases/:caseId/ai-narrative', publicLimiter, handleAiNarrative);
  app.post('/api/ai-summary', publicLimiter, handleAiNarrative);
  app.all(['/api/v1/cases/:caseId/ai-narrative', '/api/ai-summary'], publicLimiter, handleAiNarrative);
}
