# Service Level Objectives (SLOs) & Error Budgets

This document outlines the Service Level Indicators (SLIs), Service Level Objectives (SLOs), and Error Budget policies for the TraceXMail Enterprise Email Forensics Platform.

---

## 1. Core Service Level Objectives

| Service Target | SLI Metric | SLO Target | Measurement Window |
|---|---|---|---|
| **API Availability** | Successful non-5xx responses over total requests | **>= 99.9%** | Rolling 30 days |
| **Analysis Latency** | Duration of single email forensic analysis (`parseRawEmailToAnalysis`) | **p95 < 5.0 seconds** | Rolling 7 days |
| **Quarantine Latency** | Time between threshold verdict and message isolation action | **< 2.0 seconds** | Rolling 7 days |
| **Background Queue Processing** | BullMQ queue delay before worker pickup | **p99 < 15.0 seconds** | Rolling 24 hours |
| **Threat Intel Enrichment** | Provider turnaround with circuit breaker fallback | **p95 < 3.0 seconds** | Rolling 24 hours |

---

## 2. SLI Formulas

### 2.1 API Availability
$$\text{Availability} = \frac{\sum \text{rate}(tracexmail\_http\_requests\_total\{status\_code !~ "5.."\} [5m])}{\sum \text{rate}(tracexmail\_http\_requests\_total [5m])} \ge 0.999$$

### 2.2 Forensic Analysis Latency (p95 < 5s)
$$\text{p95 Analysis Latency} = \text{histogram\_quantile}(0.95, \text{sum}(\text{rate}(tracexmail\_analysis\_duration\_seconds\_bucket[5m])) \text{ by } (le)) < 5.0$$

### 2.3 Quarantine Enforcement Latency (< 2s)
$$\text{Quarantine Response Time} = \text{histogram\_quantile}(0.99, \text{sum}(\text{rate}(tracexmail\_external\_api\_duration\_seconds\_bucket\{provider="gmail"\} [5m])) \text{ by } (le)) < 2.0$$

---

## 3. Error Budget & Policy

- **Monthly Error Budget (Availability):** 43.2 minutes of allowed downtime or error rate per month (0.1% of 43,200 minutes).
- **Burn Rate Alerts:**
  - **14.4x burn rate (2% consumed in 1 hour):** Page On-Call (P1 incident).
  - **6x burn rate (5% consumed in 6 hours):** High severity alert (P2 incident).
  - **1x burn rate (10% consumed in 3 days):** Ticket created for next business day review.
- **Budget Exhaustion Consequence:**
  - If monthly error budget drops below 10%, feature releases are frozen; engineering prioritizes stability, resilience, and root-cause remediation.

---

## 4. Alerting Architecture
See `ops/alerts.yml` for Prometheus / Alertmanager alerting rules enforcing these targets.
