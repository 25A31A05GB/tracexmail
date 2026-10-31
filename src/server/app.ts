import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { validateStartupEnv } from './envValidation';
import { assertEncryptionKeyConfigured, authenticateUser, requireAuth, AuthenticatedRequest } from './compliance';
import { errorHandler } from './errorHandler';
import { logger } from './logger';

// Route Modules
import { registerHealthRoutes } from './routes/health';
import { registerMlRoutes } from './routes/ml';
import { registerIntelligenceRoutes } from './routes/intelligence';
import { registerAnalyzeRoutes } from './routes/analyze';
import { registerCasesRoutes } from './routes/cases';
import { registerCampaignsRoutes } from './routes/campaigns';
import { registerGmailRoutes } from './routes/gmail';
import { registerAlertsRoutes } from './routes/alerts';
import { registerOrganizationRoutes } from './routes/organization';
import { registerTeamRoutes } from './routes/team';
import { registerAuthRoutes } from './routes/auth';
import { registerMailRoutes } from './routes/mail';
import { registerAuditRoutes } from './routes/audit';
import { registerScimRoutes } from './identity/scim';

export async function createApp(options?: { skipVite?: boolean }): Promise<express.Application> {
  // 1. Startup Environment & Key Assertions
  validateStartupEnv();
  assertEncryptionKeyConfigured();

  const app = express();

  // 2. Reverse Proxy Trust (Single hop for Render / Cloud Run)
  app.set('trust proxy', 1);

  // 3. Security Headers via Helmet (configured to support AI Studio preview iframe)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://challenges.cloudflare.com',
            'https://*.cloudflare.com',
            'https://*.sentry.io',
            'https://www.googletagmanager.com',
            'https://www.google-analytics.com',
            'https://apis.google.com',
            'https://*.googleapis.com',
            'https://accounts.google.com',
            'https://www.gstatic.com'
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https:',
            'http:',
            'wss:',
            'ws:',
            ...(process.env.SUPABASE_URL ? [process.env.SUPABASE_URL] : ['https://*.supabase.co']),
            'https://challenges.cloudflare.com',
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://accounts.google.com',
            'https://*.googleapis.com',
            'https://tracexmail-l6c7.onrender.com'
          ],
          frameSrc: [
            "'self'",
            'https:',
            'http:',
            'https://challenges.cloudflare.com',
            'https://accounts.google.com',
            'https://*.firebaseapp.com'
          ],
          frameAncestors: ["'self'", 'https:', 'http:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"]
        }
      },
      frameguard: false,
      hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 15552000,
        includeSubDomains: true
      } : false,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      }
    })
  );

  // 4. Permissions-Policy Header
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // 5. Strict CORS Configuration
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const siteUrl = process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.APP_BASE_URL;

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests without origin (curl, same-origin, mobile, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.toLowerCase().trim();

      // Check if origin is permitted
      const isAllowed =
        process.env.NODE_ENV !== 'production' ||
        normalizedOrigin.includes('localhost') ||
        normalizedOrigin.includes('127.0.0.1') ||
        normalizedOrigin.endsWith('.run.app') ||
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin === 'https://tracexmail.vercel.app' ||
        envOrigins.includes('*') ||
        envOrigins.includes(normalizedOrigin) ||
        (siteUrl && normalizedOrigin === siteUrl.toLowerCase().trim());

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn({ origin: normalizedOrigin }, '[CORS Blocked] Origin not permitted');
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'apikey',
      'x-goog-pubsub-token',
      'x-request-id'
    ]
  };

  app.use(cors(corsOptions));

  // 6. Global Body Parsers (1mb default limit)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 7. Request Logger Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
      if (!req.path.startsWith('/assets') && !req.path.startsWith('/@vite')) {
        logger.info(
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - startTime
          },
          `${req.method} ${req.path} ${res.statusCode}`
        );
      }
    });
    next();
  });

  // 8. Authentication & Context Resolution Middleware
  app.use(authenticateUser);

  // 8b. Metrics Endpoint Protection (/metrics)
  app.use('/metrics', (req: Request, res: Response, next: NextFunction) => {
    const internalToken = req.headers['x-internal-token'];
    if (internalToken && process.env.INTERNAL_SERVICE_TOKEN && internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
      return next();
    }
    const user = (req as AuthenticatedRequest).user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Prometheus metrics endpoint requires admin authorization or valid internal service token.',
        code: 'ERR_FORBIDDEN'
      });
    }
    return next();
  });

  // 8c. SEC-1 Global Default-Deny Authentication Gate for /api/*
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const rawPath = req.path || '';
    const fullPath = (req.baseUrl || '/api') + rawPath;

    // Explicit Public Allowlist
    const isPublic =
      fullPath.startsWith('/api/health') ||
      fullPath.startsWith('/api/auth/') ||
      fullPath === '/api/auth' ||
      fullPath.startsWith('/api/v1/gmail/callback') ||
      fullPath.startsWith('/oauth/') ||
      fullPath.startsWith('/api/oauth/') ||
      fullPath === '/api/gmail/pubsub/push' ||
      fullPath === '/api/mail/m365/webhook' ||
      fullPath.startsWith('/api/testimonials') ||
      fullPath.startsWith('/api/threat-intel/live-feed') ||
      fullPath.startsWith('/api/threat-feeds/real-world') ||
      fullPath === '/api/stats' ||
      fullPath === '/api/v1/stats' ||
      fullPath === '/api/stats/dashboard' ||
      ((process.env.PUBLIC_ANALYZE_ENABLED === 'true' || process.env.ALLOW_PUBLIC_ANALYZE === 'true' || process.env.NODE_ENV !== 'production') && fullPath.startsWith('/api/analyze'));

    if (isPublic) {
      return next();
    }

    // Bandwidth payload endpoint protection
    if (fullPath === '/api/network/bandwidth-payload') {
      const internalToken = req.headers['x-internal-token'];
      if (internalToken && process.env.INTERNAL_SERVICE_TOKEN && internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
        return next();
      }
      const user = (req as AuthenticatedRequest).user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden: Bandwidth test payload requires admin role or internal service token.',
          code: 'ERR_FORBIDDEN'
        });
      }
    }

    // Require Auth for all non-public /api routes
    return requireAuth(req, res, next);
  });

  // 9. Register Domain Route Modules
  registerHealthRoutes(app);
  registerMlRoutes(app);
  registerIntelligenceRoutes(app);
  registerAnalyzeRoutes(app);
  registerCasesRoutes(app);
  registerCampaignsRoutes(app);
  registerGmailRoutes(app);
  registerAlertsRoutes(app);
  registerOrganizationRoutes(app);
  registerTeamRoutes(app);
  registerAuthRoutes(app);
  registerMailRoutes(app);
  registerAuditRoutes(app);
  registerScimRoutes(app);

  // 9. Client SPA static files or Vite dev server
  const isVitest = Boolean(process.env.VITEST);
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (!isProduction && !isVitest && !options?.skipVite) {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else if (hasDist) {
    app.use(express.static(distPath));
    app.get(/(.*)/, (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 10. Global Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
