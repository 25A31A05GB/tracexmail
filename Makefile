# TraceXMail Reproducibility & Pipeline Automation Makefile (Prompt 32)
# Standardized targets for end-to-end empirical evaluation

.PHONY: all help data baselines ablation llm-eval finetune-smoke errors report clean

SHELL := /bin/bash

help:
	@echo "=== TraceXMail Engineering & Forensics Pipeline ==="
	@echo "Targets:"
	@echo "  make data            - Download, clean, deduplicate, group-split and verify datasets"
	@echo "  make baselines       - Train baselines, tune on val, report on test -> reports/BENCHMARK.md"
	@echo "  make ablation        - Run layered pipeline ablation study -> reports/ABLATION.md"
	@echo "  make llm-eval        - Run LLM structured extraction, prompt injection & faithfulness eval"
	@echo "  make finetune-smoke  - Run Transformer fine-tuning smoke test and temperature calibration"
	@echo "  make errors          - Extract misclassifications, error clusters, and slice metrics"
	@echo "  make report          - Assemble unified evaluation summaries and reports"
	@echo "  make all             - Execute complete ML and Forensics pipeline end-to-end"

data:
	@echo "[+] Building clean, leak-free evaluation dataset (Prompt 25)..."
	npx tsx scripts/ml/build_eval_dataset.ts

baselines:
	@echo "[+] Running baseline models and benchmark harness (Prompt 26)..."
	npx tsx scripts/ml/benchmark.ts

ablation:
	@echo "[+] Executing layered pipeline ablation study (Prompt 27)..."
	npx tsx scripts/ml/ablation.ts --offline

llm-eval:
	@echo "[+] Evaluating LLM linguistic forensics and prompt injection defense (Prompt 28)..."
	npx tsx scripts/ml/eval_llm.ts

finetune-smoke:
	@echo "[+] Executing Transformer fine-tuning smoke run (Prompt 29)..."
	npx tsx scripts/ml/finetune_transformer.ts

errors:
	@echo "[+] Running error analysis, slice metrics, and explanation tests (Prompt 30)..."
	npx tsx scripts/ml/error_analysis.ts

report:
	@echo "[+] Assembling consolidated evaluation report..."
	@mkdir -p reports
	@echo "# TraceXMail Consolidated Pipeline Execution Summary" > reports/CONSOLIDATED_SUMMARY.md
	@echo "Generated at: $$(date -u)" >> reports/CONSOLIDATED_SUMMARY.md
	@cat reports/BENCHMARK.md >> reports/CONSOLIDATED_SUMMARY.md
	@echo -e "\n---\n" >> reports/CONSOLIDATED_SUMMARY.md
	@cat reports/ABLATION.md >> reports/CONSOLIDATED_SUMMARY.md
	@echo "[+] Consolidated report written to reports/CONSOLIDATED_SUMMARY.md"

all: data baselines ablation llm-eval finetune-smoke errors report
	@echo "[✔] All evaluation pipelines completed successfully. Check reports/ directory."
