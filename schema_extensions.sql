-- ==============================================================================
-- TraceXMail Forensic Email Analysis Platform: Extension Tables & RLS
-- ==============================================================================

-- 1. Gmail Connections Table (State, Watch, Quarantine configs & encrypted tokens)
CREATE TABLE IF NOT EXISTS gmail_connections (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    history_id TEXT,
    watch_enabled BOOLEAN DEFAULT TRUE,
    watch_active BOOLEAN DEFAULT FALSE,
    watch_topic_name TEXT,
    watch_subscription TEXT,
    watch_expiration TIMESTAMPTZ,
    watch_last_push_at TIMESTAMPTZ,
    quarantine_enabled BOOLEAN DEFAULT TRUE,
    quarantine_threshold INTEGER DEFAULT 70,
    quarantine_label_name TEXT DEFAULT 'TraceXMail-Quarantine',
    remove_inbox_label BOOLEAN DEFAULT TRUE,
    admin_webhook_url TEXT,
    metrics JSONB DEFAULT '{"total_ingested": 0, "pre_delivery_quarantined": 0, "post_delivery_alerts": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_gmail_connections_org_email UNIQUE (organization_id, email_address)
);

-- 2. Quarantine Audit Log Table (Real-time pre/post delivery quarantine events)
CREATE TABLE IF NOT EXISTS quarantine_audit_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    message_id TEXT NOT NULL,
    subject TEXT,
    from_address TEXT,
    threat_score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('HOLD_QUARANTINED', 'INSPECTED_CLEAN', 'ALERT_DISPATCHED')),
    delivery_stage TEXT NOT NULL CHECK (delivery_stage IN ('pre-delivery-hold', 'post-delivery-alert')),
    admin_webhook_dispatched BOOLEAN DEFAULT FALSE,
    applied_label TEXT,
    raw_details JSONB DEFAULT '{}'::jsonb
);

-- 3. Slack Config Table (Per-organization Slack alerting configuration)
CREATE TABLE IF NOT EXISTS slack_config (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    bot_token_encrypted TEXT,
    channel_id TEXT,
    min_severity TEXT DEFAULT 'HIGH' CHECK (min_severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'ALL')),
    webhook_url_encrypted TEXT,
    auto_send_alerts BOOLEAN DEFAULT TRUE,
    username TEXT DEFAULT 'TraceXMail SOC Engine',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Slack Delivery Logs Table (Outbound webhook and bot delivery audit trail)
CREATE TABLE IF NOT EXISTS slack_delivery_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    alert_id TEXT,
    subject TEXT NOT NULL,
    severity TEXT NOT NULL,
    threat_score INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('DELIVERED', 'FAILED', 'SKIPPED_SEVERITY', 'SKIPPED_DUPLICATE', 'DISABLED')),
    status_code INTEGER,
    error TEXT,
    bot_token_masked TEXT,
    channel_id TEXT,
    webhook_url_masked TEXT,
    payload_preview JSONB
);

-- 5. Email Alert Logs Table (Outbound Resend/SMTP alert execution history)
CREATE TABLE IF NOT EXISTS email_alert_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    threat_score INTEGER,
    verdict TEXT,
    provider TEXT NOT NULL CHECK (provider IN ('resend', 'smtp', 'none', 'failed')),
    success BOOLEAN NOT NULL,
    details TEXT
);

-- 6. Intelligence Cache Table (Durable TTL-backed threat intelligence cache)
CREATE TABLE IF NOT EXISTS intelligence_cache (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    lookup_key TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_intelligence_cache_provider_key UNIQUE (provider, lookup_key)
);

-- 7. Team Invitations Table (RBAC operator clearance provision invites)
CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'read_only')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    token TEXT UNIQUE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ==============================================================================
-- Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_gmail_connections_org ON gmail_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_audit_log_org ON quarantine_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_audit_log_timestamp ON quarantine_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_slack_delivery_logs_org ON slack_delivery_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_slack_delivery_logs_timestamp ON slack_delivery_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_email_alert_logs_org ON email_alert_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_alert_logs_timestamp ON email_alert_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_intel_cache_provider_key ON intelligence_cache(provider, lookup_key);
CREATE INDEX IF NOT EXISTS idx_intel_cache_expires_at ON intelligence_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org ON team_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all extension tables
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 1. GMAIL_CONNECTIONS Policies
CREATE POLICY "Users can view gmail connections in their organization"
  ON gmail_connections FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

CREATE POLICY "Admins and service role can modify gmail connections"
  ON gmail_connections FOR ALL
  USING (
    auth.role() = 'service_role' OR (
      organization_id = auth_user_org_id() AND
      auth_user_role() = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR (
      organization_id = auth_user_org_id() AND
      auth_user_role() = 'admin'
    )
  );

-- 2. QUARANTINE_AUDIT_LOG Policies
CREATE POLICY "Users can view quarantine audit logs in their organization"
  ON quarantine_audit_log FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

CREATE POLICY "Pipeline and service role can insert quarantine logs"
  ON quarantine_audit_log FOR INSERT
  WITH CHECK (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

-- 3. SLACK_CONFIG Policies
CREATE POLICY "Users can view slack config in their organization"
  ON slack_config FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

CREATE POLICY "Admins and service role can modify slack config"
  ON slack_config FOR ALL
  USING (
    auth.role() = 'service_role' OR (
      organization_id = auth_user_org_id() AND
      auth_user_role() = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR (
      organization_id = auth_user_org_id() AND
      auth_user_role() = 'admin'
    )
  );

-- 4. SLACK_DELIVERY_LOGS Policies
CREATE POLICY "Users can view slack delivery logs in their organization"
  ON slack_delivery_logs FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

CREATE POLICY "Pipeline and service role can insert slack delivery logs"
  ON slack_delivery_logs FOR INSERT
  WITH CHECK (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

-- 5. EMAIL_ALERT_LOGS Policies
CREATE POLICY "Users can view email alert logs in their organization"
  ON email_alert_logs FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

CREATE POLICY "Pipeline and service role can insert email alert logs"
  ON email_alert_logs FOR INSERT
  WITH CHECK (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

-- 6. INTELLIGENCE_CACHE Policies (Shared threat telemetry cache)
CREATE POLICY "Authenticated users and service role can view cached intelligence"
  ON intelligence_cache FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users and service role can insert/update cached intelligence"
  ON intelligence_cache FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 7. TEAM_INVITATIONS Policies
CREATE POLICY "Users can view invitations in their organization"
  ON team_invitations FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

CREATE POLICY "Admins and service role can manage team invitations"
  ON team_invitations FOR ALL
  USING (
    auth.role() = 'service_role' OR (
      organization_id = auth_user_org_id() AND
      auth_user_role() = 'admin'
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR (
      organization_id = auth_user_org_id() AND
      auth_user_role() = 'admin'
    )
  );
