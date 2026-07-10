# Kavach — Backend (FastAPI)

The shared **classifier core** and all APIs. Every front door (app, WhatsApp, IVR) hits the
same endpoints here, so there is exactly one place where fraud logic lives.

## Layered architecture

```
app/
├── main.py            # FastAPI app, CORS, router registration, lifespan
├── config.py          # env-driven settings (pydantic-settings)
├── db/
│   ├── session.py     # SQLAlchemy engine + session dependency (Postgres)
│   └── neo4j_client.py# Neo4j driver wrapper
├── models/            # SQLAlchemy ORM (mirror of database/postgres/schema.sql)
├── schemas/           # Pydantic request/response contracts
├── api/
│   ├── deps.py        # shared FastAPI dependencies
│   └── routers/       # one router per domain (auth, numbers, messages, pay, currency,
│                      #   reports, map, graph)
├── services/          # business logic (classifier, number_intel, graph, currency, evidence)
└── core/              # playbooks, security helpers
```

**Flow:** router (HTTP) → service (logic) → models/db (data). Routers never touch the DB
directly; services own that.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # point at your local Postgres/Neo4j
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## The one working vertical slice

`POST /api/messages/classify` is wired end-to-end:
router → `services/classifier.classify_text()` → tiered verdict + reasons + matched
playbook → persists an `events` row → extracts entities into the Neo4j graph.

The classifier uses a **deterministic keyword mock** when `LLM_API_KEY` is unset, so the
whole path runs with zero external dependencies. Swap in a real LLM call inside
`services/classifier.py` (marked with `TODO`).

## What's stubbed

`currency`, voice-deepfake, OCR, WhatsApp/IVR webhooks, and full graph
clustering return structured mock data behind the real request/response contracts — grep
for `TODO` to find each integration point.

## OTP SMS

`POST /api/auth/send-otp` generates a real random OTP and sends it through the configured
SMS gateway. Set `SMS_PROVIDER=msg91` with `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`, or
set `SMS_PROVIDER=twilio` with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_FROM_NUMBER`. If no provider is configured, the endpoint returns `503` instead of
pretending that a message was sent.
