-- ==============================================================================
-- TraceXMail Migration: Quarantine Audit Log Table & Metrics Column
-- Migration File: migrations/create_quarantine_audit_log_and_metrics.sql
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor)
-- 1. Adds the `metrics` JSONB column to `gmail_connections`
-- 2. Creates the `public.quarantine_audit_log` table
-- 3. Enables Row Level Security (RLS) with organization isolation
-- 4. Reloads PostgREST schema cache
-- ==============================================================================

-- 1. Add metrics column to gmail_connections if missing
ALTER TABLE IF EXISTS public.gmail_connections 
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{"total_ingested": 0, "pre_delivery_quarantined": 0, "post_delivery_alerts": 0}'::jsonb;

-- 2. Create quarantine_audit_log table
CREATE TABLE IF NOT EXISTS public.quarantine_audit_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    message_id TEXT NOT NULL,
    subject TEXT,
    from_address TEXT,
    threat_score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    action TEXT NOT NULL,
    delivery_stage TEXT NOT NULL,
    admin_webhook_dispatched BOOLEAN DEFAULT FALSE,
    applied_label TEXT,
    raw_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indices for performant SOC log auditing
CREATE INDEX IF NOT EXISTS idx_quarantine_audit_log_org ON public.quarantine_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_audit_log_timestamp ON public.quarantine_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quarantine_audit_log_msg_id ON public.quarantine_audit_log(message_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.quarantine_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow SOC analysts to view quarantine audit logs in their organization
DROP POLICY IF EXISTS "Users can view quarantine audit logs in their organization" ON public.quarantine_audit_log;
CREATE POLICY "Users can view quarantine audit logs in their organization"
  ON public.quarantine_audit_log FOR SELECT
  USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

-- Pipeline and service role can insert quarantine logs
DROP POLICY IF EXISTS "Pipeline and service role can insert quarantine logs" ON public.quarantine_audit_log;
CREATE POLICY "Pipeline and service role can insert quarantine logs"
  ON public.quarantine_audit_log FOR INSERT
  WITH CHECK (TRUE);

-- Pipeline and service role can update quarantine logs
DROP POLICY IF EXISTS "Pipeline and service role can update quarantine logs" ON public.quarantine_audit_log;
CREATE POLICY "Pipeline and service role can update quarantine logs"
  ON public.quarantine_audit_log FOR ALL
  USING (auth.role() = 'service_role' OR organization_id = auth_user_org_id())
  WITH CHECK (auth.role() = 'service_role' OR organization_id = auth_user_org_id());

-- 5. Force PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
