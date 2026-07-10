-- ============================================================================
-- Kavach — PostgreSQL seed data (demo / development)
-- ============================================================================

-- ── Verified caller registry (whitelist) ──────────────────────────────────────
-- A mix of toll-free helplines and a genuine 1600-series verified service
-- number, so the "verified" tier demo covers both number formats TRAI
-- recognises as legitimate institutional calling patterns.
INSERT INTO verified_registry (phone_number, institution, category) VALUES
    ('18001801290',  'State Bank of India — Official Helpline', 'bank'),
    ('18004253800',  'Canara Bank — Customer Care', 'bank'),
    ('112',          'National Emergency Response — 112', 'police'),
    ('1930',         'National Cyber Crime Helpline — 1930', 'helpline'),
    ('1800110000',   'Reserve Bank of India — Public Grievance', 'bank'),
    ('16001234567',  'HDFC Bank — Verified Transactional Line (1600 series)', 'bank'),
    ('18001034455',  'Life Insurance Corporation of India (LIC) — Customer Care', 'insurance'),
    ('18001801947',  'Unique Identification Authority of India (UIDAI) — Aadhaar Helpline', 'government'),
    ('139',          'Indian Railways — IRCTC / Rail Enquiry', 'government'),
    ('18001801551',  'Income Tax Department — e-Filing Helpdesk', 'government')
ON CONFLICT (phone_number) DO NOTHING;

-- ── Community reports (blacklist / crowdsourced) ──────────────────────────────

-- A number heavily reported for CBI/digital-arrest impersonation. Seeded with
-- 40+ independent reports so the "reported_scam" tier demo reflects a
-- realistic, statistically confident crowd-sourced verdict rather than a
-- token handful of rows.
INSERT INTO community_reports (identifier, identifier_type, category, note)
SELECT '9198765432', 'phone', 'digital_arrest', note
FROM unnest(ARRAY[
    'Claimed to be CBI officer, demanded clearance fee',
    'Video call, said Aadhaar linked to money laundering',
    'Threatened arrest unless UPI payment made immediately',
    'Caller claimed parcel with drugs seized in my name at customs',
    'Impersonated Mumbai Police cybercrime cell, asked to stay on camera',
    'Said a warrant was issued and I must not disconnect the call',
    'Demanded I install a screen-sharing app to "verify" my account',
    'Threatened to freeze my bank account unless I paid a fine',
    'Claimed to be from Narcotics Control Bureau, cited a fake FIR number',
    'Asked me to transfer funds to a "RBI monitored" account for safekeeping',
    'Told me not to tell any family member or lawyer about the call',
    'Used a fake CBI ID card shown over video call',
    'Said my number was used in a SIM card fraud case in another state',
    'Pressured me for over an hour to stay on the call without hanging up'
]) AS note
CROSS JOIN generate_series(1, 3) AS rep_no
ON CONFLICT DO NOTHING;

-- Same digital-arrest number also cross-reported as generic impersonation,
-- reflecting how real victims often file reports under multiple categories.
INSERT INTO community_reports (identifier, identifier_type, category, note) VALUES
    ('9198765432', 'phone', 'impersonation', 'Impersonated a government law-enforcement officer'),
    ('9198765432', 'phone', 'impersonation', 'Used fake police station background on video call')
ON CONFLICT DO NOTHING;

-- UPI handle used across a linked digital-arrest / investment fraud ring.
INSERT INTO community_reports (identifier, identifier_type, category, note) VALUES
    ('scammer@okaxis', 'upi', 'digital_arrest', 'UPI given by fake CBI officer for "clearance fee"'),
    ('scammer@okaxis', 'upi', 'digital_arrest', 'Same handle used in a second digital-arrest attempt'),
    ('scammer@okaxis', 'upi', 'investment_fraud', 'Same UPI used in a fake trading/investment scheme'),
    ('scammer@okaxis', 'upi', 'investment_fraud', 'Requested payment to this UPI for "guaranteed returns"')
ON CONFLICT DO NOTHING;

-- Fake instant-loan app recovery-threat number.
INSERT INTO community_reports (identifier, identifier_type, category, note) VALUES
    ('9111122233', 'phone', 'loan_fraud', 'Fake instant-loan app recovery threats'),
    ('9111122233', 'phone', 'loan_fraud', 'Threatened to contact contacts list over a small unpaid loan'),
    ('9111122233', 'phone', 'spam', 'Repeated unsolicited loan offers')
ON CONFLICT DO NOTHING;

-- A 140-series telemarketing number with a couple of spam complaints — below
-- the reported_scam threshold, so it demonstrates the "unwanted_not_confirmed"
-- verdict driven by real (if sparse) community feedback rather than the
-- promotional-series structural fallback.
INSERT INTO community_reports (identifier, identifier_type, category, note) VALUES
    ('1409876543', 'phone', 'spam', 'Repeated unsolicited insurance sales calls'),
    ('1409876543', 'phone', 'spam', 'Called multiple times a day despite DND registration')
ON CONFLICT DO NOTHING;

-- ── A demo user ───────────────────────────────────────────────────────────────
INSERT INTO users (phone_number, status, risk_profile, digital_comfort, age_group, preferred_language)
VALUES ('9990001234', 'active', 'senior_conservative', 'beginner', '60_plus', 'hi')
ON CONFLICT (phone_number) DO NOTHING;
