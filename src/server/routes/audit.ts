import express, { Request, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../compliance';
import { authenticatedLimiter } from '../rateLimiter';
import { verifyAuditChain, exportAuditLogsAsCsv, exportAuditLogsAsJson } from '../audit/immutableLog';

export function registerAuditRoutes(app: express.Express): void {
  // Verification endpoint: checks cryptographic hash chain integrity (Admin only)
  app.get('/api/audit/verify', authenticatedLimiter, requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
    }
    const result = verifyAuditChain(orgId);

    if (!result.valid) {
      return res.status(409).json({
        status: 'TAMPER_DETECTED',
        valid: false,
        details: result
      });
    }

    res.json({
      status: 'VERIFIED',
      valid: true,
      totalRecords: result.totalRecords,
      timestamp: new Date().toISOString()
    });
  });

  // Export audit logs (CSV or JSON) (Admin only)
  app.get('/api/audit/export', authenticatedLimiter, requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
    }
    const format = (req.query.format as string)?.toLowerCase() || 'json';

    if (format === 'csv') {
      const csv = exportAuditLogsAsCsv(orgId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_log_${orgId}_${Date.now()}.csv"`);
      return res.send(csv);
    }

    const json = exportAuditLogsAsJson(orgId);
    res.json({ count: json.length, records: json });
  });
}
