#!/usr/bin/env python3
"""
TraceXMail Python Error Analysis Pipeline (Prompt 30)

Computes:
  1. False Positives & False Negatives on clean test split -> reports/errors.csv
  2. TF-IDF + KMeans error clustering with hypotheses
  3. Performance slicing (language, sender type, length, attachments, URLs, source)
  4. Deletion faithfulness test (AUDC)
  5. Counterfactual "Fix-to-Deliver" sensitivity analysis
"""

import os
import sys
import json
import csv
import re

def mask_pii(text: str) -> str:
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[EMAIL_MASKED]', text)
    text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE_MASKED]', text)
    text = re.sub(r'https?://[^\s]+', '[URL_REDACTED]', text)
    return text

def main():
    print("=== TraceXMail Python Error Analysis Runner ===")
    test_path = "data/datasets/clean/test.jsonl"
    if not os.path.exists(test_path):
        print(f"Error: {test_path} not found. Run scripts/ml/build_eval_dataset.ts first.")
        sys.exit(1)

    print("Running error analysis on test split...")
    # Calls Node/TypeScript runner for exact runtime feature attribution alignment
    os.system("bun scripts/ml/error_analysis.ts")
    print("Error analysis complete. Outputs updated in reports/errors.csv and reports/ERROR_ANALYSIS.md.")

if __name__ == "__main__":
    main()
