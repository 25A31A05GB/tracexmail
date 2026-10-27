import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { publicLimiter } from '../rateLimiter';
import {
  handleGetNetworkInfo,
  handlePingNetwork,
  handleGetBandwidthPayload
} from '../networkIntelligenceService';
import { isSupabaseConfigured, getSupabaseClient, getSupabaseAdminClient } from '../supabase';
import { isVirusTotalConfigured } from '../intelligence';
import { isOtxConfigured } from '../otxService';
import { maxMindDb } from '../maxmindService';
import { getMetricsHandler } from '../telemetry/metrics';
import { getEmailAlertConfig } from '../emailAlertService';

export async function checkDatabaseReadiness(): Promise<{ ready: boolean; latencyMs: number; error?: string }> {
  if (process.env.__TEST_FORCE_DB_DOWN === 'true') {
    return { ready: false, latencyMs: 0, error: 'Database simulated failure' };
  }

  const supabase = getSupabaseAdminClient() || getSupabaseClient();
  if (!supabase) {
    if (process.env.NODE_ENV === 'production') {
      return { ready: false, latencyMs: 0, error: 'Supabase database not configured in production' };
    }
    return { ready: true, latencyMs: 1 };
  }

  const start = Date.now();
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database ping timeout (>5000ms)')), 5000)
    );

    const queryPromise = supabase.from('schema_version').select('*').limit(1);
    await Promise.race([queryPromise, timeoutPromise]);
    return { ready: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    // If table doesn't exist, Supabase connection itself may still be fine
    if (err?.message?.includes('schema_version') || err?.code === 'PGRST204' || err?.code === '42P01') {
      return { ready: true, latencyMs: Date.now() - start };
    }
    return { ready: false, latencyMs: Date.now() - start, error: err?.message || 'Database unreachable' };
  }
}

export async function checkRedisReadiness(): Promise<{ ready: boolean; latencyMs: number; error?: string; status?: string }> {
  if (process.env.__TEST_FORCE_REDIS_DOWN === 'true') {
    return { ready: false, latencyMs: 0, error: 'Redis simulated failure', status: 'DOWN' };
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    // When REDIS_URL is not configured, queue falls back safely to in-process memory queue
    return { ready: true, latencyMs: 0, status: 'IN_PROCESS_MEMORY' };
  }

  const start = Date.now();
  let client: any = null;
  try {
    const IORedis = (await import('ioredis')).default;
    client = new IORedis(redisUrl, {
      connectTimeout: 500,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timeout')), 600)
    );

    await Promise.race([client.ping(), timeoutPromise]);
    try { await client.quit(); } catch { client.disconnect(); }
    return { ready: true, latencyMs: Date.now() - start, status: 'CONNECTED' };
  } catch (err: any) {
    if (client) {
      try { client.disconnect(); } catch {}
    }
    return { ready: false, latencyMs: Date.now() - start, error: err?.message || 'Redis unreachable', status: 'DOWN' };
  }
}

export function checkEmailReadiness(): { ready: boolean; configured: boolean; error?: string } {
  const hasEmail = Boolean(process.env.RESEND_API_KEY?.trim() || process.env.SMTP_HOST?.trim());
  return {
    ready: true,
    configured: hasEmail,
    ...(hasEmail ? {} : { error: 'Email alert delivery provider not configured (auxiliary alert sink; in-app and webhook alerts active)' })
  };
}

export function registerHealthRoutes(app: express.Express): void {
  // Network Diagnostic Utilities
  app.get('/api/network-info', publicLimiter, handleGetNetworkInfo);
  app.get('/api/network/ping', publicLimiter, handlePingNetwork);
  app.get('/api/network/bandwidth-payload', publicLimiter, handleGetBandwidthPayload);

  // Prometheus Metrics endpoint
  app.get('/metrics', getMetricsHandler);

  // Liveness Check: verifies the node process is alive and accepting event loop cycles
  app.get('/api/health/live', publicLimiter, (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'live',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Readiness Check: verifies critical dependencies (Database, Redis, Queue, Email Delivery) are reachable
  app.get('/api/health/ready', publicLimiter, async (_req: Request, res: Response) => {
    const [dbCheck, redisCheck] = await Promise.all([
      checkDatabaseReadiness(),
      checkRedisReadiness()
    ]);
    const emailCheck = checkEmailReadiness();

    const isReady = dbCheck.ready && redisCheck.ready;
    const statusCode = isReady ? 200 : 503;

    const memory = process.memoryUsage();
    res.status(statusCode).json({
      status: isReady ? 'ready' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: {
          status: dbCheck.ready ? 'up' : 'down',
          latencyMs: dbCheck.latencyMs,
          ...(dbCheck.error ? { error: dbCheck.error } : {})
        },
        redis: {
          status: redisCheck.ready ? 'up' : 'down',
          latencyMs: redisCheck.latencyMs,
          mode: redisCheck.status || (process.env.REDIS_URL ? 'redis' : 'in_process_memory'),
          ...(redisCheck.error ? { error: redisCheck.error } : {})
        },
        queue: {
          status: redisCheck.ready ? 'up' : 'degraded',
          mode: process.env.REDIS_URL ? 'redis' : 'in_process_memory'
        },
        email: {
          status: emailCheck.configured ? 'configured' : 'optional_unconfigured',
          ...(emailCheck.error ? { note: emailCheck.error } : {})
        }
      },
      components: {
        maxmind: maxMindDb.getStatus().status,
        virustotal: isVirusTotalConfigured() ? 'CONFIGURED' : 'UNCONFIGURED',
        alienvault_otx: isOtxConfigured() ? 'CONFIGURED' : 'UNCONFIGURED'
      },
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`
      }
    });
  });

  // Legacy /api/health endpoint aliases to readiness
  app.get('/api/health', publicLimiter, async (req: Request, res: Response) => {
    const [dbCheck, redisCheck] = await Promise.all([
      checkDatabaseReadiness(),
      checkRedisReadiness()
    ]);

    const emailCfg = getEmailAlertConfig();
    const hasEmailConfigured = Boolean(emailCfg.resendApiKey || process.env.SMTP_HOST);

    const isReady = dbCheck.ready && redisCheck.ready;
    const statusCode = isReady ? 200 : 503;
    const memory = process.memoryUsage();

    res.status(statusCode).json({
      status: isReady ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.5.0',
      service: 'TraceXMail Email Forensics Platform',
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        database: dbCheck.ready ? 'CONNECTED' : 'UNREACHABLE',
        redis: redisCheck.ready ? (process.env.REDIS_URL ? 'CONNECTED' : 'IN_PROCESS_MEMORY') : 'UNREACHABLE',
        email: hasEmailConfigured ? 'CONNECTED' : 'OPTIONAL_UNCONFIGURED'
      },
      components: {
        maxmind: maxMindDb.getStatus().status,
        virustotal: isVirusTotalConfigured() ? 'CONFIGURED' : 'UNCONFIGURED',
        alienvault_otx: isOtxConfigured() ? 'CONFIGURED' : 'UNCONFIGURED',
        database: isSupabaseConfigured ? 'CONNECTED' : 'IN_MEMORY_FALLBACK'
      },
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`
      }
    });
  });

  // Auth Status Diagnostic
  app.get('/api/auth/status', publicLimiter, (_req: Request, res: Response) => {
    res.json({
      supabase_configured: isSupabaseConfigured,
      jwt_secret_configured: Boolean(process.env.JWT_SECRET),
      token_encryption_configured: Boolean(process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEYS),
      allowed_origins_count: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean).length,
      auth_providers: ['supabase_oauth', 'supabase_password', 'enclave_token', 'saml_sso', 'oidc_sso'],
      dev_header_auth_allowed: process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_HEADER_AUTH === 'true'
    });
  });

  // LLMs.txt for AI crawlers
  app.get(['/llms.txt', '/.well-known/llms.txt'], (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), 'public', 'llms.txt');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(filePath);
    }
    res.type('text/plain').send('# TraceXMail Email Forensics API Documentation\n> Multi-vector email forensics and threat intelligence platform.');
  });

  app.get('/llms-full.txt', (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), 'public', 'llms-full.txt');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(filePath);
    }
    res.type('text/plain').send('# TraceXMail Full System Spec\n> Production forensic analysis platform.');
  });

  // Security.txt
  app.get(['/.well-known/security.txt', '/security.txt'], (_req: Request, res: Response) => {
    const filePath = path.join(process.cwd(), 'public', '.well-known', 'security.txt');
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.sendFile(filePath);
    }
    res.type('text/plain').send('Contact: security@tracexmail.com\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: en\n');
  });

  // Ads.txt (conditional on VITE_ADSENSE_PUB_ID)
  app.get('/ads.txt', (_req: Request, res: Response) => {
    const pubId = process.env.VITE_ADSENSE_PUB_ID || process.env.ADSENSE_PUB_ID;
    if (pubId && pubId.trim().length > 0) {
      res.type('text/plain').send(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
    } else {
      res.status(404).type('text/plain').send('No ad inventory configured.\n');
    }
  });

  // Static SEO informational pages (bypasses SPA index rewrite)
  app.get(['/about', '/about/index.html'], (_req: Request, res: Response) => {
    const p = path.join(process.cwd(), 'public', 'about', 'index.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('About page not found');
  });

  app.get(['/knowledge', '/knowledge/', '/knowledge/index.html'], (_req: Request, res: Response) => {
    const p = path.join(process.cwd(), 'public', 'knowledge', 'index.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('Knowledge hub not found');
  });

  app.get('/knowledge/:slug', (req: Request, res: Response, next) => {
    const slug = req.params.slug;
    const directFile = path.join(process.cwd(), 'public', 'knowledge', slug.endsWith('.html') ? slug : `${slug}.html`);
    if (fs.existsSync(directFile)) {
      return res.sendFile(directFile);
    }
    next();
  });

  app.get(['/privacy', '/privacy/index.html'], (_req: Request, res: Response) => {
    const p = path.join(process.cwd(), 'public', 'privacy', 'index.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('Privacy policy not found');
  });

  app.get(['/terms', '/terms/index.html'], (_req: Request, res: Response) => {
    const p = path.join(process.cwd(), 'public', 'terms', 'index.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('Terms of service not found');
  });

  app.get(['/contact', '/contact/index.html'], (_req: Request, res: Response) => {
    const p = path.join(process.cwd(), 'public', 'contact', 'index.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('Contact page not found');
  });
}
