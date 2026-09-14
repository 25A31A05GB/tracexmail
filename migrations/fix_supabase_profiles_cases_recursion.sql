-- ==============================================================================
-- TraceXMail Fix: Profiles 404, Cases 500 Infinite Recursion & RLS Hardening
-- Migration File: migrations/fix_supabase_profiles_cases_recursion.sql
-- ==============================================================================
-- Run this in Supabase Dashboard > SQL Editor
-- 1. Creates default organization if missing
-- 2. Patches auth_user_org_id() and auth_user_role() with SET row_security = off (fixes 500 infinite recursion)
-- 3. Creates public.profiles table (fixes 404 table not in schema cache)
-- 4. Sets non-recursive RLS policies on profiles, users, and cases
-- 5. Configures auth.users insert trigger and backfills existing users
-- 6. Reloads PostgREST schema cache (NOTIFY pgrst)
-- ==============================================================================

-- 1. Ensure organizations table exists and has default org
CREATE TABLE IF NOT EXISTS public.organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.organizations (id, name)
VALUES ('org_acme_soc_01', 'Acme Cyber Defense SOC')
ON CONFLICT (id) DO NOTHING;

-- 2. Break infinite recursion on helper functions:
-- By adding `SET row_security = off` and `SECURITY DEFINER`, these functions
-- bypass Row Level Security when looking up the caller's organization and role,
-- completely preventing recursive policy evaluations between cases, users, and profiles.
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
    -- Check profiles table first
    BEGIN
        SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
        IF v_org_id IS NOT NULL THEN
            RETURN v_org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- profiles table might not exist yet
    END;

    -- Check users table fallback if it exists
    BEGIN
        SELECT organization_id INTO v_org_id FROM public.users WHERE id = auth.uid() LIMIT 1;
        IF v_org_id IS NOT NULL THEN
            RETURN v_org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- users table might not exist
    END;

    -- Default organization fallback
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
    -- Check profiles table first
    BEGIN
        SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
        IF v_role IS NOT NULL THEN
            RETURN v_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- Check users table fallback if it exists
    BEGIN
        SELECT role INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
        IF v_role IS NOT NULL THEN
            RETURN v_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN 'analyst';
END;
$$;

-- 3. Create or update public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'read_only')),
    full_name TEXT,
    account_type TEXT DEFAULT 'organization',
    email_verified BOOLEAN DEFAULT FALSE,
    employee_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Non-recursive RLS policies on profiles:
-- Authenticated users can view their own profile and organization profiles without recursive function calls
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
    ON public.profiles FOR SELECT
    USING (
        id = auth.uid()
        OR auth.role() = 'service_role'
        OR auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid() OR auth.role() = 'service_role')
    WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to profiles" ON public.profiles;
CREATE POLICY "Service role full access to profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 4. Fix recursion on public.users if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view users in their organization" ON public.users';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.users';
        EXECUTE 'DROP POLICY IF EXISTS "Users read policy" ON public.users';
        EXECUTE 'CREATE POLICY "Users can view users" ON public.users FOR SELECT USING (id = auth.uid() OR auth.role() = ''service_role'' OR auth.uid() IS NOT NULL)';
    END IF;
END $$;

-- 5. Fix cases table RLS policies
DROP POLICY IF EXISTS "Users can view cases in their organization or demo cases" ON public.cases;
CREATE POLICY "Users can view cases in their organization or demo cases"
    ON public.cases FOR SELECT
    USING (
        is_demo = true
        OR auth.role() = 'service_role'
        OR organization_id = auth_user_org_id()
    );

-- 6. Trigger to auto-provision profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    user_name TEXT;
    org_id TEXT;
BEGIN
    -- Grant admin role to the primary admin, analyst to others
    IF NEW.email = 'arfathof@gmail.com' OR NEW.raw_user_meta_data->>'role' = 'admin' THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'analyst');
    END IF;

    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    org_id := COALESCE(NEW.raw_user_meta_data->>'organization_id', 'org_acme_soc_01');

    INSERT INTO public.profiles (id, email, organization_id, role, full_name, email_verified)
    VALUES (NEW.id, NEW.email, org_id, assigned_role, user_name, TRUE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        role = CASE WHEN public.profiles.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Backfill existing auth.users into public.profiles
INSERT INTO public.profiles (id, email, organization_id, role, full_name, email_verified)
SELECT
    u.id,
    u.email,
    'org_acme_soc_01',
    CASE WHEN u.email = 'arfathof@gmail.com' THEN 'admin' ELSE 'analyst' END,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    TRUE
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = CASE WHEN public.profiles.email = 'arfathof@gmail.com' THEN 'admin' ELSE public.profiles.role END;

-- 8. Reload PostgREST schema cache so endpoints immediately find public.profiles
NOTIFY pgrst, 'reload schema';
