-- ==============================================================================
-- TraceXMail Migration: Create Profiles Table and Refresh Schema Cache
-- Migration File: migrations/create_profiles_and_schema_cache_fix.sql
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor)
-- 1. Creates the default organization if not present
-- 2. Creates the `public.profiles` table linked to `auth.users`
-- 3. Configures Row Level Security (RLS) for authenticated users and service_role
-- 4. Reloads the PostgREST schema cache so the table is immediately recognized
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

-- 2. Create public.profiles table
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

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles in their organization
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
    ON public.profiles FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Allow service_role complete access to profiles
DROP POLICY IF EXISTS "Service role full access to profiles" ON public.profiles;
CREATE POLICY "Service role full access to profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 4. Automatically provision profile when a new user signs up via auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    user_name TEXT;
    org_id TEXT;
BEGIN
    -- Determine role (default admin for recognized owner, otherwise analyst)
    IF NEW.email IN ('ramofyou@gmail.com', 'jayramsappa537@gmail.com') THEN
        assigned_role := 'admin';
    ELSIF NEW.raw_user_meta_data->>'role' IN ('admin', 'analyst', 'read_only') THEN
        assigned_role := NEW.raw_user_meta_data->>'role';
    ELSE
        assigned_role := 'analyst';
    END IF;

    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    org_id := COALESCE(NEW.raw_user_meta_data->>'organization_id', 'org_acme_soc_01');

    INSERT INTO public.profiles (id, email, organization_id, role, full_name, email_verified)
    VALUES (NEW.id, NEW.email, org_id, assigned_role, user_name, TRUE)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute upon new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill any existing auth.users who don't have a profile yet
INSERT INTO public.profiles (id, email, organization_id, role, full_name, email_verified)
SELECT
    u.id,
    u.email,
    'org_acme_soc_01',
    CASE
        WHEN u.email IN ('ramofyou@gmail.com', 'jayramsappa537@gmail.com') THEN 'admin'
        WHEN u.raw_user_meta_data->>'role' IN ('admin', 'analyst', 'read_only') THEN u.raw_user_meta_data->>'role'
        ELSE 'analyst'
    END,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    TRUE
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 5. Notify PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
