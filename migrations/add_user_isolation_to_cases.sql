-- ==============================================================================
-- Migration: Add User Isolation and Multi-Tenancy Columns to Cases Table
-- Allows each user account to maintain their own isolated forensic cases and records
-- ==============================================================================

-- 1. Add user isolation columns to cases if they do not exist
ALTER TABLE IF EXISTS public.cases 
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS user_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Create performance indexes for user-scoped case queries
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_user_email ON public.cases(user_email);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases(created_by);

-- 3. Update RLS policies for strict user-to-user data isolation
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cases in their organization or demo cases" ON public.cases;
DROP POLICY IF EXISTS "Users can view their own cases or demo cases" ON public.cases;

CREATE POLICY "Users can view their own cases or demo cases"
  ON public.cases FOR SELECT
  USING (
    is_demo = true OR
    user_id = auth.uid()::text OR
    created_by = auth.uid()::text OR
    user_email = (auth.jwt()->>'email') OR
    (assigned_user IS NOT NULL AND assigned_user = (auth.jwt()->>'email')) OR
    (
      organization_id IS NOT NULL 
      AND organization_id != 'org_acme_soc_01'
      AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    ) OR
    auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Analysts and Admins can insert cases into their organization" ON public.cases;
DROP POLICY IF EXISTS "Users can insert their own cases" ON public.cases;

CREATE POLICY "Users can insert their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text OR
    created_by = auth.uid()::text OR
    user_email = (auth.jwt()->>'email') OR
    auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users can update their own cases" ON public.cases;

CREATE POLICY "Users can update their own cases"
  ON public.cases FOR UPDATE
  USING (
    user_id = auth.uid()::text OR
    created_by = auth.uid()::text OR
    user_email = (auth.jwt()->>'email') OR
    (auth.jwt()->>'role') = 'admin' OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    user_id = auth.uid()::text OR
    created_by = auth.uid()::text OR
    user_email = (auth.jwt()->>'email') OR
    (auth.jwt()->>'role') = 'admin' OR
    auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users can delete their own cases" ON public.cases;

CREATE POLICY "Users can delete their own cases"
  ON public.cases FOR DELETE
  USING (
    user_id = auth.uid()::text OR
    created_by = auth.uid()::text OR
    (auth.jwt()->>'role') = 'admin' OR
    auth.role() = 'service_role'
  );
