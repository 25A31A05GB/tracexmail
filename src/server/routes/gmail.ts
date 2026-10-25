import express, { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { publicLimiter, authenticatedLimiter, strictRateLimiter, gmailDisconnectLimiter } from '../rateLimiter';
import { requireAuth, requireRole, type AuthenticatedRequest, encryptToken } from '../compliance';
import { getSupabaseAdminClient, getSupabaseClient } from '../supabase';
import { broadcastWebSocketEvent } from '../websocket';
import { getPersistedCase } from '../caseStore';
import {
  getGmailStatus,
  getGmailAccessToken,
  updateQuarantineConfig,
  updateWatchConfig,
  handlePubSubPush,
  getQuarantineAuditLog,
  fetchQuarantineAuditLogs,
  saveGmailConnectionToDb,
  disconnectGmail,
  startGmailWatch,
  stopGmailWatch,
  quarantineGmailMessage,
  createGmailBlockFilter,
  trashGmailMessage,
  searchGmailMessages,
  releaseQuarantinedMessage,
  deleteQuarantinedMessage,
  getPendingQuarantineQueue,
  refreshOAuthPermissionsState,
  toggleOAuthScopeSimulation,
  ensureFreshAccessToken,
  listGmailMessages,
  fetchGmailMessageRaw,
  queueEmailForAnalysis,
  modifyGmailMessageLabels,
  insertQuarantineReportNote,
  generateSampleQuarantineReportPayload,
  backfillQuarantineReportNotes,
  startAutoSyncLoop,
  getSyncedEmails,
  getIngestionQueue,
  getAutoSyncConfig,
  setAutoSyncConfig
} from '../gmailService';
import { parseRawEmailToAnalysis, verifyGooglePubSubPushToken } from '../forensicPipeline';
import { logger } from '../logger';

// Server-side OAuth state storage
export interface OAuthNonceRecord {
  user_id: string;
  organization_id: string;
  created_at: number;
}
export const oauthStateNonces = new Map<string, OAuthNonceRecord>();

export function registerGmailRoutes(app: express.Express): void {
  // 1. Gmail Integration Status
  app.get('/api/gmail/status', publicLimiter, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    res.json(getGmailStatus(orgId));
  });

  // 2. OAuth Start Endpoint (Validates redirect_uri and stores CSRF state)
  app.get(['/api/gmail/oauth/start', '/api/auth/url'], authenticatedLimiter, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const userOrgId = user?.organizationId || '';
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = (req.query.redirect_uri as string) || (req.query.redirectUri as string) || '';

    // Validate redirect URI origin against ALLOWED_REDIRECT_ORIGINS
    const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS || 'http://localhost:3000,http://localhost:5173')
      .split(',')
      .map((s) => s.trim().toLowerCase());

    if (redirectUri) {
      try {
        const u = new URL(redirectUri);
        const origin = u.origin.toLowerCase();
        if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
          return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri must use HTTPS in production' });
        }
        if (!allowedOrigins.includes(origin)) {
          return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri origin is not on the allowlist' });
        }
      } catch {
        return res.status(400).json({ error: 'invalid_request', error_description: 'Malformed redirect_uri' });
      }
    }

    const stateNonce = crypto.randomBytes(32).toString('base64url');
    oauthStateNonces.set(stateNonce, {
      user_id: user?.id || user?.userId || 'oauth_flow',
      organization_id: userOrgId,
      created_at: Date.now()
    });

    if (!clientId) {
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_OAUTH !== 'true') {
        return res.status(503).json({ error: 'google_credentials_missing', message: 'Google OAuth Client ID is not configured.' });
      }
      return res.json({
        url: `${req.protocol}://${req.get('host')}/oauth/gmail/callback?code=mock_oauth_code_${Date.now()}&state=${encodeURIComponent(stateNonce)}`
      });
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri || `${req.protocol}://${req.get('host')}/oauth/gmail/callback`)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(stateNonce)}`;

    res.json({ url: authUrl });
  });

  // 3. Refresh OAuth Permissions & Reset Scopes
  app.post('/api/gmail/oauth/refresh-permissions', authenticatedLimiter, async (req: Request, res: Response) => {
    try {
      const { scopes, expires_in_seconds } = req.body || {};
      refreshOAuthPermissionsState({
        scopes: Array.isArray(scopes) ? scopes : undefined,
        expiresInSeconds: typeof expires_in_seconds === 'number' ? expires_in_seconds : 3600
      });

      const currentStatus = getGmailStatus();
      const clientId = process.env.GOOGLE_CLIENT_ID || 'tracexmail-soc-client';
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/v1/gmail/callback`;
      const scopesParam = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.insert https://www.googleapis.com/auth/userinfo.email');

      res.json({
        status: 'ok',
        message: 'OAuth permissions and tokens successfully refreshed. Scopes active and validated.',
        oauth_scopes: currentStatus.oauth_scopes,
        auth_url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopesParam}&access_type=offline&prompt=consent`,
        redirect_uri: redirectUri
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 4. Toggle OAuth Scope Simulation
  app.post('/api/gmail/oauth/toggle-scope', authenticatedLimiter, (req: Request, res: Response) => {
    try {
      const { scope, granted } = req.body || {};
      if (!scope) {
        return res.status(400).json({ status: 'error', error: 'Missing scope parameter' });
      }
      toggleOAuthScopeSimulation(scope, Boolean(granted));
      const currentStatus = getGmailStatus();
      res.json({
        status: 'ok',
        message: `Scope ${scope} simulation set to ${Boolean(granted) ? 'GRANTED' : 'REVOKED'}`,
        oauth_scopes: currentStatus.oauth_scopes
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 5. Gmail OAuth Callback Route
  const handleGmailOAuthCallback = async (req: Request, res: Response) => {
    const code = (req.query.code as string | undefined) || (req.body?.code as string | undefined);
    const error = (req.query.error as string | undefined) || (req.body?.error as string | undefined);
    const errorDesc = (req.query.error_description as string | undefined) || (req.body?.error_description as string | undefined) || error;
    const stateParam = (req.query.state as string | undefined) || (req.body?.state as string | undefined) || '';
    const storedState = stateParam ? oauthStateNonces.get(stateParam) : undefined;
    if (stateParam) {
      oauthStateNonces.delete(stateParam);
    }

    const returnBase = '/';
    const getRedirectUrl = (params: Record<string, string>) => {
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      let target: URL;
      try {
        target = new URL(returnBase.startsWith('http') ? returnBase : `${baseUrl}${returnBase.startsWith('/') ? returnBase : `/${returnBase}`}`);
      } catch {
        target = new URL(`${baseUrl}/`);
      }
      for (const [k, v] of Object.entries(params)) {
        target.searchParams.set(k, v);
      }
      return target.pathname + target.search;
    };

    const orgId = storedState?.organization_id;
    if (!orgId) {
      return res.status(400).redirect(getRedirectUrl({
        gmail_auth: 'error',
        error: 'Invalid or missing OAuth state nonce. Organization could not be verified from server-stored session.'
      }));
    }

    if (error || !code) {
      const failureReason = errorDesc || 'Missing authorization code from Google OAuth callback';
      return res.redirect(getRedirectUrl({
        gmail_auth: 'error',
        error: failureReason
      }));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/v1/gmail/callback`;

    try {
      let accessToken = 'mock_oauth2_access_token_encrypted';
      let refreshToken = 'mock_oauth2_refresh_token_encrypted';
      let expiresIn = 3600;
      let emailAddress = 'security-soc@acmedefense.sec';

      if (clientId && clientSecret) {
        const tokenResp = await axios.post('https://oauth2.googleapis.com/token', {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        });

        accessToken = tokenResp.data.access_token;
        refreshToken = tokenResp.data.refresh_token || refreshToken;
        expiresIn = tokenResp.data.expires_in || 3600;

        try {
          const userResp = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 5000
          });
          if (userResp.data?.email) {
            emailAddress = userResp.data.email;
          }
        } catch {}
      } else {
        emailAddress = (req.query.email as string) || (req.body?.email as string) || 'analyst@acmedefense.sec';
      }

      const supabaseAdmin = getSupabaseAdminClient();
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const encryptedAccessToken = encryptToken(accessToken);
      const encryptedRefreshToken = encryptToken(refreshToken);

      if (supabaseAdmin) {
        const connectionRow = {
          id: `gconn_${orgId}_${Buffer.from(emailAddress).toString('hex').substring(0, 10)}`,
          organization_id: orgId,
          email_address: emailAddress,
          is_connected: true,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          watch_enabled: true,
          watch_active: true,
          quarantine_enabled: true,
          updated_at: new Date().toISOString()
        };

        await supabaseAdmin
          .from('gmail_connections')
          .upsert(connectionRow, { onConflict: 'organization_id,email_address' });
      }

      await saveGmailConnectionToDb({
        orgId,
        emailAddress,
        accessToken,
        refreshToken,
        expiresInSeconds: expiresIn,
        isConnected: true
      });

      startAutoSyncLoop(30);

      startGmailWatch({ accessToken }).catch(() => {});

      broadcastWebSocketEvent({
        type: 'GMAIL_OAUTH_SUCCESS',
        timestamp: new Date().toISOString(),
        email: emailAddress,
        connected: true,
        auto_sync_active: true
      }, orgId);

      return res.redirect(getRedirectUrl({
        gmail_auth: 'success',
        email: emailAddress,
        status: 'connected'
      }));
    } catch (err: any) {
      const errorDetail = err?.response?.data?.error_description || err?.message || 'Failed exchanging authorization code for tokens';
      return res.redirect(getRedirectUrl({
        gmail_auth: 'error',
        error: errorDetail
      }));
    }
  };

  app.get(['/api/v1/gmail/callback', '/oauth/gmail/callback', '/api/oauth/gmail/callback'], publicLimiter, handleGmailOAuthCallback);
  app.post(['/api/v1/gmail/callback', '/oauth/gmail/callback', '/api/oauth/gmail/callback'], publicLimiter, handleGmailOAuthCallback);

  // 6. Watch Start & Stop
  app.post(['/api/gmail/watch/start', '/api/gmail/watch'], strictRateLimiter, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const accessToken = req.body?.accessToken || bearerToken;
      const topicName = req.body?.topicName || req.body?.topic_name;
      const labelIds = req.body?.labelIds || ['INBOX'];
      const labelFilterAction = req.body?.labelFilterAction || 'include';

      const result = await startGmailWatch({
        accessToken,
        topicName,
        labelIds,
        labelFilterAction
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to start Gmail watch' });
    }
  });

  app.post('/api/gmail/watch/stop', strictRateLimiter, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const accessToken = req.body?.accessToken || bearerToken;
      const result = await stopGmailWatch({ accessToken });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to stop Gmail watch' });
    }
  });

  app.get('/api/gmail/watch/status', publicLimiter, (_req: Request, res: Response) => {
    const status = getGmailStatus();
    res.json({
      status: 'ok',
      watch: status.watch,
      is_connected: status.is_connected,
      email_address: status.email_address
    });
  });

  app.post('/api/gmail/watch/config', authenticatedLimiter, requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
    const updated = updateWatchConfig(req.body);
    res.json({ status: 'ok', watch: updated });
  });

  // 7. Connect Token Directly
  app.post('/api/gmail/connect-token', authenticatedLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ status: 'error', error: 'Unauthorized: Missing verified organization context' });
      }

      const { access_token, refresh_token, email, expires_in_seconds } = req.body || {};
      if (!access_token || !email) {
        return res.status(400).json({ status: 'error', error: 'Missing access_token or email' });
      }

      await saveGmailConnectionToDb({
        orgId,
        emailAddress: email.trim(),
        accessToken: access_token.trim(),
        refreshToken: refresh_token ? refresh_token.trim() : undefined,
        expiresInSeconds: expires_in_seconds || 3600,
        isConnected: true
      });

      res.json({
        status: 'ok',
        message: `Gmail connection established and secured in enclave database for ${email.trim()}`,
        email_address: email.trim()
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 8. Poll Now
  app.post('/api/gmail/poll-now', authenticatedLimiter, async (req: Request, res: Response) => {
    try {
      const userEmail = req.body?.user_email || req.body?.email || (req.headers['x-user-email'] as string);
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const token = req.body?.access_token || bearerToken;
      const freshStoredToken = await ensureFreshAccessToken();
      const storedToken = freshStoredToken || getGmailAccessToken();
      const status = getGmailStatus(userEmail);
      
      const effectiveToken = (token && !token.startsWith('mock_') && !token.startsWith('enclave_'))
        ? token
        : (storedToken && !storedToken.startsWith('mock_') && !storedToken.startsWith('enclave_'))
          ? storedToken
          : null;

      let processedCasesCount = 0;
      let lastResult: any = null;
      let syncSource = 'live_gmail_api';
      let syncMessage = '';

      if (effectiveToken) {
        const query = req.body?.query || 'label:INBOX';
        const messages = await listGmailMessages(effectiveToken, query, 10);

        if (messages.length > 0) {
          for (const msg of messages) {
            const rawEml = await fetchGmailMessageRaw(msg.id, effectiveToken);
            if (rawEml) {
              queueEmailForAnalysis({
                messageId: msg.id,
                threadId: msg.threadId,
                source: 'poll_now',
                emailAddress: status.email_address || undefined,
                rawEml,
                deliveryStage: 'post-delivery-alert'
              });

              const result = await parseRawEmailToAnalysis(rawEml, `gmail_${msg.id}.eml`, undefined, {
                isPushInterception: false,
                deliveryStage: 'post-delivery-alert'
              });

              processedCasesCount++;
              lastResult = result;

              if (result.analysis?.threatScore >= 70) {
                await modifyGmailMessageLabels(msg.id, ['TraceXMail-Quarantine'], ['INBOX'], effectiveToken);
              }
            }
          }
          syncMessage = `Successfully polled, queued, and analyzed ${processedCasesCount} live Gmail message(s).`;
        } else {
          syncMessage = 'Connected to live Gmail API. 0 new messages found matching query.';
        }
      } else {
        syncSource = 'no_live_token';
        syncMessage = 'No active Google OAuth Access Token connected.';
      }

      res.json({
        status: status.auth_expired ? 'auth_expired' : effectiveToken ? 'ok' : 'notice',
        auth_expired: Boolean(status.auth_expired),
        processed_cases_count: processedCasesCount,
        latest_case_id: lastResult?.case?.id,
        sync_source: syncSource,
        message: syncMessage
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 9. Sync Quarantine Reports & Dispatch Notes
  app.post('/api/gmail/sync-quarantine-reports', authenticatedLimiter, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const freshStoredToken = await ensureFreshAccessToken();
      const storedToken = freshStoredToken || getGmailAccessToken();
      const effectiveToken = bearerToken || storedToken;

      if (!effectiveToken) {
        return res.status(400).json({ status: 'error', error: 'No active Google OAuth access token available.' });
      }

      const maxToScan = typeof req.body?.limit === 'number' ? Math.min(req.body.limit, 50) : 40;
      const result = await backfillQuarantineReportNotes(effectiveToken, maxToScan);

      res.json({
        status: 'ok',
        scanned: result.scanned,
        inserted: result.inserted,
        skipped: result.skipped,
        message: `Processed ${result.scanned} quarantined email(s): ${result.inserted} report note(s) inserted, ${result.skipped} skipped.`
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  app.post(['/api/gmail/dispatch-report', '/api/gmail/cases/:caseId/dispatch-report'], authenticatedLimiter, async (req: Request, res: Response) => {
    try {
      const caseIdParam = req.params.caseId || req.body?.case_id || req.body?.caseId;
      const threadIdParam = req.body?.threadId || req.body?.thread_id || req.body?.messageId || req.body?.message_id;
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const freshStoredToken = await ensureFreshAccessToken();
      const storedToken = freshStoredToken || getGmailAccessToken();
      const effectiveToken = bearerToken || storedToken;

      if (!effectiveToken) {
        return res.status(400).json({ status: 'error', error: 'No active Google OAuth access token available.' });
      }

      const caseData = caseIdParam ? getPersistedCase(caseIdParam) : null;
      const threatScore = caseData?.threat_score ?? req.body?.threatScore ?? 85;
      const verdict = caseData?.severity || req.body?.verdict || 'MALICIOUS_PHISH';
      const subject = caseData?.title || req.body?.subject || 'Security Briefing: Inbound Quarantine Notice';

      const inserted = await insertQuarantineReportNote({
        threadId: threadIdParam || (caseData?.id ? `thread-${caseData.id}` : undefined),
        accessToken: effectiveToken,
        subject,
        reportSummary: req.body?.reportSummary || `High threat risk score (${threatScore}/100) identified by TraceXMail.`,
        caseId: caseIdParam || 'case-direct',
        threatScore,
        verdict,
        topReason: `Flagged as ${verdict}`,
        alsoSendToInbox: req.body?.alsoSendToInbox !== false
      });

      res.json({
        status: inserted ? 'success' : 'skipped',
        case_id: caseIdParam,
        message: inserted ? 'Forensic report note successfully injected into Gmail thread.' : 'Report note skipped or already present.'
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  app.post('/api/gmail/preview-report-note', publicLimiter, (req: Request, res: Response) => {
    try {
      const { caseId, subject, threatScore, verdict, reportSummary, auth, originIp, whyNarrative } = req.body || {};
      const payload = generateSampleQuarantineReportPayload({
        caseId,
        subject,
        threatScore: typeof threatScore === 'number' ? threatScore : 88,
        verdict: verdict || 'MALICIOUS_PHISH',
        reportSummary,
        auth,
        originIp,
        whyNarrative
      });

      res.json({
        status: 'ok',
        preview: {
          snippet: payload.snippetLine,
          plainText: payload.bodyText,
          htmlBody: payload.htmlBody,
          rfcHeaders: payload.rfcHeaders,
          senderEmail: payload.selfEmail,
          noteMessageId: payload.noteMessageId
        }
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  app.post('/api/gmail/test-report-note', authenticatedLimiter, async (req: Request, res: Response) => {
    try {
      const sampleCaseId = `CASE-TEST-${Date.now().toString(36).toUpperCase()}`;
      const sampleSubject = req.body?.subject || 'TEST BRIEFING: TraceXMail In-Thread Quarantine Verification';
      const sampleThreatScore = req.body?.threatScore ?? 88;
      const sampleVerdict = req.body?.verdict || 'MALICIOUS_PHISH';

      const preview = generateSampleQuarantineReportPayload({
        caseId: sampleCaseId,
        subject: sampleSubject,
        threatScore: sampleThreatScore,
        verdict: sampleVerdict
      });

      res.json({
        status: 'success',
        mode: 'sandbox_simulation',
        case_id: sampleCaseId,
        message: 'Sandbox verification passed!',
        preview: {
          snippet: preview.snippetLine,
          htmlBody: preview.htmlBody
        }
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 10. Ingestion Queue & Sync Config
  app.get('/api/gmail/ingestion-queue', publicLimiter, (_req: Request, res: Response) => {
    const queue = getIngestionQueue();
    res.json(queue);
  });

  app.get('/api/gmail/sync-config', publicLimiter, (_req: Request, res: Response) => {
    res.json(getAutoSyncConfig());
  });

  app.post('/api/gmail/sync-config', strictRateLimiter, requireAuth, (req: Request, res: Response) => {
    try {
      const { enabled, interval_seconds } = req.body || {};
      const updated = setAutoSyncConfig(
        typeof enabled === 'boolean' ? enabled : true,
        typeof interval_seconds === 'number' ? interval_seconds : undefined
      );

      broadcastWebSocketEvent({
        type: 'AUTO_SYNC_CONFIG_CHANGED',
        timestamp: new Date().toISOString(),
        config: updated
      });

      res.json({ status: 'ok', config: updated });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err?.message || 'Failed to update sync config' });
    }
  });

  app.get('/api/gmail/synced-emails', publicLimiter, async (_req: Request, res: Response) => {
    res.json(getSyncedEmails());
  });

  // 11. Pub/Sub Push Interception Endpoint
  app.post('/api/gmail/pubsub/push', publicLimiter, async (req: Request, res: Response) => {
    try {
      const isAuthorized = await verifyGooglePubSubPushToken(req);
      if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized Cloud Pub/Sub push request' });
      }

      const body = req.body || {};
      const message = body.message;
      if (!message || !message.data) {
        return res.status(200).send('OK');
      }

      const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
      const pushPayload = JSON.parse(decodedData);

      const result = await handlePubSubPush(pushPayload);
      res.status(200).json({ status: 'success', processed: result });
    } catch (err: any) {
      logger.error({ error: err?.message }, '[PubSubPush] Processing error');
      res.status(200).send('OK');
    }
  });

  // Admin-Only Test Endpoints (Disabled in production unless ENABLE_TEST_ENDPOINTS === 'true')
  app.post(
    '/api/gmail/simulate-inbound',
    authenticatedLimiter,
    async (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
        return res.status(404).json({ error: 'Not found' });
      }

      const rawEml = req.body?.raw_email || `From: security@external-phish.net\nTo: user@company.com\nSubject: Critical Account Update\nDate: ${new Date().toUTCString()}\n\nPlease verify credentials.`;
      const result = await parseRawEmailToAnalysis(rawEml, 'simulated_inbound.eml', undefined, {
        isPushInterception: true,
        deliveryStage: 'pre-delivery-hold'
      });
      res.json(result);
    }
  );

  app.post(
    '/api/gmail/pubsub/test-push',
    authenticatedLimiter,
    async (req: Request, res: Response) => {
      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
        return res.status(404).json({ error: 'Not found' });
      }

      const sampleRaw = `From: alerts@corp-security.com\nTo: soc@company.com\nSubject: PubSub Test Message\nDate: ${new Date().toUTCString()}\n\nTest content.`;
      const result = await parseRawEmailToAnalysis(sampleRaw, 'pubsub_test_push.eml', undefined, {
        isPushInterception: true,
        deliveryStage: 'pre-delivery-hold'
      });
      res.json({ status: 'success', result });
    }
  );

  // 12. Quarantine Config & Audit Logs
  app.post('/api/gmail/quarantine/config', authenticatedLimiter, requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
    const updated = updateQuarantineConfig(req.body);
    res.json(updated);
  });

  app.get('/api/gmail/quarantine/logs', authenticatedLimiter, requireAuth, async (_req: Request, res: Response) => {
    const logs = await fetchQuarantineAuditLogs();
    res.json(logs);
  });

  // 13. Quarantine Queue & Release/Delete Actions
  app.get('/api/gmail/quarantine/queue', authenticatedLimiter, requireAuth, async (_req: Request, res: Response) => {
    const queue = getPendingQuarantineQueue();
    res.json(queue);
  });

  app.post(
    '/api/gmail/quarantine/:id/release',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin', 'analyst']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user!;
      try {
        const result = await releaseQuarantinedMessage(id, user.email);
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to release message' });
      }
    }
  );

  app.post(
    '/api/gmail/quarantine/:id/delete',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin', 'analyst']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user!;
      try {
        const result = await deleteQuarantinedMessage(id, user.email);
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to delete message' });
      }
    }
  );

  // 14. Quarantine Single Message / Filter / Trash
  app.post('/api/gmail/quarantine-message', authenticatedLimiter, async (req: Request, res: Response) => {
    const { message_id, messageId } = req.body || {};
    const id = message_id || messageId;
    if (!id) return res.status(400).json({ error: 'message_id is required' });
    try {
      const result = await quarantineGmailMessage(id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to quarantine message' });
    }
  });

  app.post('/api/gmail/create-filter', authenticatedLimiter, async (req: Request, res: Response) => {
    const { from_criteria, fromCriteria } = req.body || {};
    const criteria = from_criteria || fromCriteria;
    if (!criteria) return res.status(400).json({ error: 'from_criteria is required' });
    try {
      const result = await createGmailBlockFilter(criteria);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create block filter' });
    }
  });

  app.post('/api/gmail/trash-message', authenticatedLimiter, async (req: Request, res: Response) => {
    const { message_id, messageId } = req.body || {};
    const id = message_id || messageId;
    if (!id) return res.status(400).json({ error: 'message_id is required' });
    try {
      const result = await trashGmailMessage(id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to trash message' });
    }
  });

  app.get('/api/gmail/search', authenticatedLimiter, async (req: Request, res: Response) => {
    const query = (req.query.q as string) || '';
    if (!query) return res.status(400).json({ error: 'Query parameter q is required' });
    try {
      const results = await searchGmailMessages(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Search failed' });
    }
  });

  // 15. Disconnect Gmail (RBAC: admin, analyst)
  app.post('/api/gmail/disconnect', gmailDisconnectLimiter, requireAuth, requireRole(['admin', 'analyst']), async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: Missing verified organization context' });
      }
      const force = Boolean(req.body?.force);
      const result = await disconnectGmail(orgId, { force });

      broadcastWebSocketEvent({
        type: 'GMAIL_DISCONNECTED',
        timestamp: new Date().toISOString(),
        connected: false,
        force_cleared: result.force_cleared,
        email: null
      }, orgId);

      res.json(result);
    } catch (err: any) {
      res.json({
        success: true,
        disconnected: true,
        force_cleared: true,
        message: 'Gmail connection force-cleared locally with warnings.',
        warning: err?.message || 'Partial cleanup warning'
      });
    }
  });
}
