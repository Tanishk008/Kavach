-- ============================================================================
-- Kavach — PostgreSQL schema (canonical DDL, source of truth)
-- ============================================================================
-- Core relational data. The fraud network graph lives in Neo4j (see ../neo4j).
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE risk_profile AS ENUM ('senior_conservative', 'standard', 'advanced');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE verdict_tier AS ENUM ('safe', 'caution', 'high_risk');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE number_verdict AS ENUM (
        'verified', 'reported_scam', 'high_risk_pattern',
        'unwanted_not_confirmed', 'unknown_neutral'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE channel AS ENUM ('app', 'whatsapp', 'ivr');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Users & onboarding ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number        VARCHAR(15) UNIQUE NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'onboarding_incomplete',
    risk_profile        risk_profile NOT NULL DEFAULT 'standard',
    digital_comfort     VARCHAR(32),          -- beginner | comfortable | very_comfortable
    age_group           VARCHAR(16),          -- under_30 | 30_60 | 60_plus
    preferred_language  VARCHAR(32) DEFAULT 'en',
    protection_level    VARCHAR(32) DEFAULT 'standard', -- extra_cautious | standard | advanced
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    phone_number  VARCHAR(15) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mock OTP store (production: SMS gateway handles delivery/verification)
CREATE TABLE IF NOT EXISTS otp_codes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number  VARCHAR(15) NOT NULL,
    code          VARCHAR(6) NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    consumed      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone_number);

-- ── Verified caller registry (B.4) — the whitelist ────────────────────────────
CREATE TABLE IF NOT EXISTS verified_registry (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number  VARCHAR(15) UNIQUE NOT NULL,
    institution   VARCHAR(200) NOT NULL,      -- e.g. "State Bank of India — Collections"
    category      VARCHAR(64) NOT NULL,       -- bank | police | cbi | ed | customs | helpline
    verified_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Community reports (A.2 / B.1) — the blacklist / crowdsource ────────────────
CREATE TABLE IF NOT EXISTS community_reports (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier     VARCHAR(64) NOT NULL,      -- phone / UPI id / account number
    identifier_type VARCHAR(16) NOT NULL,     -- phone | upi | account
    category       VARCHAR(48) NOT NULL,      -- digital_arrest | loan_fraud | investment | spam | other
    reported_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_identifier ON community_reports(identifier);

-- ── Classification events (A.3 / B.6) — every classifier verdict ──────────────
-- The feed that powers the pattern dashboard, hotspot map, and graph.
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    channel         channel NOT NULL DEFAULT 'app',
    input_type      VARCHAR(16) NOT NULL,     -- text | image | voice | number | payment
    content_excerpt TEXT,                     -- redacted/short excerpt for audit
    tier            verdict_tier NOT NULL,
    confidence      REAL,
    scam_type       VARCHAR(64),
    reasons         JSONB,
    matched_playbook_id VARCHAR(64),
    -- coarse location (city/PIN level) only, and only with consent → hotspot map
    region_city     VARCHAR(120),
    region_pin      VARCHAR(10),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_scam_type ON events(scam_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_region ON events(region_city);

-- ── Case files / evidence export (B.8) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    payload         JSONB NOT NULL,           -- full structured evidence bundle
    sha256_hash     CHAR(64) NOT NULL,        -- tamper-evidence over payload
    cluster_ref     VARCHAR(64),              -- Neo4j cluster id if part of a ring
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Currency checks (A.4) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currency_checks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    denomination   VARCHAR(8),               -- 10/20/50/100/200/500/2000
    authenticity   VARCHAR(16),              -- real | fake | uncertain
    confidence     REAL,
    features_checked JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── updated_at trigger for users ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
