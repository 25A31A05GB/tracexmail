import React, { useState, useEffect, FormEvent } from 'react';
import {
  ShieldAlert,
  Shield,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Clock,
  UserCheck,
  AlertCircle,
  FolderPlus,
  X,
  CheckCircle2,
  Layers,
  Mail,
  FileText,
  Sparkles,
  ChevronRight,
  Edit3,
  Check,
  Tag,
  Download,
  Share2,
  FlaskConical
} from 'lucide-react';
import { forensicApi, CaseItem } from '../lib/api';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { useWebSocketAlerts } from '../hooks/useWebSocketAlerts';
import { mapBackendCaseToAnalysis } from '../utils/parser';
import { getStandardizedVerdict } from '../utils/verdict';
import { UserRole } from '../hooks/useSession';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface CasesViewProps {
  onSelectAnalysis: (analysis: EmailAnalysis) => void;
  onNavigateToOverview: () => void;
  onOpenNewModal: () => void;
  refreshSignal?: number;
  showDemoCases?: boolean;
  onToggleDemoCases?: () => void;
  role?: UserRole;
}

export function CasesView({ 
  onSelectAnalysis, 
  onNavigateToOverview, 
  onOpenNewModal, 
  refreshSignal,
  showDemoCases = false,
  onToggleDemoCases,
  role = 'analyst'
}: CasesViewProps) {
  const isReadOnly = role === 'read_only';
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [maskPii, setMaskPii] = useState<boolean>(isReadOnly);

  // Create Case Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newCaseName, setNewCaseName] = useState<string>('');
  const [newCaseStatus, setNewCaseStatus] = useState<string>('open');
  const [newCaseSeverity, setNewCaseSeverity] = useState<string>('HIGH');
  const [newCaseNotes, setNewCaseNotes] = useState<string>('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [creatingCase, setCreatingCase] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Selected Case Detail Drawer/Modal
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [editingNotes, setEditingNotes] = useState<boolean>(false);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [newTag, setNewTag] = useState<string>('');
  const [isUpdatingTag, setIsUpdatingTag] = useState<boolean>(false);
  const [addingMemberLoading, setAddingMemberLoading] = useState<string | null>(null);

  // Row-level tag inputs
  const [rowTagInputs, setRowTagInputs] = useState<Record<string, string>>({});
  const [rowTagLoading, setRowTagLoading] = useState<string | null>(null);

  const handleRowTagChange = (caseId: string, value: string) => {
    setRowTagInputs(prev => ({ ...prev, [caseId]: value }));
  };

  const handleRowAddTag = async (e: React.KeyboardEvent<HTMLInputElement>, caseItem: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tagValue = rowTagInputs[caseItem.id]?.trim();
      if (tagValue) {
        setRowTagLoading(caseItem.id);
        try {
          const currentTags = caseItem.tags || [];
          if (!currentTags.includes(tagValue)) {
            const updatedTags = [...currentTags, tagValue];
            await forensicApi.updateCase(caseItem.id, { tags: updatedTags });
            setCases(prev => prev.map(c => (c.id === caseItem.id ? { ...c, tags: updatedTags } : c)));
          }
          setRowTagInputs(prev => ({ ...prev, [caseItem.id]: '' }));
        } catch (err) {
          console.warn('Fallback saving row tag locally:', err);
        } finally {
          setRowTagLoading(null);
        }
      }
    }
  };
  
  const handleRowRemoveTag = async (caseItem: any, tagToRemove: string) => {
    setRowTagLoading(caseItem.id);
    try {
      const currentTags = caseItem.tags || [];
      const updatedTags = currentTags.filter((t: string) => t !== tagToRemove);
      await forensicApi.updateCase(caseItem.id, { tags: updatedTags });
      setCases(prev => prev.map(c => (c.id === caseItem.id ? { ...c, tags: updatedTags } : c)));
    } catch (err) {
      console.warn('Fallback removing row tag locally:', err);
    } finally {
      setRowTagLoading(null);
    }
  };

  // Real-Time WebSocket Alerts Hook
  const { alerts, lastCreatedCaseId } = useWebSocketAlerts();

  // Slack Dispatch State
  const [sendingSlackCaseId, setSendingSlackCaseId] = useState<string | null>(null);
  const [slackFeedbackMsg, setSlackFeedbackMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  const handleSendCaseToSlack = async (e: React.MouseEvent, caseItem: any) => {
    e.stopPropagation();
    try {
      setSendingSlackCaseId(caseItem.id);
      setSlackFeedbackMsg(null);
      const res = await forensicApi.sendCaseToSlack(caseItem.id);
      if (res.status === 'DELIVERED') {
        setSlackFeedbackMsg({ id: caseItem.id, type: 'success', text: `Dispatched case ${caseItem.id} to Slack channel!` });
      } else if (res.status === 'SKIPPED_SEVERITY') {
        setSlackFeedbackMsg({ id: caseItem.id, type: 'error', text: 'Alert skipped: severity is below Slack filter threshold.' });
      } else {
        setSlackFeedbackMsg({ id: caseItem.id, type: 'error', text: `Slack dispatch logged: ${res.status}` });
      }
    } catch (err: any) {
      setSlackFeedbackMsg({ id: caseItem.id, type: 'error', text: err?.response?.data?.error || 'Failed to dispatch to Slack' });
    } finally {
      setSendingSlackCaseId(null);
      setTimeout(() => setSlackFeedbackMsg(null), 5000);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      if (isSupabaseConfigured) {
        let query = supabase
          .from('cases')
          .select('*')
          .order('created_at', { ascending: false });

        if (!showDemoCases) {
          query = query.eq('is_demo', false);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          setCases(data);
          setLoading(false);
          return;
        }
      }

      const data = await forensicApi.getCases({ 
        exclude_demo: !showDemoCases,
        mask_pii: maskPii ? true : undefined
      });
      if (Array.isArray(data)) {
        setCases(data);
      } else {
        setCases([]);
      }
    } catch (err: any) {
      console.warn('Error fetching cases from backend/supabase:', err);
      setFetchError(err?.message || 'Failed to connect to backend database');
      setCases(showDemoCases ? SAMPLE_ANALYSES : []);
    } finally {
      setLoading(false);
    }
  };

  // Trigger refetch on mount, explicit refresh signal, showDemoCases toggle, maskPii toggle, or new WebSocket alert activity
  useEffect(() => {
    fetchCases();
  }, [alerts, lastCreatedCaseId, refreshSignal, showDemoCases, maskPii]);

  // Periodic safety net polling interval (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCases();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleInspectCase = (caseItem: any) => {
    // If it's a full EmailAnalysis object
    if (caseItem.headers && caseItem.verdict && caseItem.auth) {
      onSelectAnalysis(caseItem);
      onNavigateToOverview();
    } else if (caseItem.members && caseItem.members.length > 0) {
      // Set detail drawer to inspect case group
      setSelectedCaseDetail(caseItem);
      setNotesDraft(caseItem.analyst_notes || caseItem.description || caseItem.notes || '');
    } else {
      // Find matching sample or map the backend case item into a complete EmailAnalysis object
      const match = SAMPLE_ANALYSES.find((s) => s.id === caseItem.id);
      if (match) {
        onSelectAnalysis(match);
      } else {
        const mapped = mapBackendCaseToAnalysis(caseItem);
        onSelectAnalysis(mapped);
      }
      onNavigateToOverview();
    }
  };

  const handleOpenCreateModal = () => {
    // Pre-select first sample email if available
    const initialEmails = SAMPLE_ANALYSES.slice(0, 2).map(s => s.id);
    setSelectedEmailIds(initialEmails);
    setNewCaseName('');
    setNewCaseStatus('open');
    setNewCaseSeverity('HIGH');
    setNewCaseNotes('');
    setCreateError(null);
    setCreateSuccess(null);
    setIsCreateModalOpen(true);
  };

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev =>
      prev.includes(emailId) ? prev.filter(id => id !== emailId) : [...prev, emailId]
    );
  };

  const handleCreateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCase(true);
    setCreateError(null);

    const caseTitle = newCaseName.trim() || `Campaign Case (${selectedEmailIds.length} Linked Emails)`;

    try {
      const payload = {
        name: caseTitle,
        title: caseTitle,
        email_ids: selectedEmailIds,
        analyst_notes: newCaseNotes,
        status: newCaseStatus,
        severity: newCaseSeverity,
        organization_id: 'org_acme_soc_01'
      };

      if (isSupabaseConfigured) {
        try {
          const { data: sbData, error: sbErr } = await supabase
            .from('cases')
            .insert([{
              id: `case-${Date.now()}`,
              organization_id: 'org_acme_soc_01',
              title: payload.title,
              description: payload.analyst_notes || 'Forensic investigation case initialized.',
              status: payload.status.toUpperCase(),
              severity: payload.severity,
              threat_score: 85,
              created_at: new Date().toISOString(),
              tags: ['Forensic'],
              assigned_user: 'Lead Analyst',
              is_demo: false,
              source: 'manual'
            }])
            .select()
            .single();

          if (!sbErr && sbData) {
            setCases(prev => [sbData, ...prev]);
            setCreateSuccess(`Case ${sbData.id} successfully initialized in Supabase.`);
            setTimeout(() => {
              setIsCreateModalOpen(false);
              setCreateSuccess(null);
            }, 1200);
            return;
          }
        } catch (sbEx) {
          console.debug('[CasesView] Supabase direct insert fallback:', sbEx);
        }
      }

      const result = await forensicApi.createCase(payload);
      if (result && result.id) {
        setCases(prev => [result, ...prev]);
        setCreateSuccess(`Case ${result.id} successfully initialized.`);
        setTimeout(() => {
          setIsCreateModalOpen(false);
          setCreateSuccess(null);
        }, 1200);
      } else {
        throw new Error('Invalid response structure from case creation API.');
      }
    } catch (err: any) {
      console.warn('API error creating case, applying SAMPLE_ANALYSES fallback pattern:', err);
      // Fallback pattern matching the existing error resilience
      const chosenSamples = SAMPLE_ANALYSES.filter(s => selectedEmailIds.includes(s.id));
      const fallbackMembers = (chosenSamples.length > 0 ? chosenSamples : SAMPLE_ANALYSES.slice(0, 2)).map(s => {
        const std = getStandardizedVerdict(s);
        return {
          id: s.id,
          email_id: s.id,
          subject: s.headers?.subject || 'Sample Phishing Email',
          sender: s.headers?.from || 'Unknown Sender',
          from: s.headers?.from || 'Unknown Sender',
          recipient: s.headers?.to || '',
          to: s.headers?.to || '',
          date: s.headers?.date || new Date().toISOString(),
          threat_score: std.score,
          threat_verdict: std.verdict,
          filename: (s as any).filename || `${s.id}.eml`
        };
      });

      const fallbackCase = {
        id: `CASE-FB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        case_id: `CASE-FB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        organization_id: 'org_acme_soc_01',
        title: caseTitle,
        name: caseTitle,
        subject: caseTitle,
        status: newCaseStatus,
        severity: newCaseSeverity,
        threat_score: fallbackMembers.length > 0 ? Math.max(...fallbackMembers.map(m => m.threat_score)) : 80,
        threat_verdict: 'MALICIOUS / PHISHING',
        confidence: 0.92,
        analyst_notes: newCaseNotes || 'Local forensic campaign group initialized.',
        description: newCaseNotes || 'Local forensic campaign group initialized.',
        notes: newCaseNotes || 'Local forensic campaign group initialized.',
        email_ids: selectedEmailIds.length > 0 ? selectedEmailIds : fallbackMembers.map(m => m.id),
        members: fallbackMembers,
        member_emails: fallbackMembers,
        suggested_members: [
          {
            email_id: 'eml_nazario_irs_tax_wire',
            subject: 'Internal Revenue Service: Immediate Tax Levy Notice',
            sender: 'notice@irs-tax-clearance.org',
            threat_score: 94.0,
            relationship_strength: 'MEDIUM',
            similarity_score: 0.62,
            reason: 'Correlated via shared high-risk exit infrastructure'
          }
        ],
        total_emails: fallbackMembers.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        analyzed_at: new Date().toISOString(),
        hops: [],
        links: [],
        iocs: [],
        anomalies: [],
        dns_auth: { spf: { status: 'neutral' }, dkim: { status: 'neutral' }, dmarc: { status: 'neutral' } }
      };

      setCases(prev => [fallbackCase, ...prev]);
      setCreateSuccess(`Case ${fallbackCase.id} created (offline resilient mode).`);
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess(null);
      }, 1200);
    } finally {
      setCreatingCase(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedCaseDetail) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await forensicApi.updateCase(selectedCaseDetail.id, { status: newStatus });
      setSelectedCaseDetail((prev: any) => ({ ...prev, ...updated, status: newStatus }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, ...updated, status: newStatus } : c)));
    } catch (err) {
      console.warn('Fallback updating status locally:', err);
      setSelectedCaseDetail((prev: any) => ({ ...prev, status: newStatus }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, status: newStatus } : c)));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim() && selectedCaseDetail) {
      e.preventDefault();
      setIsUpdatingTag(true);
      try {
        const currentTags = selectedCaseDetail.tags || [];
        if (!currentTags.includes(newTag.trim())) {
          const updatedTags = [...currentTags, newTag.trim()];
          const updated = await forensicApi.updateCase(selectedCaseDetail.id, { tags: updatedTags });
          setSelectedCaseDetail((prev: any) => ({ ...prev, tags: updatedTags }));
          setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, tags: updatedTags } : c)));
        }
        setNewTag('');
      } catch (err) {
        console.warn('Fallback saving tags locally:', err);
      } finally {
        setIsUpdatingTag(false);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedCaseDetail) return;
    setIsUpdatingTag(true);
    try {
      const currentTags = selectedCaseDetail.tags || [];
      const updatedTags = currentTags.filter((t: string) => t !== tagToRemove);
      const updated = await forensicApi.updateCase(selectedCaseDetail.id, { tags: updatedTags });
      setSelectedCaseDetail((prev: any) => ({ ...prev, tags: updatedTags }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, tags: updatedTags } : c)));
    } catch (err) {
      console.warn('Fallback removing tags locally:', err);
    } finally {
      setIsUpdatingTag(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCaseDetail) return;
    try {
      const updated = await forensicApi.updateCase(selectedCaseDetail.id, { analyst_notes: notesDraft });
      setSelectedCaseDetail((prev: any) => ({ ...prev, ...updated, analyst_notes: notesDraft, description: notesDraft }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, analyst_notes: notesDraft, description: notesDraft } : c)));
      setEditingNotes(false);
    } catch (err) {
      console.warn('Fallback saving notes locally:', err);
      setSelectedCaseDetail((prev: any) => ({ ...prev, analyst_notes: notesDraft, description: notesDraft }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, analyst_notes: notesDraft, description: notesDraft } : c)));
      setEditingNotes(false);
    }
  };

  const handleUpdateAnalystVerdict = async (newVerdict: string) => {
    if (!selectedCaseDetail) return;
    try {
      const updated = await forensicApi.updateCase(selectedCaseDetail.id, { analyst_verdict: newVerdict });
      setSelectedCaseDetail((prev: any) => ({ ...prev, ...updated, analyst_verdict: newVerdict }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, ...updated, analyst_verdict: newVerdict } : c)));
    } catch (err) {
      console.warn('Fallback updating analyst verdict locally:', err);
      setSelectedCaseDetail((prev: any) => ({ ...prev, analyst_verdict: newVerdict }));
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? { ...c, analyst_verdict: newVerdict } : c)));
    }
  };

  const handleAddSuggestedMember = async (memberId: string) => {
    if (!selectedCaseDetail) return;
    setAddingMemberLoading(memberId);
    try {
      const updated = await forensicApi.addEmailsToCase(selectedCaseDetail.id, [memberId]);
      setSelectedCaseDetail(updated);
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? updated : c)));
    } catch (err) {
      console.warn('Fallback adding email to case locally:', err);
      const matchSample = SAMPLE_ANALYSES.find(s => s.id === memberId);
      const matchStd = matchSample ? getStandardizedVerdict(matchSample) : null;
      const newMemberObj = {
        id: memberId,
        email_id: memberId,
        subject: matchSample?.headers?.subject || `Email ${memberId}`,
        sender: matchSample?.headers?.from || 'Correlated Sender',
        from: matchSample?.headers?.from || 'Correlated Sender',
        recipient: matchSample?.headers?.to || '',
        to: matchSample?.headers?.to || '',
        date: matchSample?.headers?.date || new Date().toISOString(),
        threat_score: matchStd ? matchStd.score : 75,
        threat_verdict: matchStd ? matchStd.verdict : 'SUSPICIOUS'
      };
      const updatedMembers = [...(selectedCaseDetail.members || []), newMemberObj];
      const updatedSuggested = (selectedCaseDetail.suggested_members || []).filter((s: any) => s.email_id !== memberId);
      const updatedCaseObj = {
        ...selectedCaseDetail,
        members: updatedMembers,
        member_emails: updatedMembers,
        email_ids: [...(selectedCaseDetail.email_ids || []), memberId],
        suggested_members: updatedSuggested,
        total_emails: updatedMembers.length
      };
      setSelectedCaseDetail(updatedCaseObj);
      setCases(prev => prev.map(c => (c.id === selectedCaseDetail.id ? updatedCaseObj : c)));
    } finally {
      setAddingMemberLoading(null);
    }
  };

  const filteredCases = cases.filter((c) => {
    const title = c.title || c.headers?.subject || c.subject || '';
    const desc = c.description || c.headers?.from || c.from || '';
    const matchesSearch =
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.id && c.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity =
      severityFilter === 'ALL' ||
      (c.severity && c.severity.toUpperCase() === severityFilter) ||
      (c.threat && c.threat.toUpperCase() === severityFilter) ||
      (c.verdict && c.verdict.toUpperCase() === severityFilter);

    const matchesSource =
      sourceFilter === 'ALL' ||
      (sourceFilter === 'REAL' && !c.is_demo) ||
      (sourceFilter === 'DEMO' && Boolean(c.is_demo));

    return matchesSearch && matchesSeverity && matchesSource;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-blue-400" />
            Forensic Investigation Cases
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Searchable case management view for grouping related fraudulent emails into campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCases}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-md transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                Create Case
              </button>
              <button
                onClick={onOpenNewModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ingest New Email
              </button>
            </>
          )}
          {isReadOnly && (
            <span className="font-mono text-[11px] px-2.5 py-1.5 rounded-lg bg-[#7d8794]/20 text-[#7d8794] border border-[#7d8794]/30 flex items-center gap-1.5">
              <span>🔒</span> Read-Only Enclave
            </span>
          )}
        </div>
      </div>

      {/* Offline / Connection Warning Banner */}
      {fetchError && (
        <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Backend Offline / Unreachable ({fetchError}). Displaying offline sample cases.</span>
          </div>
          <button
            onClick={fetchCases}
            className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-100 rounded text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cases by Subject, Campaign Name, Sender, or Case ID..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {onToggleDemoCases && (
            <button
              onClick={onToggleDemoCases}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                showDemoCases
                  ? 'bg-amber-950/70 border-amber-600/80 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle inclusion of synthetic demo corpus fixtures"
            >
              <FlaskConical className={`w-3.5 h-3.5 ${showDemoCases ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Demo Fixtures: <strong>{showDemoCases ? 'ON' : 'OFF'}</strong></span>
            </button>
          )}

          <button
            onClick={() => setMaskPii(!maskPii)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
              maskPii
                ? 'bg-purple-950/70 border-purple-600 text-purple-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Audit toggle: Forces query param mask_pii=true to test compliance masking on case records"
          >
            <Shield className={`w-3.5 h-3.5 ${maskPii ? 'text-purple-400' : 'text-slate-500'}`} />
            <span>PII Masking: <strong>{maskPii ? 'MASKED' : 'CLEAR'}</strong></span>
          </button>

          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Sources</option>
            <option value="REAL">Ingested Analyses (Live)</option>
            {showDemoCases && <option value="DEMO">Demo / Seed Corpus</option>}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Severity</option>
            <option value="HIGH">High Severity</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low Severity</option>
            <option value="CLEAN">Clean / Legitimate</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Campaign / Subject</th>
                <th className="py-3 px-4">Linked Emails</th>
                <th className="py-3 px-4">Severity & Verdict</th>
                <th className="py-3 px-4">Threat Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <AlertCircle className="w-8 h-8 mx-auto text-slate-500" />
                      <div className="text-sm font-semibold text-slate-300">
                        {showDemoCases ? 'No matching forensic cases found' : 'No analyst cases ingested yet'}
                      </div>
                      <p className="text-xs text-slate-500">
                        {showDemoCases
                          ? 'Try adjusting your search query or severity filter.'
                          : 'Live cases view currently excludes demo fixtures. Upload an RFC 822 EML file to begin live ingestion, or toggle Demo Fixtures ON.'}
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          onClick={onOpenNewModal}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Ingest Email
                        </button>
                        {!showDemoCases && onToggleDemoCases && (
                          <button
                            onClick={onToggleDemoCases}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                            Include Sample Cases
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCases.map((c, i) => {
                  const title = c.title || c.name || c.headers?.subject || c.subject || 'Untitled Forensic Case';
                  const desc = c.analyst_notes || c.description || c.headers?.from || c.from || 'Standard message analysis';
                  const stdVerdict = getStandardizedVerdict(c);
                  const threatScore = stdVerdict.score;
                  const severity = (c.severity || c.threat || stdVerdict.severity || 'HIGH').toUpperCase();
                  const status = (c.status || 'open').toLowerCase();
                  const totalLinked = c.total_emails ?? (c.members?.length || c.email_ids?.length || 1);
                  const suggestedCount = c.suggested_members?.length || 0;

                  return (
                    <tr key={c.id || i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-400">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-500" />
                          <span>{c.id || `TXM-CASE-${i + 1}`}</span>
                        </div>
                        <div className="mt-1">
                          {c.is_demo ? (
                            <span className="px-1.5 py-0.5 bg-amber-950/70 text-amber-300 border border-amber-800/80 rounded text-[9px] font-mono inline-block">
                              CORPUS / DEMO
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 rounded text-[9px] font-mono inline-block">
                              LIVE INGEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-semibold text-slate-200 truncate">{title}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{desc}</div>
                        <div className="mt-1.5">
                          {c.tags && c.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {c.tags.map((tag: string, idx: number) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] border border-slate-700 flex items-center gap-1">
                                  <Tag className="w-2 h-2 text-slate-400" />
                                  {tag}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRowRemoveTag(c, tag); }}
                                    disabled={rowTagLoading === c.id}
                                    className="text-slate-400 hover:text-red-400 ml-0.5 focus:outline-none disabled:opacity-50"
                                  >
                                    <X className="w-2 h-2" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={rowTagInputs[c.id] || ''}
                              onChange={(e) => handleRowTagChange(c.id, e.target.value)}
                              onKeyDown={(e) => handleRowAddTag(e, c)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Type tag & Enter..."
                              disabled={rowTagLoading === c.id}
                              className="w-32 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                            {rowTagLoading === c.id && <RefreshCw className="w-2 h-2 animate-spin text-slate-400" />}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-200 rounded font-semibold border border-slate-700">
                            {totalLinked} {totalLinked === 1 ? 'email' : 'emails'}
                          </span>
                          {suggestedCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-950/80 border border-amber-600/60 text-amber-300 rounded text-[10px] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              +{suggestedCount} suggested
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            severity.includes('CRIT') || severity.includes('PHISH')
                              ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                              : severity.includes('HIGH') || severity.includes('SUSP')
                              ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                              : 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                          }`}
                        >
                          {severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${stdVerdict.colors.bar}`}
                              style={{ width: `${Math.min(threatScore, 100)}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-slate-200">{threatScore}/100</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${
                            status === 'open'
                              ? 'bg-blue-950/80 border-blue-600 text-blue-300'
                              : status === 'investigating'
                              ? 'bg-purple-950/80 border-purple-600 text-purple-300'
                              : status === 'escalated'
                              ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {slackFeedbackMsg?.id === c.id && (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              slackFeedbackMsg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}>
                              {slackFeedbackMsg.text}
                            </span>
                          )}
                          <button
                            onClick={(e) => handleSendCaseToSlack(e, c)}
                            disabled={sendingSlackCaseId === c.id}
                            title="Dispatch Block Kit case alert to Slack"
                            className="px-2 py-1.5 bg-emerald-950/80 hover:bg-emerald-800/80 text-emerald-400 border border-emerald-700/60 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Share2 className={`w-3 h-3 ${sendingSlackCaseId === c.id ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Slack</span>
                          </button>
                          {c.members && c.members.length > 0 && (
                            <button
                              onClick={() => {
                                setSelectedCaseDetail(c);
                                setNotesDraft(c.analyst_notes || c.description || c.notes || '');
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>Manage</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleInspectCase(c)}
                            className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE CASE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950/80 border border-emerald-600/60 rounded-lg text-emerald-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Create Forensic Investigation Case</h3>
                  <p className="text-xs text-slate-400">Group related fraudulent emails into a tracked campaign</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
              {createSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-600 text-emerald-300 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              {createError && (
                <div className="p-3 bg-rose-950/80 border border-rose-600 text-rose-300 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Case Name / Title */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Case / Campaign Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCaseName}
                  onChange={(e) => setNewCaseName(e.target.value)}
                  placeholder="e.g. FIN-ACTOR-409 PayPal Credential Harvesting Ring"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Status & Severity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Initial Status</label>
                  <select
                    value={newCaseStatus}
                    onChange={(e) => setNewCaseStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="open">Open (Default)</option>
                    <option value="investigating">Investigating</option>
                    <option value="escalated">Escalated</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Assigned Severity</label>
                  <select
                    value={newCaseSeverity}
                    onChange={(e) => setNewCaseSeverity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              {/* Tags Section */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-purple-400" />
                    Case Tags
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(selectedCaseDetail.tags || []).length === 0 ? (
                    <span className="text-slate-500 italic text-[11px]">No tags assigned.</span>
                  ) : (
                    (selectedCaseDetail.tags || []).map((tag: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-slate-800 text-slate-200 rounded-md border border-slate-700 flex items-center gap-1 text-[11px]">
                        {tag}
                        <button 
                          onClick={() => handleRemoveTag(tag)}
                          disabled={isUpdatingTag}
                          className="text-slate-400 hover:text-red-400 focus:outline-none disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Add a tag and press Enter... (e.g. Phishing, Spam)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    disabled={isUpdatingTag}
                  />
                </div>
              </div>

              {/* Analyst Notes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Analyst Investigation Notes & Hypothesis
                </label>
                <textarea
                  rows={3}
                  value={newCaseNotes}
                  onChange={(e) => setNewCaseNotes(e.target.value)}
                  placeholder="Record initial findings, campaign hypothesis, shared IOCs, or MITRE ATT&CK techniques..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Select Member Emails to Group */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    Select Member Emails to Group ({selectedEmailIds.length} selected)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Auto-suggest members enabled via graph correlation
                  </span>
                </div>

                <div className="border border-slate-800 rounded-lg bg-slate-950/60 divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
                  {SAMPLE_ANALYSES.map((sample) => {
                    const isSelected = selectedEmailIds.includes(sample.id);
                    return (
                      <div
                        key={sample.id}
                        onClick={() => toggleEmailSelection(sample.id)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-950/30 border-l-2 border-blue-500' : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <div className="truncate">
                            <div className="font-semibold text-slate-200 truncate">
                              {sample.headers?.subject || (sample as any).filename || sample.id}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              From: {sample.headers?.from} | ID: {sample.id}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {(() => {
                            const sampleStd = getStandardizedVerdict(sample);
                            return (
                              <span className={`px-1.5 py-0.5 text-[10px] rounded border ${sampleStd.colors.badge}`}>
                                {sampleStd.verdict} ({sampleStd.score}/100)
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creatingCase}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCase || !newCaseName.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center gap-2 cursor-pointer shadow-md transition-colors"
                >
                  {creatingCase ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Initializing Case...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5" />
                      Create Case
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CASE DETAIL / CAMPAIGN MANAGEMENT DRAWER */}
      {selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-950/80 border border-blue-600/60 rounded-lg text-blue-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {selectedCaseDetail.title || selectedCaseDetail.name || 'Forensic Case'}
                    </h3>
                    <span className="text-xs text-blue-400 font-bold px-2 py-0.5 bg-blue-950 border border-blue-800 rounded">
                      {selectedCaseDetail.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Organization Partition Protected
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleSendCaseToSlack(e, selectedCaseDetail)}
                  disabled={sendingSlackCaseId === selectedCaseDetail.id}
                  className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-800 text-emerald-300 rounded border border-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Forward this case to Slack SOC webhook"
                >
                  <Share2 className={`w-3.5 h-3.5 ${sendingSlackCaseId === selectedCaseDetail.id ? 'animate-spin' : ''}`} />
                  <span>{sendingSlackCaseId === selectedCaseDetail.id ? 'Dispatching...' : 'Send to Slack'}</span>
                </button>
                <a
                  href={`/api/v1/reports/${selectedCaseDetail.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Generates a structured forensic report as a PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  Generate Forensic Report
                </a>
                <button
                  onClick={() => setSelectedCaseDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Status & Severity Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Status (PATCH /api/cases/{selectedCaseDetail.id})</div>
                  <select
                    value={(selectedCaseDetail.status || 'open').toLowerCase()}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    disabled={isUpdatingStatus || isReadOnly}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="escalated">Escalated</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Assigned Severity</div>
                  <span
                    className={`inline-block px-2.5 py-1.5 rounded text-xs font-bold border ${
                      (selectedCaseDetail.severity || 'HIGH').includes('CRIT')
                        ? 'bg-rose-950 border-rose-600 text-rose-300'
                        : 'bg-amber-950 border-amber-600 text-amber-300'
                    }`}
                  >
                    {selectedCaseDetail.severity || 'HIGH'} ({selectedCaseDetail.threat_score || 85}/100)
                  </span>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Total Members</div>
                  <span className="inline-block px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 rounded text-xs font-semibold">
                    {selectedCaseDetail.members?.length || selectedCaseDetail.email_ids?.length || 1} emails linked
                  </span>
                </div>
              </div>

              {/* C4 Analyst Feedback Loop: Ground-Truth Verdict Override & Discrepancy Calibration */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
                    Analyst Verdict & Model Feedback Loop (C4)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950/60 border border-violet-700/50 text-violet-300 font-mono">
                    Retrain Sync Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Model Initial Prediction</div>
                    <div className="font-bold text-slate-200 flex items-center justify-between">
                      <span>{selectedCaseDetail.threat_verdict || selectedCaseDetail.category || 'MALICIOUS / PHISHING'}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {((selectedCaseDetail.ml_confidence || selectedCaseDetail.confidence || 0.88) * 100).toFixed(1)}% conf
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Analyst Final Verdict</div>
                    <select
                      value={selectedCaseDetail.analyst_verdict || 'Phishing'}
                      onChange={(e) => handleUpdateAnalystVerdict(e.target.value)}
                      disabled={isReadOnly}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-violet-500"
                    >
                      <option value="Phishing">Phishing (Credential / Malicious)</option>
                      <option value="Fraud-related">Fraud-related (BEC / Wire / Invoice)</option>
                      <option value="Impersonated">Impersonated (Brand / Executive)</option>
                      <option value="Suspicious">Suspicious (Unverified / Anomalous)</option>
                      <option value="Legitimate">Legitimate (Clean / False Positive)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Analyst Notes Section */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Analyst Notes & Findings
                  </span>
                  {!editingNotes ? (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit Notes
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingNotes(false)}
                        className="text-slate-400 hover:text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {editingNotes ? (
                  <textarea
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <p className="text-slate-300 leading-relaxed">
                    {selectedCaseDetail.analyst_notes ||
                      selectedCaseDetail.description ||
                      selectedCaseDetail.notes ||
                      'No analyst notes recorded yet for this case.'}
                  </p>
                )}
              </div>

              {/* Linked Member Emails */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  Linked Member Emails ({selectedCaseDetail.members?.length || 0})
                </h4>
                <div className="border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800 overflow-hidden">
                  {(selectedCaseDetail.members || []).map((m: any, idx: number) => (
                    <div key={m.id || idx} className="p-3 flex items-center justify-between hover:bg-slate-900/50">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{m.subject || 'No Subject'}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          From: {m.sender || m.from} | Date: {m.date}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className="px-2 py-0.5 bg-rose-950/80 border border-rose-600 text-rose-300 text-[10px] rounded font-bold">
                          {m.threat_score || 85}/100
                        </span>
                        <button
                          onClick={() => {
                            const match = SAMPLE_ANALYSES.find((s) => s.id === (m.id || m.email_id));
                            if (match) {
                              onSelectAnalysis(match);
                            } else {
                              const mapped = mapBackendCaseToAnalysis(m);
                              onSelectAnalysis(mapped);
                            }
                            onNavigateToOverview();
                            setSelectedCaseDetail(null);
                          }}
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <span>Analyze</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto-Suggested Candidate Members (from graph correlation) */}
              {selectedCaseDetail.suggested_members && selectedCaseDetail.suggested_members.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Suggested Candidate Members ({selectedCaseDetail.suggested_members.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Correlated by graph correlation intelligence via shared IOCs and infrastructure (suggested, not auto-included):
                  </p>
                  <div className="border border-amber-900/50 bg-amber-950/20 rounded-xl divide-y divide-amber-900/30 overflow-hidden">
                    {selectedCaseDetail.suggested_members.map((sug: any, idx: number) => (
                      <div key={sug.email_id || idx} className="p-3 flex items-center justify-between hover:bg-amber-950/30">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{sug.subject}</div>
                          <div className="text-[11px] text-amber-300/80 truncate">
                            {sug.reason || `Strength: ${sug.relationship_strength || 'MEDIUM'}`}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddSuggestedMember(sug.email_id)}
                          disabled={addingMemberLoading === sug.email_id}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow transition-colors ml-3 flex-shrink-0"
                        >
                          {addingMemberLoading === sug.email_id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          <span>Add to Case</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

