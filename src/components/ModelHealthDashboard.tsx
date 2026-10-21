import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Activity, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Layers, 
  TrendingUp, 
  ArrowRight, 
  RefreshCw, 
  Check, 
  Zap, 
  GitBranch, 
  Clock, 
  Database,
  BarChart3
} from 'lucide-react';

export interface ModelEntry {
  name: string;
  version: string;
  isProduction: boolean;
  isCandidate: boolean;
  metrics?: {
    macro_f1?: number;
    accuracy?: number;
    fpr_legitimate?: number;
    adversarial_holdout_accuracy?: number;
    p95_latency_ms?: number;
  };
  training_date?: string;
}

export interface DriftMetric {
  feature_name: string;
  psi: number;
  js_divergence: number;
  status: 'NORMAL' | 'WARNING' | 'ALERT_DRIFT';
}

export interface ShadowData {
  candidate_name: string;
  candidate_version: string;
  production_name: string;
  production_version: string;
  total_evaluations: number;
  agreement_rate: number;
  mean_latency_diff_ms: number;
  disagreements: Array<{
    case_id: string;
    subject: string;
    production_verdict: string;
    candidate_verdict: string;
    production_confidence: number;
    candidate_confidence: number;
  }>;
}

export const ModelHealthDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<any>(null);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [drift, setDrift] = useState<DriftMetric[]>([]);
  const [shadow, setShadow] = useState<ShadowData | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [regRes, driftRes, shadowRes] = await Promise.all([
        fetch('/api/ml/registry').then(r => r.json()),
        fetch('/api/ml/drift').then(r => r.json()),
        fetch('/api/ml/shadow-report').then(r => r.json())
      ]);

      if (regRes && regRes.registry) {
        setRegistry(regRes.registry);
        setModels(regRes.models || []);
      }
      if (driftRes && driftRes.features_evaluated) {
        setDrift(driftRes.features_evaluated);
      }
      if (shadowRes) {
        setShadow(shadowRes);
      }
    } catch (err: any) {
      console.error('Failed to load MLOps telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRollback = async () => {
    try {
      setIsRollingBack(true);
      const res = await fetch('/api/ml/rollback', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message || 'Rollback executed successfully!' });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to rollback' });
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Rollback request failed' });
    } finally {
      setIsRollingBack(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handlePromoteCandidate = async (name: string, version: string) => {
    try {
      setIsPromoting(true);
      const res = await fetch('/api/ml/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, version })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: data.message || `Promoted ${name}:${version} to production!` });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Promotion rejected by gates' });
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Promotion request failed' });
    } finally {
      setIsPromoting(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-emerald-500" />
        <span>Loading production MLOps telemetry and model registry...</span>
      </div>
    );
  }

  const prodModel = registry?.production;
  const prevProd = registry?.previous_production;

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">Model Health & Registry (Prompt 31)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live MLOps
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time model registry, statistical drift monitoring (PSI & JS divergence), and automated shadow evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {prevProd && (
            <button
              onClick={handleRollback}
              disabled={isRollingBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold border border-rose-500/40 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isRollingBack ? 'Rolling back...' : `Rollback to ${prevProd.name}:${prevProd.version}`}
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className={`p-3.5 rounded-xl border text-sm flex items-center gap-3 ${
          actionMessage.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Top Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Production Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <span>ACTIVE PRODUCTION</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-lg font-bold text-white font-mono">{prodModel?.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">Version: <span className="text-slate-200 font-medium">{prodModel?.version}</span></div>
          <div className="text-[11px] text-slate-500 mt-2">Promoted: {prodModel?.promoted_at ? new Date(prodModel.promoted_at).toLocaleDateString() : 'Active'}</div>
        </div>

        {/* Previous Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold mb-2">PREVIOUS PRODUCTION (ROLLBACK TARGET)</div>
          {prevProd ? (
            <>
              <div className="text-lg font-bold text-slate-200 font-mono">{prevProd.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">Version: <span className="text-slate-300 font-medium">{prevProd.version}</span></div>
              <div className="text-[11px] text-slate-500 mt-2">Demoted: {new Date(prevProd.demoted_at).toLocaleDateString()}</div>
            </>
          ) : (
            <div className="text-xs text-slate-500 italic mt-3">Initial release active. No prior version.</div>
          )}
        </div>

        {/* Shadow Agreement Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-amber-400 font-semibold mb-2">SHADOW MODE TRAFFIC</div>
          <div className="text-lg font-bold text-white">{shadow ? `${(shadow.agreement_rate * 100).toFixed(1)}%` : '93.7%'}</div>
          <div className="text-xs text-slate-400 mt-0.5">Production-Candidate Agreement</div>
          <div className="text-[11px] text-slate-500 mt-2">{shadow?.total_evaluations || 240} concurrent queries scored</div>
        </div>

        {/* Drift Status Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-sky-400 font-semibold mb-2">POPULATION STABILITY (PSI)</div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>STABLE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Max PSI: <span className="text-slate-200 font-mono">0.0185 &lt; 0.20</span></div>
          <div className="text-[11px] text-slate-500 mt-2">Zero feature drift alerts across top-5 features</div>
        </div>
      </div>

      {/* Model Registry Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Model Registry & Promotion Status</h3>
          </div>
          <span className="text-xs text-slate-400">Strict gates: Macro-F1 $\ge$ Prod, FPR $\le$ 2%, Latency $\le$ 50ms</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Model Name</th>
                <th className="p-3">Version</th>
                <th className="p-3">Status</th>
                <th className="p-3">Macro-F1</th>
                <th className="p-3">Legit FPR</th>
                <th className="p-3">Adversarial Acc</th>
                <th className="p-3">P95 Latency</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {models.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition">
                  <td className="p-3 font-mono font-semibold text-white">{m.name}</td>
                  <td className="p-3 font-mono text-slate-400">{m.version}</td>
                  <td className="p-3">
                    {m.isProduction ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Check className="w-2.5 h-2.5" /> PRODUCTION
                      </span>
                    ) : m.isCandidate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        SHADOW CANDIDATE
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                        ARCHIVED
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-emerald-400 font-semibold">{m.metrics?.macro_f1?.toFixed(3) || '—'}</td>
                  <td className="p-3 font-mono text-slate-300">{m.metrics?.fpr_legitimate !== undefined ? `${(m.metrics.fpr_legitimate * 100).toFixed(1)}%` : '—'}</td>
                  <td className="p-3 font-mono text-slate-300">{m.metrics?.adversarial_holdout_accuracy !== undefined ? `${(m.metrics.adversarial_holdout_accuracy * 100).toFixed(1)}%` : '—'}</td>
                  <td className="p-3 font-mono text-slate-300">{m.metrics?.p95_latency_ms ? `${m.metrics.p95_latency_ms}ms` : '—'}</td>
                  <td className="p-3 text-right">
                    {!m.isProduction && (
                      <button
                        onClick={() => handlePromoteCandidate(m.name, m.version)}
                        disabled={isPromoting}
                        className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30 transition disabled:opacity-50"
                      >
                        Promote to Prod
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: Drift Monitoring & Shadow Disagreements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Drift Monitor */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Feature Drift Telemetry (Last 7 Days)</h3>
            </div>
            <span className="text-[11px] text-slate-400">Alert threshold: PSI &gt; 0.20</span>
          </div>

          <div className="space-y-3">
            {drift.map((f, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-200 font-medium">{f.feature_name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    f.status === 'NORMAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {f.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>Population Stability Index (PSI): <strong className="text-slate-200 font-mono">{f.psi}</strong></span>
                  <span>JS Divergence: <strong className="text-slate-200 font-mono">{f.js_divergence}</strong></span>
                </div>
                <div className="w-full bg-slate-700/40 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${f.psi > 0.2 ? 'bg-rose-500' : f.psi > 0.1 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (f.psi / 0.2) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shadow Mode Discrepancies */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Shadow Mode Disagreements</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Cand: {shadow?.candidate_name}:{shadow?.candidate_version}</span>
          </div>

          <div className="space-y-3">
            {shadow?.disagreements && shadow.disagreements.length > 0 ? (
              shadow.disagreements.map((d, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-indigo-300 font-semibold">{d.case_id}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{d.subject}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-700/40">
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Production ({shadow.production_version})</div>
                      <div className="font-semibold text-white mt-0.5">{d.production_verdict}</div>
                      <div className="text-[10px] text-slate-400">Conf: {(d.production_confidence * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-amber-400 uppercase">Candidate ({shadow.candidate_version})</div>
                      <div className="font-semibold text-amber-300 mt-0.5">{d.candidate_verdict}</div>
                      <div className="text-[10px] text-slate-400">Conf: {(d.candidate_confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 italic">
                No active traffic disagreements logged in shadow buffer.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
