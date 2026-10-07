-- ==============================================================================
-- SecuAI Supabase PostgreSQL Schema & Security Infrastructure Migration
-- Architecture: Multi-tenant, strict Row Level Security (RLS) on all tables.
-- Zero Redis/BullMQ: background worker executes scans via polling Postgres.
-- ==============================================================================

-- 0. Ensure auth schema and helpers exist (supports both Supabase & local Postgres)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE public.finding_status AS ENUM (
        'OPEN',
        'FIX_PROPOSED',
        'FIX_APPLIED',
        'VERIFIED',
        'REGRESSED',
        'INCONCLUSIVE',
        'ACCEPTED_RISK',
        'FALSE_POSITIVE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.scan_status AS ENUM (
        'QUEUED',
        'RUNNING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.severity AS ENUM (
        'CRITICAL',
        'HIGH',
        'MEDIUM',
        'LOW',
        'INFO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.source_type AS ENUM (
        'ZIP',
        'GITHUB',
        'URL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    source_type public.source_type NOT NULL DEFAULT 'ZIP',
    repository_url TEXT,
    repo_url TEXT,
    framework TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Scans Table
CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    status public.scan_status NOT NULL DEFAULT 'QUEUED',
    progress_step TEXT,
    storage_path TEXT,
    workspace_path TEXT,
    security_score INTEGER DEFAULT 100,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Findings Table (Stores Real isitsecure Normalized Findings)
CREATE TABLE IF NOT EXISTS public.findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    severity public.severity NOT NULL,
    confidence NUMERIC NOT NULL DEFAULT 0.8,
    source TEXT NOT NULL,
    file_path TEXT,
    line_start INTEGER,
    line_end INTEGER,
    endpoint TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    status public.finding_status NOT NULL DEFAULT 'OPEN',
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. AI Analysis Table (Gemini Server-Side Explanations & Diff Proposals)
CREATE TABLE IF NOT EXISTS public.ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL UNIQUE REFERENCES public.findings(id) ON DELETE CASCADE,
    fingerprint TEXT,
    model TEXT,
    root_cause TEXT,
    blast_radius TEXT,
    proposed_diff TEXT,
    proposed_fix TEXT,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Verification Runs Table (Scanner Deterministic Patch Verification)
CREATE TABLE IF NOT EXISTS public.verification_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
    verdict TEXT NOT NULL,
    scanner_name TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    message TEXT,
    diff_applied TEXT,
    previous_status TEXT,
    new_status TEXT,
    evidence JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_runs ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE public.verification_runs ADD COLUMN IF NOT EXISTS new_status TEXT;
ALTER TABLE public.verification_runs ADD COLUMN IF NOT EXISTS evidence JSONB;

-- ==============================================================================
-- 7. Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON public.findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_fingerprint ON public.findings(fingerprint);
CREATE INDEX IF NOT EXISTS idx_scans_project_id_created_at_desc ON public.scans(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON public.scans(status);

-- ==============================================================================
-- 8. Row Level Security (RLS) on ALL tables
-- Policy rule: USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
-- ==============================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.findings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis FORCE ROW LEVEL SECURITY;
ALTER TABLE public.verification_runs FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "projects_tenant_policy" ON public.projects;
DROP POLICY IF EXISTS "scans_tenant_policy" ON public.scans;
DROP POLICY IF EXISTS "findings_tenant_policy" ON public.findings;
DROP POLICY IF EXISTS "ai_analysis_tenant_policy" ON public.ai_analysis;
DROP POLICY IF EXISTS "verification_runs_tenant_policy" ON public.verification_runs;

CREATE POLICY "projects_tenant_policy" ON public.projects
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "scans_tenant_policy" ON public.scans
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "findings_tenant_policy" ON public.findings
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_analysis_tenant_policy" ON public.ai_analysis
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "verification_runs_tenant_policy" ON public.verification_runs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role bypass for background workers
DROP POLICY IF EXISTS "service_role_projects" ON public.projects;
DROP POLICY IF EXISTS "service_role_scans" ON public.scans;
DROP POLICY IF EXISTS "service_role_findings" ON public.findings;
DROP POLICY IF EXISTS "service_role_ai_analysis" ON public.ai_analysis;
DROP POLICY IF EXISTS "service_role_verification_runs" ON public.verification_runs;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE POLICY "service_role_projects" ON public.projects FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY "service_role_scans" ON public.scans FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY "service_role_findings" ON public.findings FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY "service_role_ai_analysis" ON public.ai_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY "service_role_verification_runs" ON public.verification_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- 9. Storage Bucket & Policy
-- Storage bucket `uploads` private; policy: path prefix = auth.uid()
-- ==============================================================================
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT,
    owner UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "uploads_user_prefix_policy" ON storage.objects;

CREATE POLICY "uploads_user_prefix_policy" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'uploads' AND 
        name LIKE (auth.uid()::text || '/%')
    )
    WITH CHECK (
        bucket_id = 'uploads' AND 
        name LIKE (auth.uid()::text || '/%')
    );

-- ==============================================================================
-- 10. Atomic Job Claim Function for Worker (Postgres FOR UPDATE SKIP LOCKED)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_next_scan()
RETURNS SETOF public.scans
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.scans
  SET status = 'RUNNING', started_at = now(), progress_step = 'Preparing'
  WHERE id = (
    SELECT id FROM public.scans
    WHERE status = 'QUEUED'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
$$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.claim_next_scan() TO service_role;
    END IF;
END $$;

