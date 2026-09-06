import React, { useState } from 'react';
import { 
  Building2, 
  ShieldAlert, 
  Users, 
  Radio, 
  Check, 
  X, 
  Sparkles, 
  ArrowRight, 
  Lock,
  Loader2,
  KeyRound
} from 'lucide-react';

interface ModeUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (orgName: string) => Promise<void> | void;
  featureName?: string;
}

export function ModeUpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  featureName = 'Enterprise SOC Module'
}: ModeUpgradeModalProps) {
  const [orgName, setOrgName] = useState('Acme Cyber Defense SOC');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setLoading(true);
    try {
      await onUpgrade(orgName.trim());
      onClose();
    } catch (err) {
      console.error('Upgrade error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-[540px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden text-[var(--paper)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--line)] bg-[var(--ink)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-[rgba(201,162,39,0.15)] border border-[var(--stamp)] flex items-center justify-center text-[var(--stamp)]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display font-bold text-base text-[var(--paper)]">
                Switch to Organization Mode
              </div>
              <div className="text-[11px] font-mono text-[var(--stamp)] uppercase tracking-wider">
                Full Enterprise SOC Access
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-sm text-[var(--paper-dim)] hover:text-[var(--paper)] hover:bg-[var(--ink-2)] transition-colors cursor-pointer bg-transparent border-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-[2px] bg-[rgba(201,162,39,0.1)] border border-[rgba(201,162,39,0.3)] text-xs text-[var(--paper)] leading-relaxed flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 text-[var(--stamp)] mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--stamp)]">Restricted Feature: </span>
              <strong>{featureName}</strong> is an enterprise capability. You are currently in <strong>Individual Mode</strong> (Single Email Ingestion &amp; Forensic Analysis).
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--paper-dim)] uppercase tracking-wider font-mono">
              Features unlocked with Organization Mode:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] flex items-start gap-2">
                <Users className="w-3.5 h-3.5 text-[var(--slate)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[var(--paper)]">Employee Provisioning</div>
                  <div className="text-[10.5px] text-[var(--paper-dim)]">Create login IDs &amp; passwords for staff</div>
                </div>
              </div>

              <div className="p-2.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] flex items-start gap-2">
                <Radio className="w-3.5 h-3.5 text-[var(--forensic-green)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[var(--paper)]">Live SOC Alert Feeds</div>
                  <div className="text-[10.5px] text-[var(--paper-dim)]">Real-time threat alerts &amp; push sync</div>
                </div>
              </div>

              <div className="p-2.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] flex items-start gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-[var(--stamp)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[var(--paper)]">Threat Campaigns</div>
                  <div className="text-[10.5px] text-[var(--paper-dim)]">Track org-wide phishing waves</div>
                </div>
              </div>

              <div className="p-2.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] flex items-start gap-2">
                <KeyRound className="w-3.5 h-3.5 text-[var(--slate)] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[var(--paper)]">Gmail Push Watch</div>
                  <div className="text-[10.5px] text-[var(--paper-dim)]">Pub/Sub auto-interception</div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleConfirm} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="block text-xs text-[var(--paper-dim)] font-medium">
                Organization / Team Workspace Name
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Cyber SOC"
                className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--stamp)] focus:outline-hidden rounded-[2px] px-3 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-secondary text-xs px-3 py-2 cursor-pointer"
              >
                Keep Individual Mode
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Upgrading Workspace…</span>
                  </>
                ) : (
                  <>
                    <span>Switch to Organization Mode</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
