"""Seed the local SQLite dev database (kavach.db).

database/postgres/seed.sql only runs against a real Postgres instance. Local
dev uses SQLite by default (USE_SQLITE=true in .env), which never sees that
file — this script mirrors the same demo dataset directly through the
SQLAlchemy models so `python seed_dev.py` gives a fresh SQLite dev DB the
same fraud-report/verified-registry data Postgres would get from seed.sql.

Idempotent: safe to run repeatedly, skips rows that already exist.
"""
from app.db.session import SessionLocal, create_tables
from app.models import CommunityReport, User, VerifiedNumber

VERIFIED_NUMBERS = [
    ("18001801290", "State Bank of India — Official Helpline", "bank"),
    ("18004253800", "Canara Bank — Customer Care", "bank"),
    ("112", "National Emergency Response — 112", "police"),
    ("1930", "National Cyber Crime Helpline — 1930", "helpline"),
    ("1800110000", "Reserve Bank of India — Public Grievance", "bank"),
    ("16001234567", "HDFC Bank — Verified Transactional Line (1600 series)", "bank"),
    ("18001034455", "Life Insurance Corporation of India (LIC) — Customer Care", "insurance"),
    ("18001801947", "Unique Identification Authority of India (UIDAI) — Aadhaar Helpline", "government"),
    ("139", "Indian Railways — IRCTC / Rail Enquiry", "government"),
    ("18001801551", "Income Tax Department — e-Filing Helpdesk", "government"),
]

_DIGITAL_ARREST_NOTES = [
    "Claimed to be CBI officer, demanded clearance fee",
    "Video call, said Aadhaar linked to money laundering",
    "Threatened arrest unless UPI payment made immediately",
    "Caller claimed parcel with drugs seized in my name at customs",
    "Impersonated Mumbai Police cybercrime cell, asked to stay on camera",
    "Said a warrant was issued and I must not disconnect the call",
    'Demanded I install a screen-sharing app to "verify" my account',
    "Threatened to freeze my bank account unless I paid a fine",
    "Claimed to be from Narcotics Control Bureau, cited a fake FIR number",
    'Asked me to transfer funds to a "RBI monitored" account for safekeeping',
    "Told me not to tell any family member or lawyer about the call",
    "Used a fake CBI ID card shown over video call",
    "Said my number was used in a SIM card fraud case in another state",
    "Pressured me for over an hour to stay on the call without hanging up",
]

COMMUNITY_REPORTS = [
    # (identifier, identifier_type, category, note) — digital-arrest number,
    # repeated x3 per note for 42 total rows, matching seed.sql's generate_series(1,3).
    *[
        ("9198765432", "phone", "digital_arrest", note)
        for note in _DIGITAL_ARREST_NOTES
        for _ in range(3)
    ],
    ("9198765432", "phone", "impersonation", "Impersonated a government law-enforcement officer"),
    ("9198765432", "phone", "impersonation", "Used fake police station background on video call"),
    ("scammer@okaxis", "upi", "digital_arrest", 'UPI given by fake CBI officer for "clearance fee"'),
    ("scammer@okaxis", "upi", "digital_arrest", "Same handle used in a second digital-arrest attempt"),
    ("scammer@okaxis", "upi", "investment_fraud", "Same UPI used in a fake trading/investment scheme"),
    ("scammer@okaxis", "upi", "investment_fraud", 'Requested payment to this UPI for "guaranteed returns"'),
    ("9111122233", "phone", "loan_fraud", "Fake instant-loan app recovery threats"),
    ("9111122233", "phone", "loan_fraud", "Threatened to contact contacts list over a small unpaid loan"),
    ("9111122233", "phone", "spam", "Repeated unsolicited loan offers"),
    ("1409876543", "phone", "spam", "Repeated unsolicited insurance sales calls"),
    ("1409876543", "phone", "spam", "Called multiple times a day despite DND registration"),
]

DEMO_USER = ("9990001234", "active", "senior_conservative", "beginner", "60_plus", "hi")


def seed() -> None:
    create_tables()
    db = SessionLocal()
    try:
        existing_numbers = {n for (n,) in db.query(VerifiedNumber.phone_number).all()}
        for phone, institution, category in VERIFIED_NUMBERS:
            if phone not in existing_numbers:
                db.add(VerifiedNumber(phone_number=phone, institution=institution, category=category))

        existing_report_count = db.query(CommunityReport).count()
        if existing_report_count == 0:
            for identifier, id_type, category, note in COMMUNITY_REPORTS:
                db.add(CommunityReport(
                    identifier=identifier, identifier_type=id_type, category=category, note=note,
                ))
        else:
            print(f"Skipping community_reports seed — {existing_report_count} rows already present.")

        phone, status, risk_profile, digital_comfort, age_group, lang = DEMO_USER
        if not db.query(User).filter(User.phone_number == phone).first():
            db.add(User(
                phone_number=phone, status=status, risk_profile=risk_profile,
                digital_comfort=digital_comfort, age_group=age_group, preferred_language=lang,
            ))

        db.commit()
        print("Seed complete:")
        print(f"  verified_registry: {db.query(VerifiedNumber).count()} rows")
        print(f"  community_reports: {db.query(CommunityReport).count()} rows")
        print(f"  users: {db.query(User).count()} rows")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
