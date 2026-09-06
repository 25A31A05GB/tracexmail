import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  Lock,
  Download,
  Server,
  Key
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface OrganizationViewProps {
  organizationId: string;
}

export function OrganizationView({ organizationId }: OrganizationViewProps) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [runningRetention, setRunningRetention] = useState(false);
  const [retentionResult, setRetentionResult] = useState<any | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    setLogError(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25);

        if (!error && data && data.length > 0) {
          setAuditLogs(data);
          setLoadingLogs(false);
          return;
        }
      }

      const res = await apiClient.get('/compliance/audit-logs?limit=25');
      if (res.data?.entries) {
        setAuditLogs(res.data.entries);
      } else if (Array.isArray(res.data)) {
        setAuditLogs(res.data);
      }
    } catch (err: any) {
      console.warn('[OrganizationView] Audit log fetch failed:', err);
      setLogError(err.response?.data?.error || err.message || 'Failed to load audit logs.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRunRetention = async () => {
    if (!confirm('Run compliance retention cleanup? This will securely purge expired evidence items per policy.')) {
      return;
    }
    setRunningRetention(true);
    setRetentionResult(null);
    try {
      const res = await apiClient.post('/compliance/retention/run', {
        retention_days: 90,
        mode: 'anonymize'
      });
      setRetentionResult(res.data);
      fetchAuditLogs();
    } catch (err: any) {
      alert(`Retention execution error: ${err.response?.data?.error || err.message}`);
    } finally {
      setRunningRetention(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [organizationId]);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#0b0d12] text-[#e7ebf1] space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#232833] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#c9a227]" />
            <h2 className="font-serif font-semibold text-xl text-[#e7ebf1]">
              Organization &amp; Compliance Enclave
            </h2>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/40">
              ADMIN CLEARANCE REQUIRED
            </span>
          </div>
          <p className="text-xs text-[#7d8794] mt-1">
            Manage organization security parameters, NIST SP 800-86 retention policies, and verifiable audit records.
          </p>
        </div>

        <button
          onClick={handleRunRetention}
          disabled={runningRetention}
          className="flex items-center gap-2 bg-[#232833] hover:bg-[#2c3240] text-xs font-semibold px-3.5 py-2 rounded-lg text-[#e7ebf1] border border-[#3a4150] transition-colors cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5 text-[#c25a4a]" />
          <span>{runningRetention ? 'Purging Expired Items…' : 'Execute Retention Cleanup'}</span>
        </button>
      </div>

      {retentionResult && (
        <div className="p-4 rounded-lg bg-[#5fae82]/15 border border-[#5fae82]/40 text-xs text-[#86efac] space-y-1">
          <div className="font-semibold">Retention Execution Completed:</div>
          <div>Mode: {retentionResult.mode} | Retained Cutoff: {retentionResult.retention_cutoff_date}</div>
          <div>Purged Cases: {retentionResult.purged_cases_count} | Anonymized Evidence: {retentionResult.anonymized_evidence_count}</div>
        </div>
      )}

      {/* Organization Meta Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-4">
          <div className="text-[10.5px] font-mono text-[#4f5763] uppercase tracking-wider">Organization ID</div>
          <div className="font-mono text-sm text-[#5b8dd6] mt-1 truncate">{organizationId || 'org_acme_soc_01'}</div>
          <div className="text-[11px] text-[#7d8794] mt-2">Active Multi-Tenant Enclave</div>
        </div>

        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-4">
          <div className="text-[10.5px] font-mono text-[#4f5763] uppercase tracking-wider">Default Retention Policy</div>
          <div className="font-mono text-sm text-[#c9a227] mt-1">90 Days (NIST SP 800-86)</div>
          <div className="text-[11px] text-[#7d8794] mt-2">Automatic SHA-256 Chain-of-Custody Seal</div>
        </div>

        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-4">
          <div className="text-[10.5px] font-mono text-[#4f5763] uppercase tracking-wider">Security Architecture</div>
          <div className="font-mono text-sm text-[#5fae82] mt-1">Supabase Service-Role Auth</div>
          <div className="text-[11px] text-[#7d8794] mt-2">Encrypted At Rest &amp; Transit</div>
        </div>
      </div>

      {/* Immutable Audit Logs Table */}
      <div className="bg-[#12151c] border border-[#232833] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#232833] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#5b8dd6]" />
            <h3 className="font-semibold text-sm text-[#e7ebf1]">Immutable Compliance Audit Trail</h3>
          </div>
          <button
            onClick={fetchAuditLogs}
            disabled={loadingLogs}
            className="text-xs text-[#7d8794] hover:text-[#e7ebf1] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {logError && (
          <div className="p-4 text-xs text-[#c25a4a] bg-[#c25a4a]/10 border-b border-[#232833]">
            {logError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f1219] text-[#4f5763] font-mono uppercase text-[10.5px] border-b border-[#232833]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Operator</th>
                <th className="p-3">Resource</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1e27] text-[#7d8794]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#4f5763]">
                    {loadingLogs ? 'Loading verified audit logs…' : 'No recent audit events recorded.'}
                  </td>
                </tr>
              ) : (
                auditLogs.map((log: any, idx: number) => (
                  <tr key={log.id || idx} className="hover:bg-[#171b24]/50">
                    <td className="p-3 font-mono text-[#4f5763]">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                    </td>
                    <td className="p-3 font-mono text-[#e7ebf1]">{log.action || 'SECURITY_EVENT'}</td>
                    <td className="p-3 text-[#b9af9c]">{log.user_email || log.user_id || 'system'}</td>
                    <td className="p-3 font-mono text-[#5b8dd6]">{log.resource_type || 'case'}</td>
                    <td className="p-3">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#5fae82]/20 text-[#86efac]">
                        {log.status || 'SUCCESS'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
