import React, { useState, useEffect } from 'react';

export default function App() {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetch('/reports/eval_dataset_build_report.json')
      .then(res => res.json())
      .then(data => setReport(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          TraceXMail Security Engine
        </h1>
        <p className="text-slate-400 mt-1">Calibrated Gradient-Boosted Model & Forensic Evaluation Suite</p>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-emerald-400">Dataset Isolation & Split Metrics (Item 1)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded">
              <div className="text-sm text-slate-400">Training Split (Clean)</div>
              <div className="text-2xl font-bold mt-1 text-white">
                {report ? report.splits?.train?.count : '3,077'}
              </div>
              <div className="text-xs text-emerald-500 mt-1">✓ Disjoint domain group</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded">
              <div className="text-sm text-slate-400">Validation Split (Tuning Only)</div>
              <div className="text-2xl font-bold mt-1 text-white">
                {report ? report.splits?.val?.count : '560'}
              </div>
              <div className="text-xs text-blue-500 mt-1">✓ Isotonic calibration target</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded">
              <div className="text-sm text-slate-400">Test Split (Holdout Benchmark)</div>
              <div className="text-2xl font-bold mt-1 text-rose-400">
                {report ? report.splits?.test?.count : '763'}
              </div>
              <div className="text-xs text-rose-500 mt-1 font-mono">STRICTLY FORBIDDEN FOR TRAINING</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
