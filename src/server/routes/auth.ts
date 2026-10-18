import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, type AuthenticatedRequest, signUserToken } from '../compliance';
import { createAuthRouter } from '../authRoutes';
import { broadcastAlert } from '../websocket';
import { logger } from '../logger';

interface StoredAuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  userEmail: string;
  scope: string;
  expiresAt: number;
  used: boolean;
}

const storedAuthCodes = new Map<string, StoredAuthCode>();

// Clean expired auth codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of storedAuthCodes.entries()) {
    if (entry.expiresAt <= now || entry.used) {
      storedAuthCodes.delete(code);
    }
  }
}, 60000).unref();

export function registerAuthRoutes(app: express.Express): void {
  // Mount the comprehensive local authentication router
  const authRouter = createAuthRouter({
    broadcastAlertFn: broadcastAlert
  });
  app.use('/api/auth', authRouter);

  // Deprecated fake session endpoint: permanent 410 Gone with instructions
  app.all('/api/auth/session', publicLimiter, (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'The insecure /api/auth/session endpoint has been permanently removed. Authenticate using real Supabase Auth (email/password or SSO) and provide the JWT token in Authorization: Bearer <token>.',
      code: 'ERR_ENDPOINT_GONE'
    });
  });

  // Authenticated User Profile
  app.get('/api/auth/me', authenticatedLimiter, requireAuth, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    res.json({
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        authMethod: user.authMethod
      }
    });
  });

  // OAuth 2.0 Authorization Endpoint (Protected by requireAuth, strict redirect_uri allowlist)
  app.post('/api/oauth/v1/authorize', authenticatedLimiter, requireAuth, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const { client_id, redirect_uri, state, scope, decision } = req.body || {};

    if (!redirect_uri) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
    }

    // Validate redirect_uri against ALLOWED_REDIRECT_ORIGINS
    const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS || 'http://localhost:3000,http://localhost:5173')
      .split(',')
      .map((s) => s.trim().toLowerCase());

    try {
      const u = new URL(redirect_uri);
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

    if (decision === 'deny') {
      const url = new URL(redirect_uri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'The user denied the consent request');
      if (state) url.searchParams.set('state', state);
      return res.json({ redirect_url: url.toString() });
    }

    // Generate cryptographically secure authorization code (32 bytes base64url)
    const rawCode = `auth_${crypto.randomBytes(32).toString('base64url')}`;
    storedAuthCodes.set(rawCode, {
      code: rawCode,
      clientId: client_id || 'default_client',
      redirectUri: redirect_uri,
      userId: user.userId,
      userEmail: user.email,
      scope: scope || 'read:profile',
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      used: false
    });

    const targetUrl = new URL(redirect_uri);
    targetUrl.searchParams.set('code', rawCode);
    if (state) targetUrl.searchParams.set('state', state);

    res.json({
      status: 'authorized',
      code: rawCode,
      redirect_url: targetUrl.toString(),
      user: { id: user.userId, email: user.email },
      scope: scope || 'read:profile'
    });
  });

  // OAuth 2.0 Token Exchange Endpoint
  app.post(['/api/oauth/v1/token', '/oauth/token'], publicLimiter, (req: Request, res: Response) => {
    const { grant_type, code, client_id, redirect_uri } = req.body || {};

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant type is supported'
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'authorization code is missing'
      });
    }

    const stored = storedAuthCodes.get(code);
    if (!stored || stored.used || stored.expiresAt < Date.now()) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid, expired, or already used'
      });
    }

    if (redirect_uri && stored.redirectUri !== redirect_uri) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'redirect_uri does not match original authorization request'
      });
    }

    // Mark single-use code as used immediately
    stored.used = true;
    storedAuthCodes.delete(code);

    const accessToken = signUserToken({
      userId: stored.userId,
      email: stored.userEmail,
      role: 'analyst',
      organizationId: 'org_acme_soc_01',
      authMethod: 'oauth2_code'
    }, '1h');

    const refreshToken = `rtk_${crypto.randomBytes(32).toString('base64url')}`;

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: stored.scope,
      created_at: Math.floor(Date.now() / 1000)
    });
  });

  // Client SPA callback catcher
  app.get(['/auth/callback', '/auth/callback/*', '/oauth/callback', '/oauth/callback/*', '/api/auth/callback'], publicLimiter, (req: Request, res: Response) => {
    const code = req.query.code;
    const error = req.query.error;
    if (error) {
      return res.redirect(`/#error=${encodeURIComponent(String(error))}`);
    }
    if (code) {
      return res.redirect(`/#code=${encodeURIComponent(String(code))}`);
    }
    res.redirect('/');
  });
}
