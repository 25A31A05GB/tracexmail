-- ==============================================================================
-- TraceXMail Migration: Case Notes with Role-Based Access Control
-- ==============================================================================

CREATE TABLE IF NOT EXISTS case_notes (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id),
    author_email TEXT NOT NULL,
    label TEXT NOT NULL CHECK (label IN ('Confirmed Phish', 'False Positive', 'Escalated', 'Needs Follow-up', 'Resolved', 'Informational')),
    body TEXT NOT NULL CHECK (char_length(body) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_org_id ON case_notes(organization_id);

ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes in their organization"
    ON case_notes FOR SELECT
    USING (organization_id = auth_user_org_id());

CREATE POLICY "Analysts and admins can add notes in their organization"
    ON case_notes FOR INSERT
    WITH CHECK (organization_id = auth_user_org_id() AND auth_user_role() IN ('admin', 'analyst'));

CREATE POLICY "Authors and admins can delete their own notes"
    ON case_notes FOR DELETE
    USING (organization_id = auth_user_org_id() AND (author_id = auth.uid() OR auth_user_role() = 'admin'));
