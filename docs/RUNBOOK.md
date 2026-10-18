# Incident Response Runbook

This runbook provides actionable procedures for responding to production outages and anomalies in TraceXMail.

---

## 1. Database Outage (Supabase / PostgreSQL)

### Symptoms
- `/api/health/ready` returns HTTP 503 (`database: down`).
- P1 alert: `TraceXMailReadinessFailed` or `HighHttpErrorRate`.
- Logs show connection timeouts: `ETIMEDOUT`, `ECONNREFUSED`, or `500 Internal Server Error`.

### Immediate Actions
1. **Verify Health:**
   ```bash
   curl -i https://app.tracexmail.com/api/health/ready
   ```
2. **Check Supabase Dashboard:**
   - Log into Supabase Console -> Project Settings -> Database.
   - Inspect CPU, memory, and active connections (pool exhaustion).
3. **Engage Fallback:**
   - TraceXMail has in-memory and degraded local stores. If database restart takes > 5 minutes, restart the API with `DATABASE_DEGRADED_MODE=true` to allow synchronous analysis to continue without persistence.
4. **Connection Pool Reset:**
   - Terminate hanging transactions or reboot the Supabase instance from the console.
5. **Post-Recovery:**
   - Replay queued records via Dead-Letter Queue: `POST /api/admin/dlq/retry/:id`.

---

## 2. Redis Outage

### Symptoms
- BullMQ worker stops processing jobs; queue depth increases.
- Readiness check reports `redis: down`.

### Immediate Actions
1. **Verify Redis Status:**
   ```bash
   redis-cli -u $REDIS_URL PING
   ```
2. **Switch to In-Process Fallback (Development/Hotfix):**
   - In dev/staging, unsetting `REDIS_URL` triggers the internal in-process queue runner.
   - In production, scale the Redis cluster or restart the managed Redis service on Render.
3. **Drain and Inspect Memory:**
   - If Redis is OOM, check eviction policy: ensure `maxmemory-policy volatile-lru` or `allkeys-lru` is enabled.
4. **Restart Workers:**
   - Once Redis recovers, restart `tracexmail-worker` instances:
   ```bash
   npm run worker
   ```

---

## 3. Gmail API Quota Exhaustion

### Symptoms
- `429 Too Many Requests` or `UserRateLimitExceeded` from Google APIs.
- Gmail sync worker jobs fail with `Quota exceeded for quota metric 'Queries'`.

### Immediate Actions
1. **Inspect Quota Consumption:**
   - Go to Google Cloud Console -> APIs & Services -> Gmail API -> Quotas.
2. **Back Off & Rate Limit:**
   - The system utilizes token bucket rate limiters in `gmailService.ts`. Increase `GMAIL_POLL_INTERVAL_MS` from default to `120000` (2 minutes).
3. **Switch to Webhooks:**
   - Ensure Cloud Pub/Sub push notifications are active rather than aggressive polling.
4. **Request Quota Increase:**
   - Submit emergency quota increase request in GCP console for `Queries per 100 seconds per user`.

---

## 4. LLM Provider Outage (Gemini / Groq)

### Symptoms
- AI narrative generation or classification returns 502/504.
- Logs show timeout contacting Google GenAI or Groq endpoint.

### Immediate Actions
1. **Automatic Circuit Breaker:**
   - The analysis pipeline gracefully handles AI provider degradation: when Gemini/Groq is unreachable, the system falls back to the deterministic Bayesian, structural, and linguistic heuristic models.
2. **Verify Heuristic Verdict Integrity:**
   - Ensure `isOfflineFallback: true` is included in the case metadata.
3. **Provider Failover:**
   - Toggle primary provider via env var `PRIMARY_AI_PROVIDER=groq` or `gemini`.
   - Update model alias in runtime configuration.

---

## 5. Elevated False-Positive Reports

### Symptoms
- Analysts report benign business emails being quarantined.
- Spike in `POST /api/quarantine/release` requests.

### Immediate Actions
1. **Adjust Quarantine Threshold:**
   - Temporarily increase the quarantine threshold in organization settings from `75` to `85`.
2. **Whitelisting:**
   - Add trusted domains or IPs to organization whitelist:
     `POST /api/organization/whitelist` with sender domain.
3. **Review Classifier Feedback:**
   - Pull recent feedback corrections:
     `GET /api/classifier/feedback?verdict=false_positive`.
4. **Retrain Model Weights:**
   - Trigger offline incremental training run:
     `npm run test:unit && tsx scripts/train_classifier.ts`.

---

## 6. Key Compromise (Encryption / JWT / API Key)

### Symptoms
- Suspicious API access, unauthorized token decryption, or suspected leak.

### Immediate Actions
1. **Immediate Revocation:**
   - If a specific API key was leaked: revoke immediately in Admin Console or run:
     `POST /api/auth/api-keys/revoke` with the key ID.
2. **Rotate Master Encryption Key:**
   - Generate a new 32-byte AES key:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
   - Add new key to `TOKEN_ENCRYPTION_KEYS` with a new key ID (e.g. `k2`).
   - Set `TOKEN_ENCRYPTION_ACTIVE_KEY_ID=k2`.
   - Deploy configuration to API and Workers.
   - Run the zero-downtime key rotation script:
     ```bash
     tsx scripts/rotate_encryption_key.ts
     ```
3. **Revoke User Sessions:**
   - Update `JWT_SECRET`. This immediately invalidates all issued session tokens across all users.
   - Run `POST /api/auth/sessions/revoke-all` in Supabase.
4. **Audit Log Inspection:**
   - Walk the immutable audit log hash chain to identify unauthorized access window:
     `GET /api/audit/verify`.
