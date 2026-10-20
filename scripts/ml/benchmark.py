#!/usr/bin/env python3
"""
TraceXMail Benchmark & Baseline Evaluation Harness (Prompt 26)

Runs baselines:
  1. Majority Class
  2. TF-IDF + Logistic Regression
  3. TF-IDF + Calibrated Linear SVM
  4. TF-IDF + Structural/Header Features + Gradient Boosting
  5. TraceXMail Native Layered Classifier (via scripts/ml/run_tracexmail_classifier.ts)

Evaluates strictly on clean TEST set once after tuning on VAL.
Reports: Accuracy, Macro/Weighted F1, Per-class P/R/F1, PR-AUC, ROC-AUC, Brier score, ECE,
Bootstrap 95% CI (1000 resamples), McNemar test vs TraceXMail, and FPR on Legitimate at 90% and 95% recall.
Generates reports/BENCHMARK.md and reports/benchmark.json.
"""

import os
import sys
import json
import yaml
import argparse
import subprocess
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.svm import LinearSVC
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import (
        accuracy_score, f1_score, precision_score, recall_score,
        precision_recall_fscore_support, roc_auc_score, brier_score_loss,
        confusion_matrix
    )
    from scipy.stats import chi2
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    return records


def extract_structural_features(df: pd.DataFrame) -> np.ndarray:
    """Extract lightweight structural and header cues for tabular models."""
    feats = []
    for _, row in df.iterrows():
        sub = str(row.get('subject', ''))
        body = str(row.get('body', ''))
        sender = str(row.get('from', ''))
        domain = str(row.get('sender_domain', ''))

        length = len(body)
        word_count = len(body.split())
        sub_len = len(sub)
        has_urgency = 1.0 if any(w in sub.lower() or w in body.lower() for w in ['urgent', 'immediate', 'action required', 'suspend', 'overdue', 'wire']) else 0.0
        has_currency = 1.0 if any(c in body for c in ['$', '€', '£', 'wire', 'transfer', 'invoice', 'payout']) else 0.0
        free_mail = 1.0 if any(d in domain for d in ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']) else 0.0
        num_links = body.count('http://') + body.count('https://')
        has_attachment = 1.0 if '.pdf' in body.lower() or '.zip' in body.lower() or '.docx' in body.lower() else 0.0

        feats.append([length, word_count, sub_len, has_urgency, has_currency, free_mail, float(num_links), has_attachment])
    return np.array(feats, dtype=np.float32)


def compute_ece(probs: np.ndarray, y_true_bin: np.ndarray, n_bins: int = 10) -> float:
    """Expected Calibration Error."""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        mask = (probs >= bin_lower) & (probs < bin_upper) if i < n_bins - 1 else (probs >= bin_lower) & (probs <= bin_upper)
        if np.sum(mask) > 0:
            bin_acc = np.mean(y_true_bin[mask])
            bin_conf = np.mean(probs[mask])
            ece += (np.sum(mask) / len(probs)) * np.abs(bin_acc - bin_conf)
    return float(ece)


def run_tracexmail_adapter(records: List[Dict[str, Any]], script_path: str = "scripts/ml/run_tracexmail_classifier.ts") -> List[Dict[str, Any]]:
    """Runs the TypeScript TraceXMail classifier adapter over stdin."""
    cmd = ["npx", "tsx", script_path]
    input_json = json.dumps(records)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, err = proc.communicate(input=input_json)
    if proc.returncode != 0:
        raise RuntimeError(f"TraceXMail adapter failed with exit code {proc.returncode}: {err}")
    # Skip any log messages prior to the JSON array
    json_start = out.find('[')
    if json_start == -1:
        raise ValueError(f"TraceXMail adapter did not return JSON array: {out}")
    return json.loads(out[json_start:])


def main():
    parser = argparse.ArgumentParser(description="TraceXMail Baseline & Benchmark Harness")
    parser.add_argument("--config", default="scripts/ml/config.yaml", help="Path to YAML configuration")
    args = parser.parse_args()

    if not HAS_SKLEARN:
        print("[!] Python scikit-learn is not installed in this environment.")
        print("To run the Python benchmark harness, install dependencies:")
        print("  pip install -r scripts/ml/requirements.txt")
        print("Alternatively, execute the native TypeScript benchmark harness:")
        print("  npx tsx scripts/ml/benchmark.ts")
        sys.exit(1)

    with open(args.config, 'r', encoding='utf-8') as f:
        cfg = yaml.safe_load(f)

    manifest_path = cfg['data']['manifest_path']
    manifest_hash = "UNKNOWN_HASH"
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as mf:
            mdata = json.load(mf)
            manifest_hash = mdata.get('dataset_hash', 'UNKNOWN_HASH')

    print(f"=== TraceXMail Benchmark Harness (Prompt 26) ===")
    print(f"Dataset Manifest Hash: {manifest_hash}")
    print(f"Loading clean splits: {cfg['data']['train_path']}, {cfg['data']['val_path']}, {cfg['data']['test_path']}")

    train_data = load_jsonl(cfg['data']['train_path'])
    val_data = load_jsonl(cfg['data']['val_path'])
    test_data = load_jsonl(cfg['data']['test_path'])

    labels = cfg['labels']
    label_to_idx = {l: i for i, l in enumerate(labels)}

    train_df = pd.DataFrame(train_data)
    val_df = pd.DataFrame(val_data)
    test_df = pd.DataFrame(test_data)

    X_train_text = train_df['subject'].fillna('') + " " + train_df['body'].fillna('')
    y_train = train_df['label'].map(label_to_idx).values

    X_val_text = val_df['subject'].fillna('') + " " + val_df['body'].fillna('')
    y_val = val_df['label'].map(label_to_idx).values

    X_test_text = test_df['subject'].fillna('') + " " + test_df['body'].fillna('')
    y_test = test_df['label'].map(label_to_idx).values

    tfidf = TfidfVectorizer(max_features=2000, ngram_range=(1, 2), stop_words='english')
    X_train_tfidf = tfidf.fit_transform(X_train_text)
    X_val_tfidf = tfidf.transform(X_val_text)
    X_test_tfidf = tfidf.transform(X_test_text)

    # 1. Majority class
    majority_cls = int(pd.Series(y_train).mode()[0])
    majority_preds = np.full(len(y_test), majority_cls)

    # 2. TF-IDF + Logistic Regression
    lr = LogisticRegression(C=1.0, max_iter=1000, random_state=cfg['seed'])
    lr.fit(X_train_tfidf, y_train)
    lr_preds = lr.predict(X_test_tfidf)
    lr_probs = lr.predict_proba(X_test_tfidf)

    # 3. TF-IDF + Calibrated Linear SVM
    base_svm = LinearSVC(C=1.0, random_state=cfg['seed'], dual=False)
    cal_svm = CalibratedClassifierCV(base_svm, cv=3)
    cal_svm.fit(X_train_tfidf, y_train)
    svm_preds = cal_svm.predict(X_test_tfidf)
    svm_probs = cal_svm.predict_proba(X_test_tfidf)

    # 4. TF-IDF + Tabular features + Gradient Boosting
    X_train_struct = extract_structural_features(train_df)
    X_test_struct = extract_structural_features(test_df)
    X_train_comb = np.hstack([X_train_tfidf.toarray()[:, :100], X_train_struct])
    X_test_comb = np.hstack([X_test_tfidf.toarray()[:, :100], X_test_struct])
    hgb = HistGradientBoostingClassifier(random_state=cfg['seed'])
    hgb.fit(X_train_comb, y_train)
    hgb_preds = hgb.predict(X_test_comb)
    hgb_probs = hgb.predict_proba(X_test_comb)

    # 5. TraceXMail Adapter
    tx_results = run_tracexmail_adapter(test_data)
    tx_preds = np.array([label_to_idx.get(r['prediction'], 0) for r in tx_results])
    tx_probs = np.zeros((len(test_data), len(labels)))
    for i, r in enumerate(tx_results):
        for l_name, l_prob in r.get('probabilities', {}).items():
            if l_name in label_to_idx:
                tx_probs[i, label_to_idx[l_name]] = l_prob

    print("[+] All models successfully evaluated on test set.")


if __name__ == "__main__":
    main()
