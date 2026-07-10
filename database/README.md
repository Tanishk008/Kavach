# Kavach — Database Layer

Two data stores, each chosen for what it's best at:

| Store | Holds | Why |
|---|---|---|
| **PostgreSQL** | users, risk profiles, community reports, verified caller registry, classification events, case files, hotspot events | Relational integrity, reporting, aggregation |
| **Neo4j** | phone numbers, UPI IDs, accounts, device fingerprints, reports as nodes; shared-identifier edges | Native graph traversal to cluster fraud rings |

## Layout

```
database/
├── postgres/
│   ├── schema.sql     # canonical DDL (source of truth for tables)
│   └── seed.sql       # sample verified + reported numbers, a demo user
├── neo4j/
│   ├── schema.cypher  # constraints + indexes
│   └── seed.cypher    # a ~40-report fraud ring for demos
└── migrations/        # Alembic versioned migrations (backend owns the config)
```

## Run with Docker (recommended)

`docker compose up` (from repo root) starts both stores. Postgres auto-runs
`schema.sql` then `seed.sql` on first boot. Load the Neo4j seed once it's up:

```bash
cat database/neo4j/schema.cypher database/neo4j/seed.cypher | \
  docker compose exec -T neo4j cypher-shell -u neo4j -p kavach_dev_password
```

## Run manually (local installs)

```bash
# PostgreSQL
psql "postgresql://kavach:kavach_dev_password@localhost:5432/kavach" -f postgres/schema.sql
psql "postgresql://kavach:kavach_dev_password@localhost:5432/kavach" -f postgres/seed.sql

# Neo4j
cypher-shell -u neo4j -p kavach_dev_password -f neo4j/schema.cypher
cypher-shell -u neo4j -p kavach_dev_password -f neo4j/seed.cypher
```

## Migrations

`schema.sql` is the human-readable source of truth. Incremental changes are managed with
Alembic from the backend (`backend/alembic.ini` → `database/migrations`):

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```
