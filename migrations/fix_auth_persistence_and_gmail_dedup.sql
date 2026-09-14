-- ==============================================================================
-- TraceXMail Migration: Auth Ephemeral Tokens Persistence & Gmail Dedup Ledger
-- Migration File: migrations/fix_auth_persistence_and_gmail_dedup.sql
-- ==============================================================================
-- 1. Run this script in the Supabase SQL Editor or via psql $DATABASE_URL.
-- 2. It persists OTPs, magic-links, and password-reset tokens across server restarts.
-- 3. It establishes a processed-message ledger to prevent redundant Gmail analysis.
-- 4. It records watch teardown timestamps in gmail_connections.
-- ==============================================================================

-- 1. Auth Ephemeral Tokens Table
-- Stores verification OTPs, passwordless magic links, and password recovery tokens
CREATE TABLE IF NOT EXISTS auth_ephemeral_tokens (
    token TEXT PRIMARY KEY,
    token_type TEXT NOT NULL CHECK (token_type IN ('otp', 'magic_link', 'reset', 'signup', 'recovery', 'signin', 'invite')),
    email TEXT NOT NULL,
    code TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    attempts INTEGER DEFAULT 0,
    used BOOLEAN DEFAULT FALSE,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_ephemeral_tokens_email ON auth_ephemeral_tokens(email);
CREATE INDEX IF NOT EXISTS idx_auth_ephemeral_tokens_type ON auth_ephemeral_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_auth_ephemeral_tokens_expires ON auth_ephemeral_tokens(expires_at);

-- Enable RLS on auth_ephemeral_tokens
ALTER TABLE auth_ephemeral_tokens ENABLE ROW LEVEL SECURITY;

-- Allow service_role complete clearance to manage ephemeral tokens
DROP POLICY IF EXISTS "Service role manage auth_ephemeral_tokens" ON auth_ephemeral_tokens;
CREATE POLICY "Service role manage auth_ephemeral_tokens"
    ON auth_ephemeral_tokens FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 2. Gmail Processed Messages Ledger
-- Prevents duplicate ingestion loops, rate limits, and 429s on unread mailbox sync
CREATE TABLE IF NOT EXISTS gmail_processed_messages (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    thread_id TEXT,
    queue_id TEXT,
    case_id TEXT,
    threat_score INTEGER,
    quarantined BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_gmail_processed_messages UNIQUE (organization_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_gmail_processed_messages_org_msg ON gmail_processed_messages(organization_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_processed_messages_processed_at ON gmail_processed_messages(processed_at DESC);

-- Enable RLS on gmail_processed_messages
ALTER TABLE gmail_processed_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view processed messages in their organization" ON gmail_processed_messages;
CREATE POLICY "Users can view processed messages in their organization"
    ON gmail_processed_messages FOR SELECT
    USING (organization_id = auth_user_org_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role and pipeline can manage processed messages" ON gmail_processed_messages;
CREATE POLICY "Service role and pipeline can manage processed messages"
    ON gmail_processed_messages FOR ALL
    USING (auth.role() = 'service_role' OR organization_id = auth_user_org_id())
    WITH CHECK (auth.role() = 'service_role' OR organization_id = auth_user_org_id());


-- 3. Add watch_stopped_at to gmail_connections table
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS watch_stopped_at TIMESTAMPTZ;
