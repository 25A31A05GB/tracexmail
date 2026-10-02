import { Sparkles, Info, ShieldAlert, Cpu } from 'lucide-react';
import { AINarrative } from '../types';

interface AICaseSummaryCardProps {
  aiNarrative?: AINarrative | null;
  ai_narrative?: AINarrative | null;
  socReport?: any | null;
  soc_report?: any | null;
}

export function AICaseSummaryCard({ aiNarrative, ai_narrative, socReport, soc_report }: AICaseSummaryCardProps) {
  const data = aiNarrative || ai_narrative;
  const report = socReport || soc_report;

  if (!data?.narrative && !report?.executiveSummary) {
    return null;
  }

  const executiveSummary = report?.executiveSummary || data?.narrative;
  const model = report?.metadata?.modelUsed || data?.model || 'Gemini 3.8 Flash';
  const confidence = report?.attributionHypothesis?.confidence;

  return (
    <div className="bg-[#1a1712] border border-[#3a352c] rounded-lg p-5 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#3a352c] pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#b23a2e]/20 border border-[#b23a2e]/40 flex items-center justify-center text-[#d97768] font-bold">
            <Sparkles className="w-4 h-4 text-[#d97768]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-200/90 uppercase tracking-wider font-mono">
                {report ? 'SOC Executive Threat Brief' : 'AI Case Summary'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-[#b23a2e]/20 text-[#ede6d8] border border-[#b23a2e]/40 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-amber-400" />
                {report ? 'SOC ANALYST SYNTHESIS' : 'FORENSIC AI NARRATIVE'}
              </span>
            </div>
            {model && (
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Model: <span className="text-amber-300">{model}</span>
                {confidence && (
                  <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-amber-950/80 border border-amber-500/40 text-amber-300">
                    Confidence: {confidence}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300">
          <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
          <span>AI-generated, analyst review required</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-[#ede6d8] leading-relaxed font-sans bg-[#14120f] p-4 rounded border border-[#3a352c] whitespace-pre-line">
        {executiveSummary}
      </div>

      {report?.attributionHypothesis?.hypothesisText && (
        <div className="mt-2.5 bg-slate-900/80 p-3 rounded border border-slate-700/60 text-xs text-slate-300 font-sans">
          <div className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider mb-1">
            Attribution Hypothesis ({report.attributionHypothesis.confidence}):
          </div>
          <p className="text-[11.5px] leading-relaxed text-slate-300">
            {report.attributionHypothesis.hypothesisText}
          </p>
          {report.attributionHypothesis.evidenceIds?.length > 0 && (
            <div className="mt-1 text-[10px] font-mono text-slate-400">
              Evidence Lineage IDs: <span className="text-blue-300">{report.attributionHypothesis.evidenceIds.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-start gap-1.5 text-[10px] text-slate-400 italic font-mono">
        <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
        <span>
          Attribution strictly assesses observed sending infrastructure without speculative identity assumptions.
        </span>
      </div>
    </div>
  );
}
