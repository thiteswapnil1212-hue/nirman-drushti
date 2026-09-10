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
GET /api/v1/projects/{project_id}/risk
GET /api/v1/projects/{project_id}/warnings
GET /api/v1/risk/summary
GET /api/v1/warnings
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

## Operational Risk and Early Warnings

The risk and warning services use transparent initial operational heuristics
from reported project and history fields. They are not statistically
calibrated predictions and do not use ML, probabilities, SHAP, or causal
inference.

Risk contributions are bounded as follows:

-   Cost pressure: 0--40 points. Escalation thresholds are 5%, 15%, and 30%.
-   Schedule pressure: 0--30 points. Extension thresholds are 0%, 10%, and 25% of planned duration.
-   Progress pressure: 0--20 points. Expenditure-progress divergence thresholds are 10, 25, and 40 percentage points; a slowing trend contributes 5 points.

The total operational score is the sum of available contributions and is
classified as LOW (0--20), MODERATE (21--50), HIGH (51--75), or CRITICAL
(76--100). Missing inputs are never replaced with zero. Data coverage is a
separate ratio of required reported inputs that exist, and incomplete coverage
produces an incomplete assessment rather than an implied risk value.

Warnings are deterministic notices for cost escalation, schedule extension,
expenditure-progress divergence, progress slowdown when sufficient history
exists, and data quality. Warning evidence is labelled REPORTED, DERIVED, or
DATA QUALITY. No warning asserts a cause, misuse, inefficiency, probability,
or prediction.

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
-   [x] Rule-based operational risk assessment
-   [x] Evidence-backed early warning service

### In Progress

-   [ ] Frontend cost intelligence
-   [ ] Progress intelligence
-   [ ] Schedule intelligence

### Planned

-   [ ] ML risk prediction
-   [ ] Cost-overrun model
-   [ ] Time-overrun model
-   [ ] SHAP
-   [x] Early warnings
-   [x] Portfolio analytics
-   [ ] Benchmarking
-   [ ] What-if analysis
-   [ ] Optional LLM assistant

Risk thresholds are initial operational heuristics and should be calibrated
against validated outcomes only during a later ML/statistical phase.

## Disclaimer

Nirman Drushti is a decision-support prototype. It does not replace
official project-monitoring systems or official government decisions.
Predictions and warnings should require human review.
