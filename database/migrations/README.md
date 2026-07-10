# Alembic migrations

Versioned PostgreSQL migrations live in `versions/`. Alembic is configured from the backend
(`backend/alembic.ini`, `backend/app/db/session.py` provides the metadata & URL).

```bash
cd ../../backend
alembic revision --autogenerate -m "add xyz"   # generate from ORM model changes
alembic upgrade head                            # apply
alembic downgrade -1                            # roll back one
```

`../postgres/schema.sql` remains the readable source of truth; keep the two in sync.
