#!/usr/bin/env bash
set -e

target="${1:-help}"

case "$target" in
  data)
    echo "[+] Building clean, leak-free evaluation dataset (Prompt 25)..."
    bun scripts/ml/build_eval_dataset.ts
    ;;
  baselines)
    echo "[+] Running baseline models and benchmark harness (Prompt 26)..."
    bun scripts/ml/benchmark.ts
    ;;
  ablation)
    echo "[+] Executing layered pipeline ablation study (Prompt 27)..."
    bun scripts/ml/ablation.ts --offline
    ;;
  llm-eval)
    echo "[+] Evaluating LLM linguistic forensics and prompt injection defense (Prompt 28)..."
    bun scripts/ml/eval_llm.ts
    ;;
  finetune-smoke)
    echo "[+] Executing Transformer fine-tuning smoke run (Prompt 29)..."
    bun scripts/ml/finetune_transformer.ts
    ;;
  errors)
    echo "[+] Running error analysis, slice metrics, and explanation tests (Prompt 30)..."
    bun scripts/ml/error_analysis.ts
    ;;
  report)
    echo "[+] Assembling consolidated evaluation report..."
    mkdir -p reports
    echo "# TraceXMail Consolidated Pipeline Execution Summary" > reports/CONSOLIDATED_SUMMARY.md
    echo "Generated at: $(date -u)" >> reports/CONSOLIDATED_SUMMARY.md
    cat reports/BENCHMARK.md >> reports/CONSOLIDATED_SUMMARY.md
    echo -e "\n---\n" >> reports/CONSOLIDATED_SUMMARY.md
    cat reports/ABLATION.md >> reports/CONSOLIDATED_SUMMARY.md
    echo "[+] Consolidated report written to reports/CONSOLIDATED_SUMMARY.md"
    ;;
  all)
    "$0" data
    "$0" baselines
    "$0" ablation
    "$0" llm-eval
    "$0" finetune-smoke
    "$0" errors
    "$0" report
    echo "[✔] All evaluation pipelines completed successfully. Check reports/ directory."
    ;;
  *)
    echo "Usage: ./scripts/make.sh [data|baselines|ablation|llm-eval|finetune-smoke|errors|report|all]"
    ;;
esac
