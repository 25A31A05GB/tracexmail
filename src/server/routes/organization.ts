import express, { Request, Response } from 'express';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../compliance';
import {
  getOrgUsers,
  findOrgUser,
  createOrgUser,
  bulkCreateOrgUsers,
  updateOrgUser,
  resetOrgUserPassword,
  deleteOrgUser,
  resendOrgUserNotification,
  DEFAULT_PERMISSIONS_BY_ROLE
} from '../orgUserStore';
import { getSupabaseClient, DEFAULT_ORG_ID } from '../supabase';
import { logger } from '../logger';

export function registerOrganizationRoutes(app: express.Express): void {
  // Get Organization Users (requireAuth)
  app.get('/api/organization/users', authenticatedLimiter, requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const users = getOrgUsers(user.organizationId);
    res.json(users);
  });

  // Create User (RBAC: admin)
  app.post(
    ['/api/organization/users/create', '/api/organization/users'],
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const user = (req as AuthenticatedRequest).user!;
      const { name, email, role, permissions, sendNotification } = req.body || {};

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      const created = await createOrgUser({
        organizationId: user.organizationId,
        organizationName: 'Enterprise Security SOC',
        name,
        email,
        role: role || 'analyst',
        permissions: permissions || DEFAULT_PERMISSIONS_BY_ROLE[role || 'analyst'],
        createdBy: user.email,
        sendNotification: Boolean(sendNotification)
      });

      res.status(201).json(created);
    }
  );

  // Bulk Create Users (RBAC: admin)
  app.post(
    '/api/organization/users/bulk',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const user = (req as AuthenticatedRequest).user!;
      const { users: userList } = req.body || {};

      if (!Array.isArray(userList)) {
        return res.status(400).json({ error: 'users array is required' });
      }

      const results = await bulkCreateOrgUsers(
        user.organizationId,
        'Enterprise Security SOC',
        userList,
        user.email
      );

      res.status(201).json(results);
    }
  );

  // Resend Invite (RBAC: admin)
  app.post(
    '/api/organization/users/:id/resend-invite',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId || DEFAULT_ORG_ID;
      try {
        const result = await resendOrgUserNotification(orgId, id);
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to resend invite' });
      }
    }
  );

  // Update User (RBAC: admin)
  app.patch(
    '/api/organization/users/:id',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId || DEFAULT_ORG_ID;
      try {
        const updated = await updateOrgUser(orgId, id, req.body);
        if (!updated) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json(updated);
      } catch (err: any) {
        res.status(404).json({ error: err.message || 'User not found' });
      }
    }
  );

  // Reset User Password (RBAC: admin)
  app.post(
    '/api/organization/users/:id/reset-password',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId || DEFAULT_ORG_ID;
      try {
        const result = await resetOrgUserPassword(orgId, id);
        if (!result || !result.user) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, ...result });
      } catch (err: any) {
        res.status(404).json({ error: err.message || 'User not found' });
      }
    }
  );

  // Delete User (RBAC: admin)
  app.delete(
    '/api/organization/users/:id',
    authenticatedLimiter,
    requireAuth,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId || DEFAULT_ORG_ID;
      const deleted = await deleteOrgUser(orgId, id);
      if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ status: 'success', message: 'User deleted' });
    }
  );

  // RBAC Matrix Info
  app.get('/api/organization/rbac-matrix', publicLimiter, (_req: Request, res: Response) => {
    res.json({
      roles: {
        admin: {
          name: 'Security Administrator',
          permissions: DEFAULT_PERMISSIONS_BY_ROLE['admin'],
          description: 'Full administrative access across users, integrations, and compliance retention.'
        },
        analyst: {
          name: 'Security Analyst',
          permissions: DEFAULT_PERMISSIONS_BY_ROLE['analyst'],
          description: 'Investigate cases, tag evidence, triage incidents, release/delete quarantined emails.'
        },
        read_only: {
          name: 'Compliance Auditor',
          permissions: DEFAULT_PERMISSIONS_BY_ROLE['read_only'],
          description: 'Inspect cases, audit logs, and chain-of-custody proofs with automatic PII masking.'
        }
      }
    });
  });

  // Privacy Config
  app.get('/api/organization/privacy-config', publicLimiter, (_req: Request, res: Response) => {
    res.json({
      pii_masking_default: true,
      retention_period_days: 90,
      data_anonymization: 'SHA-256 pseudonymization',
      gdpr_compliant: true
    });
  });

  app.post('/api/organization/privacy-config', authenticatedLimiter, requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
    res.json({ status: 'updated', config: req.body });
  });
}
