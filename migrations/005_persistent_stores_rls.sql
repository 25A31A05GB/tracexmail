-- ==============================================================================
-- TraceXMail Database Migration: 005_persistent_stores_rls.sql
-- Single Source of Truth, Organization RLS, and Schema Constraint Hardening
-- ==============================================================================

-- 1. Ensure security-definer helper functions exist with row_security = off
-- This completely prevents infinite recursion when evaluating RLS policies.
CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
    v_org_id TEXT;
BEGIN
    BEGIN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
        IF v_org_id IS NOT NULL THEN
            RETURN v_org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        SELECT organization_id INTO v_org_id FROM public.users WHERE id = auth.uid() LIMIT 1;
        IF v_org_id IS NOT NULL THEN
            RETURN v_org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN 'org_acme_soc_01';
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
    v_role TEXT;
BEGIN
    BEGIN
        SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
        IF v_role IS NOT NULL THEN
            RETURN v_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN 'analyst';
END;
$$;

-- 2. Schema Fix: Ensure cases.status CHECK constraint allows QUARANTINED and CLOSED
DO $$
BEGIN
    ALTER TABLE IF EXISTS public.cases DROP CONSTRAINT IF EXISTS cases_status_check;
    ALTER TABLE IF EXISTS public.cases ADD CONSTRAINT cases_status_check
        CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE', 'QUARANTINED', 'CLOSED'));
EXCEPTION WHEN OTHERS THEN
    -- Table or constraint may already match
END $$;

-- 3. Schema Fix: intelligence_cache index on (cache_type, lookup_key)
CREATE INDEX IF NOT EXISTS idx_intel_cache_type_key ON public.intelligence_cache(cache_type, lookup_key);

-- 4. User Testimonials Table
CREATE TABLE IF NOT EXISTS public.user_testimonials (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'org_acme_soc_01' REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    organization TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT NOT NULL,
    impact_metric TEXT,
    verified BOOLEAN DEFAULT TRUE,
    verification_digest TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_reported BOOLEAN DEFAULT FALSE,
    report_count INTEGER DEFAULT 0,
    report_reason TEXT,
    reported_at TIMESTAMPTZ,
    moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'hidden'))
);
CREATE INDEX IF NOT EXISTS idx_testimonials_org ON public.user_testimonials(organization_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON public.user_testimonials(created_at DESC);

-- 5. Classifier Corrections Table (Analyst Human-in-the-Loop Feedback)
CREATE TABLE IF NOT EXISTS public.classifier_corrections (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    original_analysis_id TEXT,
    organization_id TEXT NOT NULL DEFAULT 'org_acme_soc_01' REFERENCES public.organizations(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    from_address TEXT NOT NULL,
    from_domain TEXT NOT NULL,
    body_snippet TEXT,
    model_prediction TEXT NOT NULL,
    model_confidence DOUBLE PRECISION,
    model_threat_score INTEGER,
    analyst_verdict TEXT NOT NULL,
    analyst_notes TEXT,
    analyst_id TEXT NOT NULL,
    analyst_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_corrections_org ON public.classifier_corrections(organization_id);
CREATE INDEX IF NOT EXISTS idx_corrections_case ON public.classifier_corrections(case_id);

-- 6. Org Users Table (Enterprise RBAC Store)
CREATE TABLE IF NOT EXISTS public.org_users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    organization_name TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    employee_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'read_only')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    password_hash TEXT NOT NULL,
    last_active TEXT,
    created_by TEXT,
    notification_status TEXT,
    notification_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_users_org ON public.org_users(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_users_email ON public.org_users(LOWER(email));

-- 7. Auth Ephemeral Tokens Table (OTP, Magic Links, Recovery Resets)
CREATE TABLE IF NOT EXISTS public.auth_ephemeral_tokens (
    token TEXT PRIMARY KEY,
    token_type TEXT NOT NULL CHECK (token_type IN ('otp', 'magic_link', 'reset', 'recovery', 'ticket')),
    email TEXT NOT NULL,
    code TEXT,
    organization_id TEXT DEFAULT 'org_acme_soc_01',
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    attempts INTEGER DEFAULT 0,
    used BOOLEAN DEFAULT FALSE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_ephemeral_email ON public.auth_ephemeral_tokens(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_auth_ephemeral_expires ON public.auth_ephemeral_tokens(expires_at);

-- 8. Row Level Security (RLS) Activation & Multi-Tenant Isolation Policies
ALTER TABLE public.user_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifier_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_ephemeral_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

-- Non-recursive Tenant Isolation Policies using auth_user_org_id()
DROP POLICY IF EXISTS "testimonials_org_isolation" ON public.user_testimonials;
CREATE POLICY "testimonials_org_isolation" ON public.user_testimonials
    FOR ALL
    USING (organization_id = public.auth_user_org_id() OR moderation_status = 'approved')
    WITH CHECK (organization_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "corrections_org_isolation" ON public.classifier_corrections;
CREATE POLICY "corrections_org_isolation" ON public.classifier_corrections
    FOR ALL
    USING (organization_id = public.auth_user_org_id())
    WITH CHECK (organization_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "org_users_org_isolation" ON public.org_users;
CREATE POLICY "org_users_org_isolation" ON public.org_users
    FOR ALL
    USING (organization_id = public.auth_user_org_id())
    WITH CHECK (organization_id = public.auth_user_org_id());

DROP POLICY IF EXISTS "gmail_connections_org_isolation" ON public.gmail_connections;
CREATE POLICY "gmail_connections_org_isolation" ON public.gmail_connections
    FOR ALL
    USING (organization_id = public.auth_user_org_id())
    WITH CHECK (organization_id = public.auth_user_org_id());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
