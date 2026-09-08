# Nirman Drushti Backend

Backend foundation for Nirman Drushti, an AI-powered infrastructure project risk intelligence platform. This phase provides the FastAPI application boundary, environment configuration, PostgreSQL-ready SQLAlchemy session setup, Alembic migration wiring, and versioned route placeholders.

No project records, government statistics, PAIMANA integration, risk scores, or ML predictions are implemented in this foundation.

## Architecture

```text
backend/
├── app/
│   ├── main.py
│   ├── core/          # settings and SQLAlchemy infrastructure
│   ├── api/            # /api/v1 route composition
│   ├── models/         # future SQLAlchemy models
│   ├── schemas/        # future Pydantic contracts
│   └── services/       # future application services
├── alembic/            # migration environment; no domain migrations yet
├── tests/
├── requirements.txt
└── .env.example
```

## Stack

- Python 3.11.9
- FastAPI and Uvicorn
- Pydantic v2 and Pydantic Settings
- SQLAlchemy 2.0 and Alembic
- PostgreSQL via `psycopg[binary]`
- Pandas and NumPy reserved for future data preparation
- Pytest and HTTPX

## Setup

From `D:\SIH project\backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Python 3.11.9 is required for this development foundation. Do not put credentials in `.env.example` or source control.

## Environment

- `APP_ENV`: application environment, defaults to `development`.
- `DATABASE_URL`: SQLAlchemy PostgreSQL URL, for example `postgresql+psycopg://user:password@localhost:5432/nirman_drushti`.
- `CORS_ORIGINS`: comma-separated frontend origins. The default permits local Next.js development on ports 3000.
- `LOG_LEVEL`: standard logging level, defaults to `INFO`.

The health endpoint does not open a database connection, so it can be tested before PostgreSQL is available.

## Run

```powershell
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`.

- Health: `GET /health`
- Swagger UI: `/docs`
- OpenAPI JSON: `/openapi.json`
- Versioned route groups: `/api/v1/projects`, `/risk`, `/cost`, `/analytics`, `/data`, `/warnings`

The versioned groups currently return `501 Not Implemented` rather than fabricated business data.

## Database and Alembic

The SQLAlchemy engine and session dependency are defined in `app/core/database.py`. Importing the application does not require a reachable PostgreSQL server.

No business tables or initial migration are created yet. Once models are introduced:

```powershell
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

For offline SQL generation:

```powershell
alembic upgrade head --sql
```

## Tests

```powershell
pytest
```

The health test uses FastAPI `TestClient` and does not require PostgreSQL.
