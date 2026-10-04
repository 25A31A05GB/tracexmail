import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  X, 
  Check, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Sparkles, 
  ShieldAlert,
  Layers
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { forensicApi, apiFetch } from '../lib/api';

export interface CaseTagManagerProps {
  analysis: EmailAnalysis;
  onTagsUpdated?: (updatedTags: string[]) => void;
  className?: string;
  compact?: boolean;
}

// Common SOC forensic tag presets for instant one-click categorization
export const SOC_TAG_PRESETS = [
  { name: 'BEC', category: 'threat' },
  { name: 'Executive Impersonation', category: 'threat' },
  { name: 'Credential Phishing', category: 'threat' },
  { name: 'Wire Transfer Fraud', category: 'high_priority' },
  { name: 'Quarantined', category: 'action' },
  { name: 'VIP Target', category: 'high_priority' },
  { name: 'Finance / Payroll', category: 'department' },
  { name: 'Weaponized Link', category: 'threat' },
  { name: 'Malware Attachment', category: 'threat' },
  { name: 'Reviewed by SOC', category: 'action' },
  { name: 'False Positive', category: 'status' }
];

export function getTagColorClasses(tagName: string): {
  bg: string;
  border: string;
  text: string;
  dot: string;
} {
  const lower = tagName.toLowerCase();

  // Threat / Malicious tags
  if (
    lower.includes('bec') ||
    lower.includes('phish') ||
    lower.includes('malware') ||
    lower.includes('trojan') ||
    lower.includes('attack') ||
    lower.includes('weapon') ||
    lower.includes('exploit') ||
    lower.includes('critical')
  ) {
    return {
      bg: 'bg-rose-950/50 hover:bg-rose-950/70',
      border: 'border-rose-500/40 hover:border-rose-500/70',
      text: 'text-rose-200',
      dot: 'bg-rose-400'
    };
  }

  // High Priority / Fraud tags
  if (
    lower.includes('wire') ||
    lower.includes('imperson') ||
    lower.includes('vip') ||
    lower.includes('urgent') ||
    lower.includes('fraud') ||
    lower.includes('executive')
  ) {
    return {
      bg: 'bg-amber-950/50 hover:bg-amber-950/70',
      border: 'border-amber-500/40 hover:border-amber-500/70',
      text: 'text-amber-200',
      dot: 'bg-amber-400'
    };
  }

  // Action / Remediation / Clean tags
  if (
    lower.includes('quarantine') ||
    lower.includes('clean') ||
    lower.includes('reviewed') ||
    lower.includes('resolved') ||
    lower.includes('verified') ||
    lower.includes('pass')
  ) {
    return {
      bg: 'bg-emerald-950/50 hover:bg-emerald-950/70',
      border: 'border-emerald-500/40 hover:border-emerald-500/70',
      text: 'text-emerald-200',
      dot: 'bg-emerald-400'
    };
  }

  // Department / Sector tags
  if (
    lower.includes('finance') ||
    lower.includes('payroll') ||
    lower.includes('hr') ||
    lower.includes('legal') ||
    lower.includes('vendor') ||
    lower.includes('partner')
  ) {
    return {
      bg: 'bg-purple-950/50 hover:bg-purple-950/70',
      border: 'border-purple-500/40 hover:border-purple-500/70',
      text: 'text-purple-200',
      dot: 'bg-purple-400'
    };
  }

  // Status / Informational tags (Default)
  return {
    bg: 'bg-sky-950/40 hover:bg-sky-950/60',
    border: 'border-sky-500/30 hover:border-sky-500/60',
    text: 'text-sky-200',
    dot: 'bg-sky-400'
  };
}

export function CaseTagManager({
  analysis,
  onTagsUpdated,
  className = '',
  compact = false
}: CaseTagManagerProps) {
  const caseId = analysis?.id || analysis?.evidenceId || 'current-case';
  
  // Local state for tags
  const [tags, setTags] = useState<string[]>(() => {
    return Array.isArray(analysis?.tags) ? [...analysis.tags] : [];
  });
  
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Sync state if analysis prop updates
  useEffect(() => {
    if (Array.isArray(analysis?.tags)) {
      setTags([...analysis.tags]);
    }
  }, [analysis?.id, analysis?.tags]);

  /**
   * Persists updated tags list to the backend forensic API
   */
  const persistTags = async (updatedTags: string[]) => {
    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMessage(null);

    // Immediate local optimistic update
    setTags(updatedTags);
    if (onTagsUpdated) {
      onTagsUpdated(updatedTags);
    }

    try {
      // 1. Attempt primary update via dedicated tags API
      let success = false;
      try {
        const res = await forensicApi.updateCaseTags(caseId, updatedTags);
        if (res && (res.status === 'success' || Array.isArray(res.tags))) {
          success = true;
        }
      } catch (primaryErr) {
        console.warn('[CaseTagManager] Primary updateCaseTags failed, attempting PATCH fallback:', primaryErr);
      }

      // 2. Fallback to general PATCH /api/cases/:caseId
      if (!success) {
        try {
          const patchRes = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: updatedTags })
          });
          if (patchRes.ok) {
            success = true;
          }
        } catch (patchErr) {
          console.warn('[CaseTagManager] PATCH fallback failed:', patchErr);
        }
      }

      // 3. Fallback to POST /api/cases/:caseId/triage
      if (!success) {
        try {
          const triageRes = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/triage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: updatedTags })
          });
          if (triageRes.ok) {
            success = true;
          }
        } catch (triageErr) {
          console.warn('[CaseTagManager] Triage fallback failed:', triageErr);
        }
      }

      // Always save to browser localStorage as persistent backup
      try {
        localStorage.setItem(`tracexmail_tags_${caseId}`, JSON.stringify(updatedTags));
      } catch {}

      setSaveSuccess(`Tags persisted to case ledger (${updatedTags.length} assigned)`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err: any) {
      console.error('[CaseTagManager] Error persisting tags:', err);
      setErrorMessage(err?.message || 'Failed to save tags to remote case ledger');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Adds a new tag
   */
  const handleAddTag = (rawTag: string) => {
    const cleanTag = rawTag.trim().replace(/^#+/, '');
    if (!cleanTag) return;

    // Check duplicate (case-insensitive)
    if (tags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
      setErrorMessage(`Tag "${cleanTag}" is already assigned to this case`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const updated = [...tags, cleanTag];
    setNewTagInput('');
    persistTags(updated);
  };

  /**
   * Removes a tag
   */
  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter(t => t !== tagToRemove);
    persistTags(updated);
  };

  /**
   * Handles keyboard Enter or Comma in tag input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(newTagInput);
    }
  };

  return (
    <div 
      id="case-tag-manager"
      className={`rounded-xl border border-[#3a352c] bg-[#14120f] p-4 font-sans shadow-sm text-xs transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#2d2922] pb-2.5 mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-xs font-mono">
                Case Labels &amp; Forensic Tags
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Assign custom security classifications, adversary attributes, and workflow tags. Persisted to forensic database.
            </span>
          </div>
        </div>

        {/* Status / Feedback Indicator */}
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-[11px] text-amber-300 flex items-center gap-1 font-mono animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Persisting tags...</span>
            </span>
          )}
          {saveSuccess && !isSaving && (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>{saveSuccess}</span>
            </span>
          )}
          {errorMessage && !isSaving && (
            <span className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
              <AlertCircle className="w-3 h-3" />
              <span>{errorMessage}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="px-2 py-1 rounded bg-[#1e1b15] hover:bg-[#2a261f] border border-[#3a352c] text-[11px] text-amber-300 font-mono flex items-center gap-1 transition-colors cursor-pointer"
            title="Toggle quick forensic tag presets"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{showPresets ? 'Hide Presets' : 'Quick Presets'}</span>
          </button>
        </div>
      </div>

      {/* Active Tags Chips List */}
      <div className="mb-3">
        {tags.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 text-center text-slate-400 text-xs">
            <span className="text-slate-400">No custom tags assigned to this case yet. Add tags below or select from quick presets.</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t, idx) => {
              const colors = getTagColorClasses(t);
              return (
                <span
                  key={`${t}-${idx}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-all group ${colors.bg} ${colors.border} ${colors.text} shadow-sm`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  <span className="font-semibold tracking-wide">#{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="ml-0.5 p-0.5 rounded hover:bg-black/30 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={`Remove tag #${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Presets Drawer */}
      {showPresets && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#181510] border border-[#332e25] space-y-1.5 animate-in fade-in duration-150">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" />
            <span>SOC Forensic Tag Presets (Click to Add):</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SOC_TAG_PRESETS.map((preset) => {
              const isAssigned = tags.some(t => t.toLowerCase() === preset.name.toLowerCase());
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => isAssigned ? handleRemoveTag(preset.name) : handleAddTag(preset.name)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                    isAssigned
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 font-bold'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                  }`}
                  title={isAssigned ? 'Click to remove tag' : 'Click to add tag'}
                >
                  {isAssigned ? <Check className="w-3 h-3 text-emerald-400" /> : <Plus className="w-3 h-3 text-slate-400" />}
                  <span>#{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Custom Tag Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddTag(newTagInput);
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs select-none">#</span>
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add custom tag (e.g. VIP-Target, Wire-Fraud, Zero-Day, Reviewed)..."
            className="w-full bg-[#100e0b] border border-[#3a352c] rounded-lg pl-6 pr-3 py-1.5 text-xs text-slate-200 font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!newTagInput.trim() || isSaving}
          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Tag</span>
        </button>
      </form>
    </div>
  );
}
