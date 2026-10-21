import 'dotenv/config';
import http from 'http';
import { createApp } from './src/server/app';
import { setupWebSocket } from './src/server/websocket';
import { syncGmailConnectionFromDb } from './src/server/gmailService';
import { initializeLocalEmbeddingModel } from './src/server/semanticSimilarity';
import { runRetentionCleanup } from './src/server/compliance';
import { getSupabaseClient, DEFAULT_ORG_ID } from './src/server/supabase';
import { logger } from './src/server/logger';

export { createApp } from './src/server/app';

export async function startServer() {
  const app = await createApp();
  const server = http.createServer(app);

  // Attach hardened WebSocket server (ticket-authenticated, tenant-isolated)
  setupWebSocket(server);

  // Support CLI --port argument (e.g. server.ts --port 3000) or APP_PORT or fallback to 3000
  const args = process.argv.slice(2);
  const portArgIndex = args.indexOf('--port');
  const cliPort = portArgIndex !== -1 && args[portArgIndex + 1] ? args[portArgIndex + 1] : undefined;
  const rawPort = cliPort || process.env.APP_PORT || process.env.DEFAULT_APP_PORT || (process.env.PORT !== '8080' ? process.env.PORT : undefined) || '3000';
  const PORT = parseInt(rawPort, 10);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[TraceXMail] Express + WebSocket server running on http://0.0.0.0:${PORT}`);

    // Sync stored Gmail connection credentials from database
    syncGmailConnectionFromDb().catch((err) => {
      logger.warn({ error: err?.message || err }, '[TraceXMail] Notice initializing stored Gmail connection');
    });

    // Cold-start download & initialization of offline semantic transformer model
    initializeLocalEmbeddingModel().catch((err) => {
      logger.warn({ error: err?.message || err }, '[TraceXMail] Notice warming up offline local embedding model');
    });

    // Automated background retention cleanup schedule if RETENTION_PURGE_INTERVAL_MS is configured
    const purgeIntervalMs = parseInt(process.env.RETENTION_PURGE_INTERVAL_MS || '0', 10);
    if (purgeIntervalMs > 0) {
      logger.info(`[RetentionSchedule] Automated retention scheduler active (interval: ${purgeIntervalMs}ms)`);
      const retentionTimer = setInterval(async () => {
        try {
          logger.info('[RetentionSchedule] Executing automated data retention policy cycle...');
          await runRetentionCleanup({
            organization_id: DEFAULT_ORG_ID,
            supabase: getSupabaseClient()
          });
        } catch (err: any) {
          logger.warn({ error: err?.message }, '[RetentionSchedule] Automated retention cycle warning');
        }
      }, purgeIntervalMs);
      if (retentionTimer.unref) retentionTimer.unref();
    }
  });

  return { app, server };
}

// Only listen if executed directly and not inside vitest
if (!process.env.VITEST) {
  startServer().catch((err) => {
    logger.fatal({ error: err?.message || err }, '[TraceXMail] Fatal server startup error');
    process.exit(1);
  });
}
