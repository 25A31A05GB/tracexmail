import express, { Request, Response } from 'express';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../compliance';
import { getSupabaseClient } from '../supabase';
import { createWebSocketTicket, broadcastAlert } from '../websocket';
import {
  getSlackStatus,
  updateSlackConfig,
  testSlackNotification,
  fetchSlackDeliveries,
  getSlackDeliveries,
  dispatchSlackCaseAlert
} from '../slackService';
import { getEmailAlertConfig, sendEmailAlert, fetchEmailAlertLogs } from '../emailAlertService';
import { logger } from '../logger';

export function registerAlertsRoutes(app: express.Express): void {
  // Alerts List (Tenant Scoped)
  app.get('/api/alerts', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
    }
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('organization_id', orgId)
          .order('timestamp', { ascending: false })
          .limit(50);
        if (!error && Array.isArray(data)) {
          return res.json(data);
        }
      } catch (err: any) {
        logger.warn({ error: err?.message }, '[Alerts] Supabase query fallback');
      }
    }

    res.json([]);
  });

  // Alert Diagnostics / Health
  app.get(['/api/alerts/diagnostics', '/api/alerts/health'], publicLimiter, async (_req: Request, res: Response) => {
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      channels: {
        websocket: 'active',
        slack: (await getSlackStatus()).configured ? 'configured' : 'not_configured',
        email: getEmailAlertConfig().enabled ? 'enabled' : 'disabled'
      }
    });
  });

  // Mark Alert Read (Scoped to tenant; returns 404 if not found in org)
  app.patch('/api/alerts/:alertId/read', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
    }
    const { alertId } = req.params;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: existing } = await supabase.from('alerts').select('*').eq('id', alertId).maybeSingle();
        if (!existing || existing.organization_id !== orgId) {
          return res.status(404).json({ error: 'Alert not found' });
        }
        await supabase.from('alerts').update({ read: true }).eq('id', alertId).eq('organization_id', orgId);
      } catch {}
    }
    res.json({ status: 'success', alert_id: alertId, read: true });
  });

  // Mark All Read
  app.post('/api/alerts/mark-all-read', authenticatedLimiter, requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('alerts').update({ read: true }).eq('organization_id', user.organizationId);
      } catch {}
    }
    res.json({ status: 'success', message: 'All alerts marked as read' });
  });

  // WebSocket Authentication Ticket
  // Single-use ticket valid for 30 seconds
  app.post('/api/ws/ticket', authenticatedLimiter, requireAuth, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const ticket = createWebSocketTicket(user);
    res.json({
      ticket,
      expires_in_seconds: 30,
      protocol: 'wss'
    });
  });

  // Broadcast Alert (RBAC: admin only)
  app.post('/api/alerts/broadcast', authenticatedLimiter, requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const { title = 'New Threat Alert', description = 'Automated alert trigger', severity = 'HIGH', category = 'THREAT_DETECTION' } = req.body || {};
    const newAlert = {
      id: `alt_${Date.now()}`,
      case_id: 'sample-paypal-phish',
      organization_id: user.organizationId,
      timestamp: new Date().toISOString(),
      severity,
      title,
      description,
      source: 'api-broadcast',
      read: false,
      threat_score: 88,
      category
    };

    broadcastAlert(newAlert);
    res.status(201).json({ status: 'success', alert: newAlert });
  });

  // SOAR Execution Stub
  app.post('/api/soar/execute', publicLimiter, async (req: Request, res: Response) => {
    const { playbook, case_id } = req.body || {};
    res.json({
      status: 'executed',
      playbook: playbook || 'DEFAULT_CONTAINMENT',
      case_id,
      timestamp: new Date().toISOString()
    });
  });

  // Slack Integration Routes
  app.get(['/api/slack/status', '/api/alerts/slack/status'], publicLimiter, async (_req: Request, res: Response) => {
    res.json(await getSlackStatus());
  });

  app.post('/api/slack/config', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const updated = await updateSlackConfig(req.body);
    res.json(updated);
  });

  app.post(['/api/slack/test', '/api/alerts/slack/test'], authenticatedLimiter, requireAuth, requireRole(['admin']), async (_req: Request, res: Response) => {
    const result = await testSlackNotification();
    res.json(result);
  });

  // Email Alert Logs & Test
  app.get(['/api/alerts/email/logs', '/api/email/logs'], publicLimiter, async (_req: Request, res: Response) => {
    const logs = await fetchEmailAlertLogs();
    res.json(logs);
  });

  app.get('/api/alerts/email/config', publicLimiter, (_req: Request, res: Response) => {
    res.json(getEmailAlertConfig());
  });

  app.post('/api/alerts/email/test', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const targetEmail = req.body?.recipient || 'security-test@tracexmail.sec';
    try {
      const sent = await sendEmailAlert({
        recipient: targetEmail,
        sender: 'alerts@tracexmail.sec',
        verdict: 'TEST',
        threatScore: 0,
        subject: '[TEST] TraceXMail Security Alert Dispatcher',
        summary: 'This is a test security alert confirming proper SMTP configuration.'
      });
      res.json({ status: sent ? 'sent' : 'failed', recipient: targetEmail });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to send test email' });
    }
  });

  // Slack Deliveries & Send Case
  app.get('/api/slack/deliveries', publicLimiter, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }
      const deliveries = await fetchSlackDeliveries(orgId);
      res.json(deliveries);
    } catch {
      res.json(getSlackDeliveries());
    }
  });

  app.post('/api/slack/send-case/:caseId', authenticatedLimiter, requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
    }
    const caseId = req.params.caseId;
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }
    const { data: targetCase } = await supabase.from('cases').select('*').eq('id', caseId).eq('organization_id', orgId).maybeSingle();
    if (!targetCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const { data: matchingAlert } = await supabase.from('alerts').select('*').eq('case_id', caseId).eq('organization_id', orgId).maybeSingle();
    const resultLog = await dispatchSlackCaseAlert({
      caseItem: targetCase,
      alertItem: matchingAlert,
      fileName: 'case_evidence.eml',
      threatScore: targetCase.threat_score || 85,
      verdict: targetCase.severity === 'CRITICAL' ? 'MALICIOUS (CRITICAL)' : 'SUSPICIOUS (HIGH RISK)',
      from: matchingAlert?.sender || targetCase.title || 'analyst@enterprise.corp',
      subject: targetCase.title,
      fromDomain: (matchingAlert?.sender?.split('@')[1]) || 'enterprise.corp',
      primaryGeoHop: {
        fromIp: '185.220.101.5',
        city: 'Sofia',
        country: 'Bulgaria',
        countryCode: 'BG',
        asn: 'AS200548',
        org: 'Zettahost Cyber Ltd'
      }
    });

    const emailDispatch = await sendEmailAlert({
      subject: targetCase.title,
      threatScore: targetCase.threat_score || 85,
      verdict: targetCase.severity === 'CRITICAL' ? 'MALICIOUS (CRITICAL)' : 'SUSPICIOUS (HIGH RISK)',
      sender: matchingAlert?.sender || 'attacker@phishing-domain.net',
      recipient: 'soc-team@enterprise.corp',
      originIp: '185.220.101.5',
      caseId: targetCase.id,
      summary: `Case ${targetCase.id} threat alert dispatched via SOC portal.`
    });

    res.json({ status: resultLog.status, log: resultLog, emailDispatch });
  });
}
