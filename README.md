# Kavach — AI Shield Against Digital Fraud

Kavach is an AI-powered Digital Public Safety platform that protects Indian citizens from
phone scams, fraud messages, counterfeit currency, and digital-arrest scams — and gives law
enforcement fraud-network intelligence. It shifts from *reactive case investigation* to
*proactive threat neutralisation*.

> **One classifier core. One graph. One map. One dashboard. Three front doors (app, WhatsApp, phone/IVR).**
> Every feature either feeds data into this shared intelligence layer or draws a decision out of it.

## Repository structure

This project is organised into **three primary layers**:

```
Kavach Prototype/
├── frontend/    # React + Vite + Tailwind mobile-first citizen app
├── backend/     # Python FastAPI — the shared classifier core + all APIs
└── database/    # PostgreSQL (relational) + Neo4j (fraud network graph) schema, seed, migrations
```

| Layer | Tech | Responsibility |
|---|---|---|
| `frontend/` | React + Vite + TypeScript + Tailwind | Mobile-first citizen UI (all Kavach screens) |
| `backend/`  | FastAPI (Python) | Auth, the shared classifier core, number intel, currency, graph, evidence |
| `database/` | PostgreSQL + Neo4j | Users/reports/registry/cases (SQL) + fraud rings (graph) |

## Quick start (Docker — everything at once)

```bash
cp .env.example .env
docker compose up --build
```

Then:
- Frontend → http://localhost:5173
- Backend API docs → http://localhost:8000/docs
- Neo4j browser → http://localhost:7474  (user `neo4j`, password from `.env`)
- PostgreSQL → localhost:5432

## Quick start (local dev, per layer)

See the README inside each folder:
- [frontend/README.md](frontend/README.md)
- [backend/README.md](backend/README.md)
- [database/README.md](database/README.md)

## Architecture at a glance

```
                 ┌─────────────────────────────────────────────┐
   App  ─────────►                                             │
   WhatsApp ─────►   FastAPI backend  (backend/app)            │
   IVR  ─────────►                                             │
                 │   ┌──────────────────────────────────────┐  │
                 │   │  Classifier core (services/classifier)│  │  ◄── the one brain
                 │   └──────────────────────────────────────┘  │
                 │     │ number_intel │ currency │ evidence     │
                 │     │ graph_service ────────────┐            │
                 └─────┼───────────────────────────┼───────────┘
                       ▼                           ▼
              PostgreSQL (users, reports,     Neo4j (fraud
              registry, events, cases)        network graph)
```

## Build status / scope

This is a **working scaffold**. Wiring, contracts, and one full vertical slice
(Check a Message → classifier → DB) are real. Heavy AI components — LLM classification,
OCR, Whisper transcription, currency CNN, voice-deepfake detection, and the IVR/WhatsApp
webhooks — are **stubbed with deterministic mock outputs and clear `TODO` markers** so the
team can plug in real models/providers without changing the surrounding structure.

See [Kavach_Complete_Feature_Flow_Spec.md](Kavach_Complete_Feature_Flow_Spec.md) for the full feature spec.
