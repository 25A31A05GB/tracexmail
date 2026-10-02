# TraceXMail REST API Reference

All endpoints bind to port `3000` via Express application gateway.

## 1. Core Endpoints

### 1.1 Ingestion & Analysis
- `POST /api/analyze/eml`: Multipart form upload of `.eml` or RFC 822 MIME raw email.
  - **Returns:** Full JSON `EmailAnalysis` object containing SHA-256 hash, evidence ID, parsed headers, auth results, hops, domain intelligence, ML probabilities, BEC signals, and risk score.
- `POST /api/analyze/text`: JSON payload containing raw email text headers and body.
  - **Returns:** Structured forensic analysis.

### 1.2 Case Management & SOC Reports
- `GET /api/cases`: Retrieve case list. Supports query parameters `exclude_demo=true`, `severity`, `status`, `search`.
- `GET /api/cases/:id`: Retrieve detailed forensic case data.
- `POST /api/cases`: Create a new forensic case.
- `PATCH /api/cases/:id`: Update case status, severity, notes, tags.
- `DELETE /api/cases/:id`: Delete a case (Admin only).
- `POST /api/cases/:caseId/soc-report`: Synthesizes a structured Gemini SOC Tier-2/Tier-3 forensic incident report with executive summary, threat actor profile, attribution hypothesis (with confidence and evidence IDs), remediation playbook, and defensive rules (M365 PowerShell, Snort/Suricata, Postfix).
- `GET /api/cases/:caseId/soc-report`: Retrieves stored SOC analyst report for a case. Supports `?generate=true` to generate on demand.

### 1.3 Campaign Intelligence & Correlation
- `GET /api/campaigns`: Retrieves active campaign clusters with member cases, shared IOC evidence, and timeline moves.
- `GET /api/campaigns/:campaignId`: Retrieves detailed campaign cluster data.
- `GET /api/campaigns/:campaignId/timeline`: Retrieves chronological infrastructure event timeline and hosting churn analysis.
- `POST /api/campaigns/auto-correlate`: Executes deterministic multi-factor correlation across all cases.
- `POST /api/campaigns/ai-detect`: Runs Gemini AI-assisted campaign detection across incident cases (requires $\ge 2$ cases).
- `POST /api/campaigns/:campaignId/ai-narrative`: Generates an AI narrative, shared TTPs, and adversary objectives for a campaign cluster (requires $\ge 2$ cases).

### 1.4 Evidence Management
- `GET /api/evidence/:evidenceId`: Retrieve evidence metadata and custody record.
- `GET /api/evidence/:evidenceId/raw`: Download preserved unmodified original `.eml` bytes.
- `POST /api/evidence/:evidenceId/verify`: Verify SHA-256 hash against preserved disk/db bytes.
  - **Returns:** `{"status": "MATCH", "recorded_hash": "...", "calculated_hash": "..."}` or `{"status": "INTEGRITY_FAILURE"}`.

### 1.5 Threat Intelligence & Enrichment
- `GET /api/intelligence/status`: Operational status and cache telemetry for MaxMind, AbuseIPDB, VirusTotal, and AlienVault OTX.
- `GET /api/intelligence/ip/:ip`: MaxMind GeoLite2, ASN, and Tor exit node lookup for an IP with provenance.
- `GET /api/intelligence/domain/:domain`: Live DNS (MX, SPF, DMARC) and RDAP registration lookup.
- `GET /api/intelligence/dns/:domain`: Authoritative DNS query (A, AAAA, MX, NS, TXT).
- `GET /api/intelligence/rdap/:domain`: Live ICANN/IANA RDAP query.
- `GET /api/intelligence/otx/:type/:indicator`: AlienVault OTX DirectConnect indicator query (`type`: `IPv4` | `domain` | `url` | `file`).
- `GET /api/ml/metrics`: Telemetry and performance metrics for the active ML classifier.

### 1.6 System & Health
- `GET /api/health`: Health status and active component readiness.
- `GET /api/compliance/audit-logs`: Chronological log of all analyst actions, SOC report generations, and evidence accesses.

## 2. Network Intelligence & Analyst Telemetry

### 2.1 Telemetry Endpoints
- `GET /api/network-info`: Retrieves public IP, IP version (IPv4/IPv6), approximate location, network organization/ISP, ASN, and hosting server location.
  - **Query Params:** `force_refresh=true` (bypasses 10-minute in-memory cache).
  - **Returns:** Structured JSON with `isApproximate: true` and disclaimer.
- `GET /api/network/ping`: Lightweight round-trip latency endpoint with zero-cache headers.
  - **Returns:** `{"status": "ok", "timestamp": 1788538543227}`.
- `GET /api/network/bandwidth-payload`: Controlled 512 KB payload for on-demand download throughput measurement.
  - **Returns:** 524,288 raw bytes with `application/octet-stream` and no-cache directives.

See `docs/NETWORK_INTELLIGENCE.md` for methodology, privacy safeguards, and rate limits.
