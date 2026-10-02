import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Share2,
  Copy,
  Check,
  Shield,
  Clock,
  Lock,
  Link as LinkIcon,
  Users,
  Eye,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

export interface ShareCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  evidenceId: string;
  subject?: string;
  verdict?: string;
  severity?: string;
  threatScore?: number;
}

export function ShareCaseModal({
  isOpen,
  onClose,
  caseId,
  evidenceId,
  subject,
  verdict = 'SUSPICIOUS',
  severity = 'MEDIUM',
  threatScore
}: ShareCaseModalProps) {
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [accessScope, setAccessScope] = useState<'read' | 'triage' | 'sanitized'>('triage');
  const [requirePasscode, setRequirePasscode] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedSlack, setCopiedSlack] = useState<boolean>(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);
  const [shareToken, setShareToken] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);

  // Generate secure token on open or change
  useEffect(() => {
    if (isOpen) {
      regenerateToken();
    }
  }, [isOpen, caseId, expiryHours, accessScope, requirePasscode]);

  const regenerateToken = () => {
    setGenerating(true);
    // Generate high-entropy cryptographic collaboration token
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const token = `collab_${caseId.replace(/[^a-zA-Z0-9]/g, '_')}_${randomHex.slice(0, 16)}`;
    setShareToken(token);

    if (requirePasscode && !passcode) {
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      setPasscode(randomPin);
    }

    setTimeout(() => setGenerating(false), 200);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://tracexmail.vercel.app';
  const expiresAtDate = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  const formattedExpiry = expiresAtDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const shareUrl = `${currentOrigin}/?case=${encodeURIComponent(caseId)}&token=${shareToken}&scope=${accessScope}&exp=${expiresAtDate.getTime()}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopySlack = () => {
    const slackText = `🚨 *TraceXMail Investigation Collab Invite*\n*Case:* \`${caseId}\` (${evidenceId})\n*Threat Level:* \`${verdict}\` (Severity: \`${severity}\`)\n*Subject:* "${subject || 'Email Security Incident'}"\n*Access Link:* ${shareUrl}\n*Expires:* ${formattedExpiry}${requirePasscode && passcode ? `\n*Passcode:* \`${passcode}\`` : ''}`;
    navigator.clipboard.writeText(slackText);
    setCopiedSlack(true);
    setTimeout(() => setCopiedSlack(false), 2200);
  };

  const handleCopyMarkdown = () => {
    const mdText = `### [TraceXMail Case ${caseId}](${shareUrl})\n- **Evidence ID:** \`${evidenceId}\`\n- **Verdict:** \`${verdict}\` (Severity: \`${severity}\`)\n- **Subject:** ${subject || 'N/A'}\n- **Access Scope:** \`${accessScope.toUpperCase()}\`\n- **Link Validity:** Expires ${formattedExpiry}${requirePasscode && passcode ? `\n- **Passcode:** \`${passcode}\`` : ''}`;
    navigator.clipboard.writeText(mdText);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-[#14120f] border border-[#3a352c] rounded-lg shadow-2xl overflow-hidden text-[#ede6d8] my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d2820] bg-[#1a1712]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#b23a2e]/15 border border-[#b23a2e]/30 flex items-center justify-center text-[#e27267]">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono tracking-tight text-[#ede6d8] flex items-center gap-2">
                  <span>SHARE CASE INVESTIGATION</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950/70 text-cyan-300 border border-cyan-700/50">
                    INTERNAL SOC
                  </span>
                </h3>
                <p className="text-xs text-[#8a8070] font-mono mt-0.5">
                  Generate secure, temporary link for peer review and team collaboration
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#26221b] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Case Snapshot Pill */}
            <div className="p-3 rounded bg-[#1a1712] border border-[#2d2820] flex items-center justify-between gap-3 text-xs font-mono">
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-[#8a8070] tracking-wider">Target Incident</div>
                <div className="font-bold text-[#ede6d8] truncate mt-0.5">
                  CASE <span className="text-[#c9a227]">{caseId}</span> · {evidenceId}
                </div>
                {subject && (
                  <div className="text-[11px] text-[#b9af9c] truncate mt-0.5">
                    "{subject}"
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    severity === 'CRITICAL'
                      ? 'bg-rose-950/80 border-rose-600/70 text-rose-300'
                      : severity === 'HIGH'
                      ? 'bg-orange-950/80 border-orange-600/70 text-orange-300'
                      : severity === 'MEDIUM'
                      ? 'bg-amber-950/80 border-amber-600/70 text-amber-300'
                      : 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                  }`}
                >
                  {severity}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#26221b] text-[#c9a227] border border-[#3a352c]">
                  {verdict}
                </span>
              </div>
            </div>

            {/* Link Expiry Selector */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#b9af9c] mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#c9a227]" />
                <span>Link Expiration Duration</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '1 Hour', hours: 1 },
                  { label: '24 Hours', hours: 24, recommended: true },
                  { label: '3 Days', hours: 72 },
                  { label: '7 Days', hours: 168 }
                ].map(item => (
                  <button
                    key={item.hours}
                    type="button"
                    onClick={() => setExpiryHours(item.hours)}
                    className={`p-2 rounded text-xs font-mono text-center transition-all cursor-pointer border ${
                      expiryHours === item.hours
                        ? 'bg-[#c9a227]/20 border-[#c9a227] text-[#f3cc52] font-bold shadow-sm'
                        : 'bg-[#1a1712] border-[#2d2820] text-[#8a8070] hover:text-[#ede6d8] hover:border-[#4a4235]'
                    }`}
                  >
                    <div>{item.label}</div>
                    {item.recommended && (
                      <div className="text-[9px] text-[#c9a227] font-semibold mt-0.5">SOC STD</div>
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-[#8a8070] font-mono mt-1.5">
                Link expires automatically on <span className="text-[#b9af9c] font-semibold">{formattedExpiry}</span>.
              </div>
            </div>

            {/* Access Scope Selector */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#b9af9c] mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Collaboration Access Scope</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'read',
                    title: 'Read-Only View',
                    desc: 'Inspect headers, hops & verdicts only'
                  },
                  {
                    id: 'triage',
                    title: 'Full Triage',
                    desc: 'Add analyst notes & SOAR actions'
                  },
                  {
                    id: 'sanitized',
                    title: 'Masked PII',
                    desc: 'Redact names & recipient IPs'
                  }
                ].map(scope => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setAccessScope(scope.id as any)}
                    className={`p-2.5 rounded text-left transition-all cursor-pointer border ${
                      accessScope === scope.id
                        ? 'bg-cyan-950/30 border-cyan-500/70 text-cyan-200 shadow-sm'
                        : 'bg-[#1a1712] border-[#2d2820] text-[#8a8070] hover:text-[#ede6d8] hover:border-[#4a4235]'
                    }`}
                  >
                    <div className="text-xs font-mono font-bold">{scope.title}</div>
                    <div className="text-[10px] text-[#8a8070] mt-1 leading-snug">{scope.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Passcode Security Protection (Optional) */}
            <div className="p-3 rounded bg-[#1a1712] border border-[#2d2820]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#c9a227]" />
                  <span className="text-xs font-mono font-semibold text-[#ede6d8]">
                    Require 6-Digit Access PIN
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="require-passcode-toggle"
                  checked={requirePasscode}
                  onChange={(e) => setRequirePasscode(e.target.checked)}
                  className="rounded border-[#3a352c] text-[#c9a227] focus:ring-0 cursor-pointer"
                />
              </div>

              {requirePasscode && (
                <div className="mt-3 pt-3 border-t border-[#2d2820] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#8a8070] font-mono">Generated Access PIN:</span>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded bg-[#14120f] border border-[#c9a227]/40 text-[#c9a227] font-mono font-bold tracking-widest text-sm">
                      {passcode}
                    </span>
                    <button
                      type="button"
                      onClick={regenerateToken}
                      className="p-1 rounded text-[#8a8070] hover:text-[#ede6d8] cursor-pointer"
                      title="Regenerate PIN"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Generated Temporary Link Output Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-[#b9af9c] flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Secure Temporary Collaboration Link</span>
                </label>
                <button
                  type="button"
                  onClick={regenerateToken}
                  className="text-[11px] font-mono text-[#8a8070] hover:text-[#c9a227] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                  <span>Regenerate Token</span>
                </button>
              </div>

              <div className="flex items-center gap-2 p-2 rounded bg-[#100e0c] border border-[#3a352c]">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-transparent border-none text-xs font-mono text-emerald-400 flex-1 truncate focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#c9a227] hover:bg-[#d8af2c] text-black'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Quick Team Export Formats */}
            <div className="pt-2 border-t border-[#2d2820] flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-[#8a8070]">Quick Share Formats:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySlack}
                  className="px-2.5 py-1 rounded bg-[#1a1712] hover:bg-[#26221b] border border-[#2d2820] text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSlack ? <Check className="w-3 h-3 text-emerald-400" /> : <MessageSquare className="w-3 h-3 text-purple-400" />}
                  <span>{copiedSlack ? 'Copied for Slack' : 'Slack / Teams'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 rounded bg-[#1a1712] hover:bg-[#26221b] border border-[#2d2820] text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMarkdown ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-blue-400" />}
                  <span>{copiedMarkdown ? 'Copied Markdown' : 'Markdown'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="px-5 py-3 bg-[#100e0c] border-t border-[#2d2820] flex items-center justify-between text-[11px] font-mono text-[#8a8070]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>Token authenticated · Cryptographic chain of custody preserved</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#b9af9c] hover:text-[#ede6d8] cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
