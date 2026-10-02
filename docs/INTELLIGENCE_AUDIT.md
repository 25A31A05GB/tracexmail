# TraceXMail Domain, IP & Geolocation Intelligence Audit Report
**Problem Statement:** Smart India Hackathon 2026 — PS 26106  
**Document Artifact:** `docs/INTELLIGENCE_AUDIT.md`  
**Audit Scope:** Full codebase scan of `src/`, `server.ts`, `scripts/`, `data/`, and frontend components.  
**Principle:** **REAL + INCOMPLETE** strictly preferred over **FAKE + COMPLETE**. Never silently invent intelligence.

---

## 1. Intelligence Features Audit Matrix

| Feature | Current Source | Status | File | Implemented Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **MaxMind GeoLite2 IP Geolocation** | `maxmindService.ts` & `src/server/intelligence/geoip.ts` | **FIXED / REAL** | `src/server/maxmindService.ts`, `src/server/intelligence/geoip.ts` | Uses official binary MMDB reader with local CSV and MaxMind Web Service failover. Zero fabricated coordinates. |
| **Unmapped Public IPv4 Fallback** | `maxmindService.ts` | **FIXED / REAL** | `src/server/maxmindService.ts`, `src/server/intelligence/geoip.ts` | Modulo-hash fake cities deleted. Returns `status: 'unavailable'`, `reason: 'database_not_configured_or_unmapped'`, and `coords: null`. |
| **Private IP & RFC 1918 Demarcation** | `ipExtractor.ts` regex & bitwise mask classifier | **FIXED / REAL** | `src/server/ipExtractor.ts`, `src/server/intelligence/ipValidation.ts` | Bitwise RFC 1918/RFC 1122 logic. Returns `isPublic: false`, `lookupStatus: 'not_applicable'`, `reason: 'private_address'`. No external queries. |
| **Client-Side GeoIP Fallback** | `src/utils/maxmindService.ts` | **FIXED / REAL** | `src/utils/maxmindService.ts` | Removed fake Sofia/Tokyo coords and fake PTRs. Client marks `found: false`, `coords: undefined`. |
| **Parser Prefix Geo Mapping** | `src/utils/parser.ts` | **FIXED / REAL** | `src/utils/parser.ts` | Removed hardcoded prefix geo. Unresolved IPs marked as `UNRESOLVED_UNKNOWN` without invented cities. |
| **Domain DNS Resolution (A, MX, TXT, NS)** | Node.js `dns.promises` | **FIXED / REAL** | `src/server/intelligence/dns.ts`, `src/server/domainService.ts` | Authoritative DNS with A, AAAA, MX, NS, CNAME, TXT (SPF, DMARC, DKIM) with timeouts and structured error handling. |
| **Domain RDAP Registration** | ICANN/IANA RDAP HTTP client | **FIXED / REAL** | `src/server/intelligence/rdap.ts`, `src/server/domainService.ts` | Live RDAP discovery with registration, update, expiration events. |
| **RDAP Registrar Fallback Strings** | `domainService.ts` | **FIXED / REAL** | `src/server/domainService.ts` | Removed fake strings (`Brand Registrar (Secured)`, `Domain Registrar`). Returns `registrar: null` / `undefined`. |
| **Domain Typosquatting Analysis** | Levenshtein distance on domain labels | **FIXED / REAL** | `src/server/domainService.ts`, `src/server/intelligence/domain.ts` | Algorithmic Levenshtein and brand matching with explicit `source: 'algorithmic_levenshtein'`. |
| **Threat Intelligence (AbuseIPDB)** | `threatIntelService.ts` | **FIXED / REAL** | `src/server/threatIntelService.ts` | Removed hardcoded prefix simulation (`185.220.x` / `194.26.29.x`). `isTor` derived strictly from Tor Project exit directory. Missing key returns `status: 'UNCONFIGURED'`, `score: null`. |
| **AlienVault OTX DirectConnect** | `otxService.ts` | **FIXED / REAL** | `src/server/otxService.ts` | Real OTX API v1 integration for IPv4, domain, URL, and file indicators with 2h TTL cache, in-flight deduplication, and zero fabrication. |
| **VirusTotal API v3** | `virustotal.ts` & `virustotalService.ts` | **FIXED / REAL** | `src/server/intelligence/virustotal.ts` | Multi-engine reputation with 1h TTL cache. Missing key returns explicit `status: 'UNCONFIGURED'`. |
| **Gemini SOC Analyst Report** | `socReportService.ts` | **FIXED / REAL** | `src/server/socReportService.ts` | Multi-model fallback (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`) returning grounded SOC Tier-3 incident briefs, attribution hypothesis (with confidence and evidence IDs), remediation playbook, and defensive rules. |
| **Gemini Campaign Detection** | `aiCampaignService.ts` | **FIXED / REAL** | `src/server/aiCampaignService.ts` | Uses `correlationEngine.ts` as strict source of truth for clusters; synthesizes campaign narratives, shared TTPs, and adversary objectives without modifying cluster memberships. |
| **Forensic Language & Attribution** | Terminology in reports & UI | **FIXED / REAL** | `server.ts`, UI components | Standardized on **"Observed Ingress IP"**, **"Observed Sending Infrastructure"**, and **"Approximate Network Geolocation"**. |
| **Provenance Tracking** | Centralized provenance metadata contract | **FIXED / REAL** | `src/server/intelligence/provenance.ts`, `src/server/threatIntelService.ts`, `src/server/otxService.ts` | `{ source, queriedAt, isLive, status: 'LIVE' | 'UNCONFIGURED' | 'ERROR' }` attached to all enriched records. |
| **Cache & Request Deduplication** | Centralized TTL Cache with Promise Deduplication | **FIXED / REAL** | `src/server/intelligence/cache.ts`, `threatIntelService.ts`, `otxService.ts` | 2h TTL caches with `Map<lookupKey, Promise<Result>>` in-flight deduplication. |

---

## 2. API Endpoints for Threat Intelligence

- `GET /api/intelligence/status` — Operational status of MaxMind, AbuseIPDB, VirusTotal, and AlienVault OTX.
- `GET /api/intelligence/ip/:ip` — Comprehensive IP intelligence (GeoIP, ASN, Tor, AbuseIPDB, RFC scope).
- `GET /api/intelligence/domain/:domain` — Comprehensive domain intelligence (DNS, RDAP, Typosquatting).
- `GET /api/intelligence/dns/:domain` — Authoritative DNS records (A, AAAA, MX, NS, TXT).
- `GET /api/intelligence/rdap/:domain` — ICANN/IANA RDAP registration telemetry.
- `GET /api/intelligence/otx/:type/:indicator` — Live AlienVault OTX pulse count, adversary, tags, and malware families.
- `POST /api/cases/:caseId/soc-report` — Synthesizes structured Gemini SOC analyst report with evidence lineage.
- `GET /api/cases/:caseId/soc-report` — Retrieves stored SOC analyst report for a case.
- `POST /api/campaigns/ai-detect` — Correlates cases into campaign clusters with AI narratives.
- `POST /api/campaigns/:campaignId/ai-narrative` — Generates or updates AI narrative for a specific campaign cluster.
