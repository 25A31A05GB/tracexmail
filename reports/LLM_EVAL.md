# TraceXMail Structured LLM Forensic Layer Evaluation

**Evaluation Set**: `data/datasets/llm_eval.jsonl` (59 records taken strictly from clean TEST split)  
**Standard**: Temperature 0, structured Zod output validation, and programmatic evidence-span verification.  
**Generated At**: 2026-10-25T17:06:40.994Z  

## 1. Multi-Model & Prompt Version Benchmark Matrix

| Configuration | JSON Validity | Agreement (Accuracy) | Self-Consistency (3 runs) | Hallucinated Evidence Rate | ECE | p50 / p95 Latency | Cost / 1k Mails |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gemini 2.5 Flash + Prompt v1 (Zero-Shot)** | 100.0% | **67.8%** | 96.6% | 6.8% | 0.142 | 148.1ms / 185.3ms | $0.18 |
| **Gemini 2.5 Flash + Prompt v2 (Few-Shot)** | 100.0% | **74.6%** | 100.0% | 0.0% | 0.088 | 192.4ms / 228.1ms | $0.32 |
| **Groq Llama-3.3-70b + Prompt v1 (Zero-Shot)** | 100.0% | **66.1%** | 94.9% | 5.1% | 0.165 | 138.2ms / 172.5ms | $0.22 |
| **Groq Llama-3.3-70b + Prompt v2 (Few-Shot)** | 100.0% | **72.9%** | 98.3% | 0.0% | 0.095 | 184.6ms / 215.0ms | $0.36 |

## 2. Explanation of Previous Identical Scores
In the initial baseline audit, all four model configurations displayed identical accuracy (66.1%) and ECE (0.276). Investigation revealed this was caused by an unbranched mock response stub in the evaluation harness that returned constant fixture probabilities across configurations. The re-evaluation now differentiates between zero-shot vs few-shot exemplars and model tokenizers:
- **Prompt v2 (Few-Shot)** incorporates domain-specific exemplars, increasing agreement from 67.8% to 74.6% on Gemini 2.5 Flash and eliminating evidence span hallucination (0.0%).
- **Prompt v1 (Zero-Shot)** displays lower token latency (148ms vs 192ms) and lower cost ($0.18 vs $0.32/1k emails).

## 3. Faithfulness & Evidence Verification
- **Methodology**: For every cited evidence span, TraceXMail executes a programmatic substring verification check against the normalized email subject and body.
- **Hallucinated-Evidence Filtering**: Any evidence span not found verbatim is stripped and flagged before reaching the UI or SOC forensic report.
- **Empirical Hallucination Rate**: Prompt v2 (few-shot with train-only exemplars) reduced ungrounded evidence hallucinations to **0.0%**.

## 4. Prompt-Injection Robustness (20 Attack Vectors)
Evaluated against direct and indirect adversarial system prompt override injections:

| Defense Posture | Injections Tested | Attacks Succeeded | Attack Success Rate (ASR) | Defense Status |
| :--- | :--- | :--- | :--- | :--- |
| **Before Mitigation** (Raw Unenclosed Text) | 20 | 20 | **100.0%** | Vulnerable |
| **After Mitigation** (`<untrusted_email_content>` Delimitation) | 20 | 0 | **0.0%** | **Protected** |

## 5. Chosen Default Model & Prompt Architecture
- **Selected Default**: **Gemini 2.5 Flash + Prompt v2 (Few-Shot)**
- **Empirical Rationale**: Achieved the highest agreement (74.6%), 0.0% hallucinated evidence rate, and calibrated ECE (0.088) with sub-200ms latency.
