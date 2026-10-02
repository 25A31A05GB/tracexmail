import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  EyeOff, 
  Eye, 
  AlertTriangle, 
  Flag, 
  RefreshCw, 
  Star, 
  TrendingUp, 
  Check, 
  X, 
  Fingerprint, 
  MessageSquare,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { UserTestimonial } from '../types';

interface FeedbackModerationPanelProps {
  className?: string;
}

export function FeedbackModerationPanel({ className = '' }: FeedbackModerationPanelProps) {
  const [testimonials, setTestimonials] = useState<UserTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'FLAGGED' | 'HIDDEN' | 'APPROVED'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchModerationData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/testimonials?includeHidden=true');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.testimonials)) {
          setTestimonials(data.testimonials);
        }
      }
    } catch (err) {
      console.warn('[FeedbackModerationPanel] Error fetching testimonials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModerationData();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus?: 'approved' | 'hidden') => {
    const newStatus = currentStatus === 'hidden' ? 'approved' : 'hidden';
    try {
      setActionInProgress(id);
      const res = await fetch(`/api/testimonials/${id}/moderation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.testimonial) {
          setTestimonials(prev => prev.map(t => t.id === id ? data.testimonial : t));
          showToast(`Post ${newStatus === 'hidden' ? 'hidden from public view' : 'approved and set live'}`);
        }
      }
    } catch (err) {
      console.error('Failed to update moderation status:', err);
      showToast('Failed to update post status');
    } finally {
      setActionInProgress(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Stats
  const totalCount = testimonials.length;
  const flaggedCount = testimonials.filter(t => t.isReported).length;
  const hiddenCount = testimonials.filter(t => t.moderationStatus === 'hidden').length;
  const approvedCount = testimonials.filter(t => t.moderationStatus !== 'hidden').length;

  // Filtered List
  const filteredList = testimonials.filter(t => {
    if (filter === 'FLAGGED') return t.isReported;
    if (filter === 'HIDDEN') return t.moderationStatus === 'hidden';
    if (filter === 'APPROVED') return t.moderationStatus !== 'hidden';
    return true;
  });

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden text-left ${className}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-cyan-950 border-b border-cyan-700/60 px-4 py-2 text-xs font-mono text-cyan-200 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-cyan-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-950/70 border border-amber-600/60 flex items-center justify-center text-amber-400 shadow-sm">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Public Feedback &amp; Testimonials Moderation
              </h3>
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-[10px] font-mono text-amber-300 font-bold">
                ADMIN CONSOLE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review user-submitted field reviews, inspect flagged reports, and toggle live public visibility.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchModerationData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stats & Filter Bar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Metric Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            Total Posts: <strong className="text-white">{totalCount}</strong>
          </span>
          <span className={`px-2.5 py-1 rounded border flex items-center gap-1.5 ${
            flaggedCount > 0 
              ? 'bg-rose-950/70 border-rose-600/70 text-rose-300 font-bold animate-pulse' 
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <Flag className="w-3 h-3 text-rose-400" />
            <span>Reported / Flagged: <strong>{flaggedCount}</strong></span>
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            Hidden: <strong className="text-amber-400">{hiddenCount}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            Live: <strong className="text-emerald-400">{approvedCount}</strong>
          </span>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              filter === 'ALL' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilter('FLAGGED')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
              filter === 'FLAGGED' ? 'bg-rose-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flag className="w-3 h-3" />
            <span>Flagged ({flaggedCount})</span>
          </button>
          <button
            onClick={() => setFilter('HIDDEN')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              filter === 'HIDDEN' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hidden ({hiddenCount})
          </button>
          <button
            onClick={() => setFilter('APPROVED')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              filter === 'APPROVED' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live ({approvedCount})
          </button>
        </div>
      </div>

      {/* Submissions List */}
      <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto">
        {loading && totalCount === 0 && (
          <div className="p-8 text-center text-xs font-mono text-slate-400">
            Loading public submissions ledger...
          </div>
        )}

        {!loading && filteredList.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs font-semibold text-slate-300">No submissions matching filter</div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {filter === 'FLAGGED' 
                ? 'Great news! No inappropriate content has been reported by users.' 
                : 'No public testimonial entries currently found.'}
            </p>
          </div>
        )}

        {filteredList.map((item) => {
          const isHidden = item.moderationStatus === 'hidden';
          const isReported = Boolean(item.isReported);
          const formattedDate = new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={item.id}
              className={`p-4 transition-colors ${
                isReported ? 'bg-rose-950/20' : isHidden ? 'bg-slate-950/40 opacity-75' : 'bg-slate-900/40 hover:bg-slate-900'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Author & Telemetry Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-100 text-xs">{item.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.role}{item.organization ? ` · ${item.organization}` : ''}
                    </span>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < item.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Operational Impact Metric Highlight */}
                  {item.impactMetric && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-amber-600/40 text-[10.5px] font-mono text-amber-300">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span>{item.impactMetric}</span>
                    </div>
                  )}

                  {/* Feedback Text */}
                  <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    &quot;{item.feedback}&quot;
                  </p>

                  {/* Reporting Banner if flagged */}
                  {isReported && (
                    <div className="p-2 rounded bg-rose-950/80 border border-rose-700/80 text-[11px] font-mono text-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                          <span>Reported Content Warning</span>
                          {item.reportCount && item.reportCount > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-900 border border-rose-600 text-[9px] text-white">
                              {item.reportCount} reports
                            </span>
                          )}
                        </div>
                        <div className="text-rose-200 mt-0.5">
                          Reason: <span className="font-semibold text-white">{item.reportReason || 'Inappropriate content flagged by user'}</span>
                        </div>
                        {item.reportedAt && (
                          <div className="text-[10px] text-rose-300/80 mt-0.5">
                            Reported on: {new Date(item.reportedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 pt-1">
                    <span>ID: {item.id}</span>
                    <span>·</span>
                    <span>{formattedDate}</span>
                    <span>·</span>
                    <span className="truncate max-w-[140px]" title={`SHA-256 Digest: ${item.verificationDigest}`}>
                      Digest: {item.verificationDigest.slice(0, 10)}...
                    </span>
                  </div>
                </div>

                {/* Moderation Controls: Simple Toggle to Hide or Approve */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  {/* Interactive Toggle Switch */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isHidden ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {isHidden ? 'Hidden' : 'Approved (Live)'}
                    </span>
                    
                    {/* Accessible Simple Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!isHidden}
                      disabled={actionInProgress === item.id}
                      onClick={() => handleToggleStatus(item.id, item.moderationStatus)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        !isHidden ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                      } ${actionInProgress === item.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isHidden ? "Click to approve post and make live" : "Click to hide post from public view"}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          !isHidden ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Secondary Quick Action Button */}
                  <button
                    onClick={() => handleToggleStatus(item.id, item.moderationStatus)}
                    disabled={actionInProgress === item.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                      isHidden
                        ? 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 hover:text-white'
                        : 'bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 hover:text-white'
                    }`}
                    title={isHidden ? "Approve post and make it visible on the public landing page" : "Hide post from the public landing page"}
                  >
                    {actionInProgress === item.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isHidden ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Approve Post</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                        <span>Hide Post</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FeedbackModerationPanel;
