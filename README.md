# Nirman Drushti

> Infrastructure intelligence for earlier, clearer project monitoring.

Nirman Drushti is an explainable infrastructure intelligence platform
that organizes project-monitoring data, calculates transparent project
indicators, and provides a foundation for predictive risk analysis and
early warnings.

## Product Idea

``` text
DATA → WHY → PREDICT → EXPLAIN → WARN → ACT
```

## Current Capabilities

-   Project registry
-   Project search and filtering
-   Project details
-   Historical progress
-   Historical cost
-   Cost intelligence
-   Schedule information
-   Data provenance
-   PostgreSQL-backed APIs

## Planned Capabilities

-   Cost-overrun prediction
-   Time-overrun prediction
-   Project risk scoring
-   SHAP explanations
-   Early warnings
-   Portfolio analytics
-   Benchmarking
-   What-if analysis
-   Optional project intelligence assistant

## Data Source

PAIMANA / Infrastructure & Project Monitoring Division, Ministry of
Statistics and Programme Implementation, Government of India.

Official sources: - https://ipm.mospi.gov.in/ -
https://ipm.mospi.gov.in/Home/PublicDashboard -
https://ipm.mospi.gov.in/AboutUs/AboutIPMD -
https://ipm.mospi.gov.in/AboutUs/AboutOCMS

## Architecture

``` text
PAIMANA / OCMS Reports
          ↓
     Data Pipeline
          ↓
   Cleaning & Matching
          ↓
      PostgreSQL
          ↓
   Backend Services
          ↓
       REST API
          ↓
    Next.js Frontend

Future:
Backend → Feature Engineering → ML → Explainability → Warnings
```

## Tech Stack

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   Lucide React
-   Recharts where useful

### Backend

-   Python 3.11
-   FastAPI
-   Pydantic v2
-   SQLAlchemy 2
-   Alembic
-   PostgreSQL
-   Pandas
-   NumPy
-   Pytest

### Planned ML

-   scikit-learn
-   XGBoost
-   SHAP

## Local Development

### Backend

``` powershell
cd "D:\SIH project\backend"
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

``` powershell
cd "D:\SIH project\frontend"
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Frontend: `http://localhost:3000` Backend: `http://localhost:8000`

For another device on the same LAN, use the host machine LAN IP.

## API

``` text
GET /api/v1/projects
GET /api/v1/projects/{project_id}
GET /api/v1/projects/{project_id}/history
GET /api/v1/projects/{project_id}/intelligence
```

## Cost Intelligence

Current deterministic metrics:

``` text
Original Cost
Latest Revised Cost
Cost Change Amount
Cost Change %
Cumulative Expenditure
Expenditure / Current Cost %
Historical Cost Observations
```

These are derived statistics, not ML predictions.

## Data Classification

  Type        Meaning
  ----------- -----------------------------------
  Reported    Directly available in source data
  Derived     Calculated from source data
  Predicted   Produced by a validated ML model
  Explained   Interpretation of a model output

## Engineering Principles

-   No fabricated production data.
-   Real source data before AI.
-   ML only after deterministic/statistical baselines.
-   Predictions must be explainable.
-   Feature importance is not causal proof.
-   Implement one module at a time.

## Testing

``` powershell
cd "D:\SIH project"
$env:PYTHONPATH="D:\SIH project"
backend\.venv\Scripts\python.exe -m pytest -q
```

## Status

### Completed

-   [x] PostgreSQL project domain
-   [x] Alembic migrations
-   [x] PAIMANA observations
-   [x] Project identity
-   [x] Project API
-   [x] History API
-   [x] Intelligence API
-   [x] Deterministic cost intelligence
-   [x] Cost intelligence tests

### In Progress

-   [ ] Frontend cost intelligence
-   [ ] Progress intelligence
-   [ ] Schedule intelligence

### Planned

-   [ ] ML risk prediction
-   [ ] Cost-overrun model
-   [ ] Time-overrun model
-   [ ] SHAP
-   [ ] Early warnings
-   [ ] Portfolio analytics
-   [ ] Benchmarking
-   [ ] What-if analysis
-   [ ] Optional LLM assistant

## Disclaimer

Nirman Drushti is a decision-support prototype. It does not replace
official project-monitoring systems or official government decisions.
Predictions and warnings should require human review.
