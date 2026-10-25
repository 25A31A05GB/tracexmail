# TraceXMail API Route Authentication & Authorization Matrix

This document defines the strict default-deny access control policy and role-based authorization requirements for every API route in TraceXMail.

## Access Control Principles
1. **Default-Deny Architecture**: All `/api/*` requests require a valid, verified JWT or scoped API Key unless explicitly on the Public Allowlist.
2. **Role Spectrum**:
   - `admin`: Full administrative access (user management, ML promotions, audit log exports, DLQ management, Gmail watch/connect).
   - `analyst`: Security operations access (read all cases/campaigns/intel, create/analyze cases, execute SOAR playbooks, quarantine messages).
   - `read_only`: Observer access (read cases, view threat logs, inspect IOCs). Forbidden from calling any write endpoints.

---

| HTTP Method | Route Path | Auth Required | Allowed Roles | Notes / Allowlist Justification |
| :--- | :--- | :---: | :--- | :--- |
| **PUBLIC ALLOWLIST** | | | | |
| `GET` | `/api/health` | No | Public | Service liveness probe |
| `GET` | `/api/health/ready` | No | Public | Dependency readiness probe |
| `GET` | `/api/health/live` | No | Public | Container liveness check |
| `POST` | `/api/auth/login` | No | Public | User authentication endpoint |
| `POST` | `/api/auth/signup` | No | Public | Account registration |
| `POST` | `/api/auth/magic-link` | No | Public | Passwordless magic link request |
| `POST` | `/api/auth/verify-magic-link` | No | Public | Magic link token verification |
| `POST` | `/api/auth/reset-password` | No | Public | Password reset request |
| `POST` | `/api/auth/confirm-reset-password` | No | Public | Password reset token completion |
| `GET` | `/api/v1/gmail/callback` | No | Public | Google OAuth 2.0 redirect callback |
| `POST` | `/api/v1/gmail/callback` | No | Public | Google OAuth 2.0 token exchange callback |
| `GET` | `/oauth/gmail/callback` | No | Public | Legacy OAuth callback route |
| `POST` | `/api/gmail/pubsub/push` | No | Public | Google Cloud Pub/Sub push webhook (Token Verified) |
| `POST` | `/api/mail/m365/webhook` | No | Public | Microsoft Graph Webhook (Validation Token Verified) |
| `POST` | `/api/analyze` | Conditional | Public / Auth | Public only when `PUBLIC_ANALYZE_ENABLED=true` |
| | | | | |
| **CASES & INCIDENTS** | | | | |
| `GET` | `/api/cases` | **Yes** | `admin`, `analyst`, `read_only` | List forensic cases |
| `GET` | `/api/cases/:caseId` | **Yes** | `admin`, `analyst`, `read_only` | Inspect case dossier |
| `GET` | `/api/cases/:caseId/correlation` | **Yes** | `admin`, `analyst`, `read_only` | Case threat correlation graph |
| `POST` | `/api/cases` | **Yes** | `admin`, `analyst` | Create new forensic case |
| `PUT` | `/api/cases/:caseId` | **Yes** | `admin`, `analyst` | Update case status/notes |
| `DELETE` | `/api/cases/:caseId` | **Yes** | `admin`, `analyst` | Delete forensic case |
| `POST` | `/api/cases/:caseId/soc-report` | **Yes** | `admin`, `analyst` | Generate SOC incident report |
| `GET` | `/api/cases/:caseId/soc-report` | **Yes** | `admin`, `analyst`, `read_only` | View SOC incident report |
| | | | | |
| **CAMPAIGN MANAGEMENT** | | | | |
| `GET` | `/api/campaigns` | **Yes** | `admin`, `analyst`, `read_only` | List AI threat campaigns |
| `GET` | `/api/campaigns/:campaignId` | **Yes** | `admin`, `analyst`, `read_only` | View campaign cluster details |
| `POST` | `/api/campaigns` | **Yes** | `admin`, `analyst` | Create campaign cluster |
| `POST` | `/api/campaigns/auto-correlate` | **Yes** | `admin`, `analyst` | Run auto-correlation engine |
| `POST` | `/api/campaigns/:campaignId/ai-narrative` | **Yes** | `admin`, `analyst` | Generate AI campaign narrative |
| | | | | |
| **ANALYSIS & FORENSICS** | | | | |
| `POST` | `/api/analyze/raw` | **Yes** | `admin`, `analyst` | Analyze raw RFC 822 EML bytes |
| `POST` | `/api/analyze/batch` | **Yes** | `admin`, `analyst` | Batch email forensic processing |
| `GET` | `/api/jobs/:jobId` | **Yes** | `admin`, `analyst`, `read_only` | Check background job status |
| | | | | |
| **ADMIN & ML REGISTRY** | | | | |
| `GET` | `/api/admin/models/registry` | **Yes** | `admin` | Inspect ML model registry |
| `POST` | `/api/admin/models/promote` | **Yes** | `admin` | Promote ML candidate model |
| `POST` | `/api/admin/models/rollback` | **Yes** | `admin` | Rollback ML model version |
| `GET` | `/api/admin/models/drift` | **Yes** | `admin` | Analyze ML feature drift |
| `GET` | `/api/admin/models/shadow-report` | **Yes** | `admin` | View shadow evaluation report |
| `GET` | `/api/admin/dlq` | **Yes** | `admin` | Inspect Dead Letter Queue |
| `POST` | `/api/admin/dlq/retry/:jobId` | **Yes** | `admin` | Retry DLQ job |
| | | | | |
| **GMAIL INTEGRATION** | | | | |
| `GET` | `/api/gmail/status` | **Yes** | `admin`, `analyst`, `read_only` | Check Gmail integration status |
| `GET` | `/api/gmail/search` | **Yes** | `admin`, `analyst`, `read_only` | Search connected mailbox |
| `GET` | `/api/gmail/synced-emails` | **Yes** | `admin`, `analyst`, `read_only` | List synced mailbox messages |
| `POST` | `/api/gmail/quarantine-message` | **Yes** | `admin`, `analyst` | Quarantine malicious message |
| `POST` | `/api/gmail/trash-message` | **Yes** | `admin`, `analyst` | Move message to trash |
| `POST` | `/api/gmail/create-filter` | **Yes** | `admin`, `analyst` | Create block filter rule |
| `POST` | `/api/gmail/poll-now` | **Yes** | `admin`, `analyst` | Trigger immediate mailbox poll |
| `POST` | `/api/gmail/connect-token` | **Yes** | `admin` | Connect Gmail service token |
| `POST` | `/api/gmail/watch/start` | **Yes** | `admin` | Start Cloud Pub/Sub watch |
| `POST` | `/api/gmail/watch/stop` | **Yes** | `admin` | Stop Cloud Pub/Sub watch |
| | | | | |
| **AUDIT LOGS & COMPLIANCE** | | | | |
| `GET` | `/api/audit/export` | **Yes** | `admin` | Export immutable audit logs |
| `GET` | `/api/audit/verify` | **Yes** | `admin` | Verify cryptographic Merkle chain |
| | | | | |
| **ORGANIZATION & TEAM** | | | | |
| `GET` | `/api/organization/privacy-config` | **Yes** | `admin` | View privacy redaction settings |
| `PUT` | `/api/organization/privacy-config` | **Yes** | `admin` | Update privacy redaction rules |
| `GET` | `/api/organization/rbac-matrix` | **Yes** | `admin` | View RBAC permissions matrix |
| `GET` | `/api/team/members` | **Yes** | `admin` | List team members and roles |
| `POST` | `/api/team/members` | **Yes** | `admin` | Invite team member |
| `PATCH` | `/api/team/members/:userId/role` | **Yes** | `admin` | Change team member role |
| `DELETE` | `/api/team/members/:userId` | **Yes** | `admin` | Remove team member |
| | | | | |
| **OBSERVABILITY & NETWORK** | | | | |
| `GET` | `/metrics` | **Yes** | `admin` or Internal Token | Prometheus metrics scraper |
| `GET` | `/api/network/bandwidth-payload` | **Yes** | `admin` or Internal Token | Bandwidth test payload (Capped) |
