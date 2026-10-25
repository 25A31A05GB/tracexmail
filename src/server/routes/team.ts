import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../compliance';
import {
  getOrgUsers,
  createOrgUser,
  updateOrgUser,
  deleteOrgUser,
  authenticateOrgUser
} from '../orgUserStore';
import { getSupabaseAdminClient } from '../supabase';
import { logger } from '../logger';

const memoryInvitations: any[] = [];

export function registerTeamRoutes(app: express.Express): void {
  // Team Roster (Tenant Scoped)
  app.get('/api/team/members', publicLimiter, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }
      const users = getOrgUsers(orgId);
      const members = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        employeeId: u.employeeId,
        role: u.role,
        permissions: u.permissions,
        status: u.status,
        lastActive: u.lastActive || 'Active'
      }));
      res.json(members);
    } catch {
      res.json([]);
    }
  });

  // Create Employee (RBAC: admin)
  app.post('/api/team/create-employee', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const caller = (req as AuthenticatedRequest).user!;
      const orgId = caller.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }
      const { name, email, password, role, employeeId } = req.body || {};

      const { user, generatedPassword } = await createOrgUser({
        organizationId: orgId,
        name: name || email?.split('@')[0],
        email: email || '',
        employeeId,
        role: role || 'analyst',
        password,
        createdBy: caller.email
      });

      res.status(201).json({
        status: 'success',
        employee: {
          id: user.id,
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          role: user.role,
          tempPassword: generatedPassword,
          status: user.status,
          created_at: user.created_at
        }
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create employee' });
    }
  });

  // Verify Employee Authentication
  app.post('/api/team/verify-employee-auth', publicLimiter, (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ authenticated: false, error: 'Email and password required' });
    }

    const result = authenticateOrgUser(email, password);
    if (result.authenticated && result.user) {
      return res.json({
        authenticated: true,
        user: {
          id: result.user.id,
          employeeId: result.user.employeeId,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          permissions: result.user.permissions,
          organizationName: result.user.organizationName,
          organizationId: result.user.organizationId
        }
      });
    }

    return res.status(401).json({ authenticated: false, error: 'Invalid operator credentials' });
  });

  // Update Team Member Role (Admin only)
  app.patch('/api/team/members/:id/role', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const memberId = req.params.id;
      const { role } = req.body || {};
      if (!role || !['admin', 'analyst', 'read_only'].includes(role)) {
        return res.status(400).json({ error: 'Valid role (admin, analyst, or read_only) is required.' });
      }

      const caller = (req as AuthenticatedRequest).user!;
      const orgId = caller.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }

      await updateOrgUser(orgId, memberId, { role: role as any });

      return res.json({
        status: 'success',
        message: `Team member role successfully updated to ${role}.`,
        memberId,
        role
      });
    } catch (err: any) {
      logger.error({ error: err?.message }, '[TeamAPI] Error updating member role');
      const status = err?.message?.includes('not found') ? 404 : 500;
      res.status(status).json({ error: err?.message || 'Failed to update member role' });
    }
  });

  // Revoke Team Member (Admin only)
  app.delete('/api/team/members/:id', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const memberId = req.params.id;
      const caller = (req as AuthenticatedRequest).user!;
      const orgId = caller.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }

      const deleted = await deleteOrgUser(orgId, memberId);
      if (!deleted) {
        return res.status(404).json({ error: 'Team member not found' });
      }

      return res.json({
        status: 'success',
        message: 'Team member revoked successfully.',
        memberId
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to revoke team member' });
    }
  });

  // Invite Team Member: expires in 72 hours, hashed token at rest, token never in response unless dev preview
  app.post('/api/team/invite', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const caller = (req as AuthenticatedRequest).user!;
    const { email, role, name } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const inviteRole = role || 'analyst';
    const inviteId = `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 72-hour expiry requirement
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const invitationObj = {
      id: inviteId,
      organization_id: caller.organizationId,
      name: name || email.split('@')[0],
      email: email.trim(),
      role: inviteRole,
      status: 'PENDING',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      invited_by: caller.email
    };

    memoryInvitations.unshift({
      ...invitationObj,
      token_hash: tokenHash
    });

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      Promise.resolve(
        supabase
          .from('team_invitations')
          .insert({
            id: inviteId,
            organization_id: caller.organizationId,
            email: email.trim(),
            role: inviteRole,
            token: tokenHash, // Store hashed token at rest
            expires_at: expiresAt,
            status: 'PENDING'
          })
      ).catch((err: any) => {
        logger.warn({ error: err?.message }, '[TeamAPI] Error inserting team_invitation to DB');
      });
    }

    const isDevPreview = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_PREVIEW === 'true';

    res.status(201).json({
      status: 'success',
      invitation: invitationObj,
      message: 'Invitation sent. Link is valid for 72 hours.',
      ...(isDevPreview ? { preview_invite_token: rawToken } : {})
    });
  });

  // Cancel / Revoke Invite
  app.delete('/api/team/invite/:id', authenticatedLimiter, requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const inviteId = req.params.id;
    const caller = (req as AuthenticatedRequest).user!;
    const memIdx = memoryInvitations.findIndex((i) => i.id === inviteId && i.organization_id === caller.organizationId);
    if (memIdx !== -1) {
      memoryInvitations.splice(memIdx, 1);
    } else {
      // Check if it exists in another org to return 404
      const foreignIdx = memoryInvitations.findIndex((i) => i.id === inviteId);
      if (foreignIdx !== -1) {
        return res.status(404).json({ error: 'Invitation not found' });
      }
    }

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      Promise.resolve(
        supabase.from('team_invitations').delete().eq('id', inviteId).eq('organization_id', caller.organizationId)
      ).catch(() => {});
    }

    res.json({ status: 'success', message: 'Invitation revoked.' });
  });
}
