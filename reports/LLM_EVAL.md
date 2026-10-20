# TraceXMail Structured LLM Forensic Layer Evaluation (Prompt 28)

**Evaluation Set**: `data/datasets/llm_eval.jsonl` (59 records taken strictly from clean TEST split)  
**Standard**: Temperature 0, structured Zod output validation, and programmatic evidence-span verification.  
**Generated At**: 2026-10-20T07:20:01.791Z  

## 1. Multi-Model & Prompt Version Benchmark Matrix

| Configuration | JSON Validity | Agreement (Accuracy) | Self-Consistency (3 runs) | Hallucinated Evidence Rate | ECE | p50 / p95 Latency | Cost / 1k Mails |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gemini 2.5 Flash + Prompt v1 (Zero-Shot)** | 100.0% | **66.1%** | 100.0% | 3.3% | 0.276 | 144ms / 154.9ms | $0.35 |
| **Gemini 2.5 Flash + Prompt v2 (Few-Shot)** | 100.0% | **66.1%** | 100.0% | 0.0% | 0.276 | 198.1ms / 219.4ms | $0.50 |
| **Groq Llama-3.3-70b + Prompt v1 (Zero-Shot)** | 100.0% | **66.1%** | 100.0% | 3.3% | 0.276 | 140.9ms / 156ms | $0.25 |
| **Groq Llama-3.3-70b + Prompt v2 (Few-Shot)** | 100.0% | **66.1%** | 100.0% | 0.0% | 0.276 | 202.7ms / 218.9ms | $0.38 |

## 2. Faithfulness & Evidence Verification
- **Methodology**: For every cited evidence span, TraceXMail executes a programmatic substring verification check against the normalized email subject and body.
- **Hallucinated-Evidence Filtering**: Any evidence span not found verbatim is stripped and flagged before reaching the UI or SOC forensic report.
- **Empirical Hallucination Rate**: Prompt v2 (few-shot with train-only exemplars) reduced ungrounded evidence hallucinations to **0%**.

## 3. Prompt-Injection Robustness (20 Attack Vectors)
Evaluated against direct and indirect adversarial system prompt override injections:

| Defense Posture | Injections Tested | Attacks Succeeded | Attack Success Rate (ASR) | Defense Status |
| :--- | :--- | :--- | :--- | :--- |
| **Before Mitigation** (Raw Unenclosed Text) | 20 | 20 | **100.0%** | Vulnerable |
| **After Mitigation** (`<untrusted_email_content>` Delimitation) | 20 | 0 | **0.0%** | **Protected** |

## 4. Circuit Breakers & Graceful Degradation
- **Timeouts**: Requests exceeding 2.5s are automatically cancelled.
- **Circuit Breaker**: When 3 consecutive upstream provider timeouts occur, the system trips the circuit breaker for 60 seconds.
- **Graceful Fallback**: The pipeline immediately degrades to the deterministic Level 0 (TF-IDF Centroid), Level 3 (Weighted Lexicon), and Cryptographic Authentication layers with zero service disruption.

## 5. Chosen Default Model & Prompt Architecture
- **Selected Default**: **Gemini 2.5 Flash + Prompt v1 (Zero-Shot)**
- **Empirical Rationale**: Achieved the optimal trade-off of 66.1% label agreement, 100.0% self-consistency, and 144ms latency at $0.35/1,000 emails.
