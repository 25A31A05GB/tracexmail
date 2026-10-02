-- ==============================================================================
-- TraceXMail Migration: Gemini SOC Analyst Reports & Campaign AI Narratives
-- ==============================================================================

-- 1. Add soc_report jsonb column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS soc_report JSONB;

-- 2. Create immutable soc_reports table for evidence lineage & audit tracking
CREATE TABLE IF NOT EXISTS soc_reports (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    organization_id TEXT,
    created_by UUID,
    created_by_email TEXT,
    model_used TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT 'soc_report_v1.0',
    report_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc_reports_case_id ON soc_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_soc_reports_org_id ON soc_reports(organization_id);

-- 3. Create campaign_ai_narratives table for campaign cluster intelligence
CREATE TABLE IF NOT EXISTS campaign_ai_narratives (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    organization_id TEXT,
    created_by UUID,
    created_by_email TEXT,
    model_used TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT 'campaign_narrative_v1.0',
    narrative_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_narratives_campaign_id ON campaign_ai_narratives(campaign_id);
