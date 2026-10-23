import 'dotenv/config';
import http from 'http';
import { createApp } from './src/server/app';
import { setupWebSocket } from './src/server/websocket';
import { syncGmailConnectionFromDb } from './src/server/gmailService';
import { runRetentionCleanup } from './src/server/compliance';
import { getSupabaseClient, DEFAULT_ORG_ID } from './src/server/supabase';
import { logger } from './src/server/logger';

export { createApp } from './src/server/app';

export async function startServer() {
  const app = await createApp();
  const server = http.createServer(app);

  // Attach hardened WebSocket server (ticket-authenticated, tenant-isolated)
  setupWebSocket(server);

  // Support process.env.PORT or default to 3000 as required in AI Studio
  const PORT = parseInt(process.env.PORT || '3000', 10);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[TraceXMail] Express + WebSocket server running on http://0.0.0.0:${PORT}`);

    // Sync stored Gmail connection credentials from database
    syncGmailConnectionFromDb().catch((err) => {
      logger.warn({ error: err?.message || err }, '[TraceXMail] Notice initializing stored Gmail connection');
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
