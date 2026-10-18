import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../logger';
import { saveUserProfile, resolveUserProfile } from '../userProfileStore';

export interface ScimTokenRecord {
  orgId: string;
  tokenHash: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

// In-memory token storage (orgId -> ScimTokenRecord)
const scimTokens = new Map<string, ScimTokenRecord>();

// In-memory SCIM user directory (id -> user)
interface ScimUser {
  id: string;
  userName: string;
  name: { formatted?: string; givenName?: string; familyName?: string };
  emails: { value: string; primary: boolean }[];
  active: boolean;
  roles: string[];
  groups: string[];
  organizationId: string;
}

const scimUserStore = new Map<string, ScimUser>();

export function generateScimToken(orgId: string): { plaintextToken: string; record: ScimTokenRecord } {
  const rawBytes = crypto.randomBytes(32).toString('hex');
  const plaintextToken = `scim_${rawBytes}`;
  const tokenHash = crypto.createHash('sha256').update(plaintextToken).digest('hex');
  const tokenPrefix = plaintextToken.slice(0, 10);

  const record: ScimTokenRecord = {
    orgId,
    tokenHash,
    tokenPrefix,
    createdAt: new Date().toISOString()
  };

  scimTokens.set(orgId, record);
  return { plaintextToken, record };
}

export function verifyScimToken(token: string): { valid: boolean; orgId?: string } {
  if (!token || !token.startsWith('scim_')) return { valid: false };
  const incomingHash = crypto.createHash('sha256').update(token).digest('hex');

  for (const record of scimTokens.values()) {
    if (record.tokenHash === incomingHash) {
      record.lastUsedAt = new Date().toISOString();
      return { valid: true, orgId: record.orgId };
    }
  }
  return { valid: false };
}

export function registerScimRoutes(app: express.Express): void {
  const scimRouter = express.Router();

  // SCIM Authentication Middleware
  scimRouter.use((req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Missing or malformed Authorization header',
        status: '401'
      });
    }

    const token = authHeader.slice(7).trim();
    const verification = verifyScimToken(token);
    if (!verification.valid) {
      return res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Invalid SCIM Bearer token',
        status: '401'
      });
    }

    (req as any).scimOrgId = verification.orgId;
    next();
  });

  // GET /scim/v2/Users (List with filter support)
  scimRouter.get('/Users', (req: Request, res: Response) => {
    const orgId = (req as any).scimOrgId;
    const filter = (req.query.filter as string) || '';

    let users = Array.from(scimUserStore.values()).filter(u => u.organizationId === orgId);

    // Basic SCIM filter: userName eq "user@example.com"
    if (filter) {
      const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (match) {
        const targetEmail = match[1].toLowerCase();
        users = users.filter(u => u.userName.toLowerCase() === targetEmail);
      }
    }

    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: users.length,
      startIndex: 1,
      itemsPerPage: users.length,
      Resources: users.map(toScimUserResource)
    });
  });

  // POST /scim/v2/Users (Provision new user)
  scimRouter.post('/Users', async (req: Request, res: Response) => {
    const orgId = (req as any).scimOrgId;
    const body = req.body;

    const email = body.userName || (body.emails && body.emails[0]?.value);
    if (!email) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'userName or primary email is required',
        status: '400'
      });
    }

    const userId = body.id || `usr_scim_${crypto.randomBytes(8).toString('hex')}`;
    const scimUser: ScimUser = {
      id: userId,
      userName: email,
      name: body.name || { formatted: email.split('@')[0] },
      emails: [{ value: email, primary: true }],
      active: body.active !== false,
      roles: ['analyst'],
      groups: [],
      organizationId: orgId
    };

    scimUserStore.set(userId, scimUser);

    // Sync to user profile store
    await saveUserProfile(email, {
      id: userId,
      email: email.toLowerCase(),
      name: body.name?.formatted || email.split('@')[0],
      organizationId: orgId,
      role: 'analyst',
      active: scimUser.active
    });

    logger.info({ userId, email, orgId }, 'SCIM 2.0 User provisioned');
    res.status(201).json(toScimUserResource(scimUser));
  });

  // GET /scim/v2/Users/:id
  scimRouter.get('/Users/:id', (req: Request, res: Response) => {
    const user = scimUserStore.get(req.params.id);
    if (!user || user.organizationId !== (req as any).scimOrgId) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404'
      });
    }
    res.json(toScimUserResource(user));
  });

  // PATCH /scim/v2/Users/:id (Deactivation / Updates)
  scimRouter.patch('/Users/:id', async (req: Request, res: Response) => {
    const user = scimUserStore.get(req.params.id);
    if (!user || user.organizationId !== (req as any).scimOrgId) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404'
      });
    }

    const operations = req.body.Operations || [];
    for (const op of operations) {
      if (op.op?.toLowerCase() === 'replace') {
        if (op.path?.toLowerCase() === 'active') {
          user.active = Boolean(op.value);
        } else if (typeof op.value === 'object' && op.value?.active !== undefined) {
          user.active = Boolean(op.value.active);
        } else if (typeof op.value === 'boolean') {
          user.active = op.value;
        }
      }
    }

    if (req.body.active !== undefined) {
      user.active = Boolean(req.body.active);
    }

    // If deactivated, revoke user sessions and update profile
    await saveUserProfile(user.userName, {
      id: user.id,
      email: user.userName,
      active: user.active
    });

    if (!user.active) {
      const { revokeAllSessions } = await import('./session');
      await revokeAllSessions(user.id);
      logger.info({ userId: user.id, email: user.userName }, 'SCIM user deactivated; revoked all sessions');
    }

    res.json(toScimUserResource(user));
  });

  // GET /scim/v2/Groups
  scimRouter.get('/Groups', (req: Request, res: Response) => {
    const groups = [
      { id: 'grp_admin', displayName: 'Security Administrators', role: 'admin' },
      { id: 'grp_analyst', displayName: 'SOC Analysts', role: 'analyst' },
      { id: 'grp_readonly', displayName: 'Auditors & Read Only', role: 'read_only' }
    ];
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: groups.length,
      Resources: groups
    });
  });

  app.use('/scim/v2', scimRouter);
}

function toScimUserResource(u: ScimUser) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: u.id,
    userName: u.userName,
    name: u.name,
    emails: u.emails,
    active: u.active,
    roles: u.roles,
    meta: {
      resourceType: 'User',
      created: new Date().toISOString(),
      location: `/scim/v2/Users/${u.id}`
    }
  };
}
