import express, { Request, Response } from 'express';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, requireRole, AuthenticatedRequest } from '../compliance';
import { logger } from '../logger';
import {
  getMailProvider,
  registerMailProvider,
  listMailProvidersForOrg
} from '../mail/provider';
import { GmailProvider } from '../mail/gmailProvider';
import { MicrosoftGraphProvider } from '../mail/microsoftGraphProvider';
import { addAnalyzeJob } from '../queue/index';

export function registerMailRoutes(app: express.Express): void {
  // Ensure default providers are registered for default-org
  if (!getMailProvider('default-org', 'gmail')) {
    registerMailProvider('default-org', new GmailProvider('default-org'));
  }
  if (!getMailProvider('default-org', 'microsoft365')) {
    registerMailProvider('default-org', new MicrosoftGraphProvider('default-org'));
  }

  // 1. List configured and available providers for current org
  app.get('/api/mail/providers', publicLimiter, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || 'default-org';
    const providers = listMailProvidersForOrg(orgId);

    // If empty, return status for standard providers
    if (providers.length === 0) {
      const gmail = new GmailProvider(orgId);
      const m365 = new MicrosoftGraphProvider(orgId);
      registerMailProvider(orgId, gmail);
      registerMailProvider(orgId, m365);
      return res.json([gmail.getStatus(), m365.getStatus()]);
    }

    res.json(providers);
  });

  // 2. Microsoft 365 Connection Endpoint
  app.post('/api/mail/m365/connect', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || 'default-org';

    let provider = getMailProvider(orgId, 'microsoft365') as MicrosoftGraphProvider;
    if (!provider) {
      provider = new MicrosoftGraphProvider(orgId);
      registerMailProvider(orgId, provider);
    }

    const {
      accessToken,
      refreshToken,
      tenantId,
      clientId,
      clientSecret,
      emailAddress,
      quarantineEnabled
    } = req.body || {};

    const connected = await provider.connect({
      orgId,
      accessToken,
      refreshToken,
      tenantId,
      clientId,
      clientSecret,
      emailAddress,
      quarantineEnabled: quarantineEnabled ?? true
    });

    res.json({
      success: connected,
      status: provider.getStatus()
    });
  });

  // 3. Microsoft Graph Webhook Handshake & Notification Handler
  // Graph requires handling GET or POST with ?validationToken=... and echoing it back with 200 text/plain
  app.all('/api/mail/m365/webhook', async (req: Request, res: Response) => {
    const validationToken = req.query.validationToken as string;
    if (validationToken) {
      logger.info('Responding to Microsoft Graph validationToken handshake');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(validationToken);
    }

    // Process incoming notifications
    const notifications = req.body?.value || [];
    for (const notif of notifications) {
      const messageId = notif.resourceData?.id;
      const clientState = notif.clientState;

      if (messageId) {
        logger.info({ messageId, clientState }, 'Received Microsoft Graph change notification');
        // Fetch raw MIME and process in background queue
        const provider = getMailProvider('default-org', 'microsoft365');
        if (provider) {
          setImmediate(async () => {
            try {
              const rawData = await provider.getRawMessage(messageId);
              await addAnalyzeJob({
                emailContent: rawData.rawMime,
                filename: `m365_${messageId}.eml`,
                organizationId: 'default-org',
                metadata: { provider: 'microsoft365', messageId }
              });
            } catch (err: any) {
              logger.error({ messageId, error: err.message }, 'Failed processing M365 webhook message');
            }
          });
        }
      }
    }

    res.status(202).send('Accepted');
  });

  // 4. Unified Quarantine Endpoint
  app.post('/api/mail/quarantine/:id', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || 'default-org';
    const providerType = (req.query.provider as string)?.toLowerCase() === 'microsoft365' ? 'microsoft365' : 'gmail';

    const provider = getMailProvider(orgId, providerType);
    if (!provider) {
      return res.status(404).json({ error: `Provider ${providerType} not configured` });
    }

    const result = await provider.applyQuarantine(req.params.id);
    res.json(result);
  });

  // 5. Unified Release from Quarantine Endpoint
  app.post('/api/mail/quarantine/:id/release', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId || 'default-org';
    const providerType = (req.query.provider as string)?.toLowerCase() === 'microsoft365' ? 'microsoft365' : 'gmail';

    const provider = getMailProvider(orgId, providerType);
    if (!provider) {
      return res.status(404).json({ error: `Provider ${providerType} not configured` });
    }

    const result = await provider.releaseFromQuarantine(req.params.id, req.body?.originalFolderId);
    res.json(result);
  });
}
