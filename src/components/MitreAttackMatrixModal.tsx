import React from 'react';
import { X, ExternalLink, ShieldAlert, Crosshair, CheckCircle2, ChevronRight } from 'lucide-react';
import { EmailAnalysis } from '../types';
import { mapMitreAttackTechniques, MitreTechnique } from '../utils/mitreMapping';

interface MitreAttackMatrixModalProps {
  analysis?: EmailAnalysis | null;
  onClose: () => void;
}

export function MitreAttackMatrixModal({ analysis, onClose }: MitreAttackMatrixModalProps) {
  const techniques = mapMitreAttackTechniques(analysis);

  const tactics = [
    { title: 'Initial Access', key: 'Initial Access' },
    { title: 'Defense Evasion', key: 'Defense Evasion' },
    { title: 'Credential Access', key: 'Credential Access' },
    { title: 'Resource Development', key: 'Resource Development' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#14110D] border border-[#3A3228] rounded-xl max-w-4xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2B241E] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-rose-950/50 border border-rose-800/50 flex items-center justify-center text-rose-400">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase tracking-wide flex items-center gap-2">
                <span>MITRE ATT&amp;CK® Enterprise Matrix Navigator</span>
                <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 text-[10px] border border-rose-800/50">
                  {techniques.length} Techniques Detected
                </span>
              </h3>
              <p className="text-[11px] text-[#9C9186]">
                Automated adversarial tactic and technique mapping aligned with MITRE ATT&amp;CK Framework v14.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#1D1712] text-[#9C9186] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-y-auto flex-1 pr-1 font-mono">
          {tactics.map((t) => {
            const matching = techniques.filter(tech => tech.tactic === t.key);
            return (
              <div key={t.key} className="bg-[#0E0B09] border border-[#2B241E] rounded-lg p-3 space-y-2.5 flex flex-col">
                <div className="border-b border-[#2B241E] pb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#D3A039] uppercase tracking-wider">{t.title}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1D1712] text-[#9C9186]">{matching.length}</span>
                </div>

                {matching.length === 0 ? (
                  <div className="text-[11px] text-[#9C9186]/50 italic p-3 text-center my-auto">
                    No active indicators in this tactic column.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matching.map((tech) => (
                      <div
                        key={tech.id}
                        className="p-2.5 rounded bg-[#17130F] border border-[#2B241E] hover:border-rose-700/60 transition-all space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold text-rose-400">{tech.id}</span>
                          <a
                            href={tech.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#9C9186] hover:text-[#D3A039] flex items-center gap-0.5 text-[10px]"
                          >
                            <span>Docs</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="text-xs font-semibold text-[#EDE6DC] font-sans">{tech.name}</div>
                        <p className="text-[10.5px] text-[#9C9186] font-sans leading-relaxed">{tech.description}</p>
                        <div className="p-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[10px] text-amber-300/90 font-mono">
                          🔍 {tech.detectedProof}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2B241E] pt-3 flex items-center justify-between text-[11px] text-[#9C9186] font-mono shrink-0">
          <span>Aligned with MITRE ATT&amp;CK® v14.1 Enterprise Matrix for Email Systems</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
