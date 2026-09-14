-- ==============================================================================
-- TraceXMail Forensic Email Analysis Platform: Postgres Database Schema & RLS
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Profiles Table (maps auth.users to tenant organization and RBAC role)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'read_only')),
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE')),
    severity TEXT NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN')),
    threat_score INTEGER NOT NULL DEFAULT 0,
    threat_score_breakdown JSONB DEFAULT '{}'::jsonb,
    classification TEXT DEFAULT 'SUSPICIOUS',
    auth JSONB DEFAULT '{}'::jsonb,
    heuristics JSONB DEFAULT '[]'::jsonb,
    ml_confidence NUMERIC DEFAULT 0.0,
    phishing_probability NUMERIC DEFAULT 0.0,
    from_domain TEXT,
    origin_ip TEXT,
    origin_country TEXT,
    origin_asn TEXT,
    origin_asn_org TEXT,
    infra_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_user TEXT,
    tags JSONB DEFAULT '["Custom"]'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT DEFAULT 'manual',
    raw_analysis JSONB
);

-- 5. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    threat_actor TEXT DEFAULT 'Unattributed',
    target_industry TEXT DEFAULT 'General Enterprise',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MONITORED', 'CONTAINED', 'RESOLVED')),
    total_emails INTEGER DEFAULT 1,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    member_email_ids JSONB DEFAULT '[]'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    severity TEXT NOT NULL DEFAULT 'HIGH',
    title TEXT NOT NULL,
    description TEXT,
    source TEXT DEFAULT 'pipeline',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    threat_score INTEGER,
    category TEXT,
    sender TEXT,
    subject TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7. Evidence Table
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    storage_path TEXT,
    raw_content TEXT,
    raw_bytes TEXT,
    encryption_key_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    purged_at TIMESTAMPTZ
);

-- 8. Audit Logs Table (Append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    case_id TEXT,
    user_id TEXT,
    user_email TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- Indexes for High Performance SOC Telemetry & Queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_cases_org ON cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_is_demo ON cases(is_demo);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_threat_score ON cases(threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for user lookup
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- PROFILES Policies
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role or signup can insert profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

-- CASES Policies
CREATE POLICY "Users can view cases in their organization or demo cases"
  ON cases FOR SELECT
  USING (is_demo = true OR organization_id = auth_user_org_id());

CREATE POLICY "Analysts and Admins can insert cases into their organization"
  ON cases FOR INSERT
  WITH CHECK (
    organization_id = auth_user_org_id() AND
    auth_user_role() IN ('admin', 'analyst')
  );

CREATE POLICY "Analysts and Admins can update cases in their organization"
  ON cases FOR UPDATE
  USING (
    organization_id = auth_user_org_id() AND
    auth_user_role() IN ('admin', 'analyst')
  );

CREATE POLICY "Analysts and Admins can delete cases in their organization"
  ON cases FOR DELETE
  USING (
    organization_id = auth_user_org_id() AND
    auth_user_role() IN ('admin', 'analyst')
  );

-- CAMPAIGNS Policies
CREATE POLICY "Users can view campaigns in their organization or demo campaigns"
  ON campaigns FOR SELECT
  USING (is_demo = true OR organization_id = auth_user_org_id());

CREATE POLICY "Analysts and Admins can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (
    organization_id = auth_user_org_id() AND
    auth_user_role() IN ('admin', 'analyst')
  );

CREATE POLICY "Analysts and Admins can update campaigns"
  ON campaigns FOR UPDATE
  USING (
    organization_id = auth_user_org_id() AND
    auth_user_role() IN ('admin', 'analyst')
  );

-- ALERTS Policies
CREATE POLICY "Users can view alerts in their organization or demo alerts"
  ON alerts FOR SELECT
  USING (is_demo = true OR organization_id = auth_user_org_id());

CREATE POLICY "Users can mark alerts as read in their organization"
  ON alerts FOR UPDATE
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Service role or analysts can create alerts"
  ON alerts FOR INSERT
  WITH CHECK (
    organization_id = auth_user_org_id() OR auth.role() = 'service_role'
  );

-- AUDIT LOGS Policies (Append-only)
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Users and pipeline can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    organization_id = auth_user_org_id() OR auth.role() = 'service_role'
  );

-- Seed default demo organization
INSERT INTO organizations (id, name, slug)
VALUES ('org_acme_soc_01', 'Acme Cyber Defense SOC', 'acme-soc')
ON CONFLICT (id) DO NOTHING;
