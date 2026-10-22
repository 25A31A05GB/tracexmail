# TraceXMail Layered Pipeline Ablation Study

**Evaluation Set**: Clean Frozen Test Split (59 records)  
**Standard**: Rigorous empirical measurement of individual and cumulative layer contributions.  
**Generated At**: 2026-10-22T00:27:00.000Z  

## 1. Executive Ablation Matrix

| Configuration | Macro F1 | Δ F1 vs Full | Malicious P / R | FPR @ 95% Recall | ECE | Latency (ms) | Cost / 1k Mails |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Full System (All 8 Layers)** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 248.5 ms | $0.0593 |
| **Leave-One-Out: Exclude tfidfCentroid** | **0.281** | +0.000 | 100.0% / 31.3% | 100.0% | 0.093 | 246.8 ms | $0.0593 |
| **Leave-One-Out: Exclude structuralHeaderFeatures** | **0.126** | -0.156 | 100.0% / 0.0% | 96.3% | 0.222 | 247.7 ms | $0.0593 |
| **Leave-One-Out: Exclude authenticationSignals** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 247.9 ms | $0.0593 |
| **Leave-One-Out: Exclude threatIntelSignals** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 243.8 ms | $0.0593 |
| **Leave-One-Out: Exclude weightedLexicons** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 247.1 ms | $0.0593 |
| **Leave-One-Out: Exclude embeddingSimilarity** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 239.5 ms | $0.0593 |
| **Leave-One-Out: Exclude llmLinguisticForensics** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 12.8 ms | $0.0000 |
| **Leave-One-Out: Exclude metaClassifier** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 247.6 ms | $0.0593 |
| **Layer Alone: Only tfidfCentroid** | **0.126** | -0.156 | 100.0% / 0.0% | 96.3% | 0.222 | 1.4 ms | $0.0000 |
| **Layer Alone: Only structuralHeaderFeatures** | **0.281** | +0.000 | 100.0% / 31.3% | 100.0% | 0.093 | 0.8 ms | $0.0000 |
| **Layer Alone: Only authenticationSignals** | **0.126** | -0.156 | 100.0% / 0.0% | 100.0% | 0.042 | 0.6 ms | $0.0000 |
| **Layer Alone: Only threatIntelSignals** | **0.126** | -0.156 | 100.0% / 0.0% | 100.0% | 0.042 | 4.7 ms | $0.0000 |
| **Layer Alone: Only weightedLexicons** | **0.126** | -0.156 | 100.0% / 0.0% | 100.0% | 0.042 | 1.2 ms | $0.0000 |
| **Layer Alone: Only embeddingSimilarity** | **0.126** | -0.156 | 100.0% / 0.0% | 100.0% | 0.042 | 9.0 ms | $0.0000 |
| **Layer Alone: Only llmLinguisticForensics** | **0.126** | -0.156 | 100.0% / 0.0% | 100.0% | 0.042 | 235.7 ms | $0.0593 |
| **Layer Alone: Only metaClassifier** | **0.126** | -0.156 | 100.0% / 0.0% | 100.0% | 0.042 | 0.9 ms | $0.0000 |
| **Adaptive Routing (LLM called only if cheap confidence < 0.8)** | **0.281** | +0.000 | 100.0% / 31.3% | 96.3% | 0.276 | 58.4 ms | $0.0119 |

---

## 2. Methodology & Cost-Accounting Audit Notes
1. **Real Token-Based Cost Accounting**:
   - Zero negative costs. Local deterministic heuristic and linear model layers incur **$0.0000** inference expense.
   - LLM Linguistic Forensics cost is calculated strictly from empirical token counts (450 prompt tokens + 85 completion tokens at Gemini 2.5 Flash pricing: $0.075 / 1M prompt, $0.30 / 1M completion = **$0.0593 per 1,000 emails**).
   - Adaptive confidence-gated routing ($\theta = 0.80$) dispatches only 20% of traffic to the LLM, reducing average inference cost by 80% down to **$0.0119 / 1k emails**.
2. **Layer Sensitivity on Text-Only vs Full-Telemetry Holdouts**:
   - On offline text-only benchmarks lacking live MTA relay hops and authoritative DNS, `structuralHeaderFeatures` provides the primary signal driving non-legitimate classifications.
   - Removing the LLM layer cuts latency from 248.5ms down to 12.8ms while maintaining deterministic baseline classification.
