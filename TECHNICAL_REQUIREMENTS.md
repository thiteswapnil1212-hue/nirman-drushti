# Nirman Drushti --- Technical Requirements

## 1. Objective

Build a production-oriented infrastructure intelligence platform that
ingests validated project-monitoring data, preserves provenance,
calculates transparent indicators, and eventually provides validated
predictive risk intelligence.

## 2. Architecture

``` text
PAIMANA
  ↓
Extraction
  ↓
Cleaning / Normalization
  ↓
Project Identity Matching
  ↓
PostgreSQL
  ↓
FastAPI Services
  ↓
REST API
  ↓
Next.js Frontend

Future:
Feature Engineering → ML → SHAP → Warning Engine
```

## 3. Frontend

-   Next.js App Router
-   React
-   TypeScript with strict mode
-   Tailwind CSS
-   Lucide React
-   Recharts where useful

Design: - warm off-white background - charcoal text - orange
intelligence accent - 1px borders - square corners - editorial tables -
Times New Roman display - Segoe UI/Arial UI

Avoid excessive rounded cards, glassmorphism, gradients, neon and
marketing-heavy copy.

## 4. Backend

-   Python 3.11+
-   FastAPI
-   Uvicorn
-   Pydantic v2
-   SQLAlchemy 2.0
-   Alembic
-   PostgreSQL
-   Pandas
-   NumPy
-   Pytest

## 5. Database

Core tables:

``` text
projects
progress_history
cost_history
milestones
paimana_observations
```

Projects should preserve:

``` text
id
project_code
project_identity
name
ministry
department
sector
location
implementing_agency
status
original_cost
current_cost
expenditure
physical_progress
expected_progress
planned_start_date
planned_completion_date
expected_completion_date
state
legacy_ocms_code
pmgid
created_at
updated_at
```

Historical tables must retain reporting dates and source/provenance.

## 6. API

``` http
GET /api/v1/projects
GET /api/v1/projects/{project_id}
GET /api/v1/projects/{project_id}/history
GET /api/v1/projects/{project_id}/intelligence
```

Project list requirements: - pagination - deterministic ordering -
search - state filter - implementing-agency filter

## 7. Cost Intelligence

### Escalation Amount

``` text
latest_cost - original_cost
```

### Escalation Percentage

``` text
((latest_cost - original_cost) / original_cost) × 100
```

Only calculate when original cost is non-zero.

### Expenditure Percentage

``` text
(cumulative_expenditure / latest_cost) × 100
```

Only calculate when latest cost is non-zero.

Historical cost observations must be ordered by reporting date and
retain source information. Do not fabricate missing observations.

## 8. Progress Intelligence

Initial metrics: - latest physical progress - progress change - progress
trend - observation count - historical series

Expected progress must not be fabricated.

## 9. Schedule Intelligence

Initial metrics: - original completion date - latest expected/revised
completion date - schedule extension - completion-date history

## 10. Data Quality

Track: - missing values - unmatched observations - ambiguous matches -
duplicates - missing provenance - invalid numbers - invalid dates

## 11. ML Requirements

ML comes after deterministic baselines.

Candidate models: - Logistic Regression - Random Forest - Gradient
Boosting - XGBoost

Potential targets: - cost_overrun - time_overrun - high_risk_project

Target definitions must be reproducible.

## 12. Feature Engineering

Cost: - original cost - current cost - cost escalation % - escalation
amount - number of revisions - recent cost change - cost-change
velocity - expenditure - expenditure/current cost

Progress: - physical progress - progress change - progress velocity -
progress slowdown - expenditure/progress relationship

Schedule: - planned duration - extension duration - completion-date
changes - schedule revision count

Metadata: - ministry - department - sector - state - implementing agency

Only use features actually present and valid in the dataset.

## 13. Leakage Prevention

For time-series data: - training observations must precede
validation/test periods - future cost revisions cannot predict earlier
outcomes - future completion dates cannot leak into earlier
observations - project-level grouping should be considered

## 14. Model Evaluation

Classification: - precision - recall - F1 - ROC-AUC - PR-AUC - confusion
matrix - calibration

Regression: - MAE - RMSE - R² - error distribution

Do not use accuracy alone.

## 15. Explainability

Use: - SHAP - permutation importance - feature importance - local
explanations

Clearly distinguish association/model importance from causal evidence.

## 16. Early Warnings

Rule-based signals may include: - repeated cost revisions - sharp recent
cost increase - schedule extension - prolonged low progress - abnormal
expenditure/progress relationship

Future ML signals: - predicted cost-overrun probability - predicted
schedule-overrun probability

Warning contract:

``` text
project_id
severity
signal_type
message
supporting_metric
reporting_period
created_at
status
```

## 17. Security

Production requirements: - environment variables for secrets -
authentication - authorization - input validation - rate limiting -
secure CORS - audit logging - least-privilege database access

Never commit:

``` text
.env
API keys
database passwords
JWT secrets
credentials
```

## 18. Performance

-   paginate large project lists
-   index search/filter fields
-   optimize historical queries
-   use DB connection pooling
-   avoid N+1 queries
-   keep API response contracts stable

## 19. Reliability

Backend: - health endpoint - structured logging - exception handling -
DB connection validation

Frontend: - loading states - empty states - error states - stale-request
cancellation - graceful API failures

## 20. Testing

Unit: - intelligence calculations - feature engineering - data quality

API: - list - filters - detail - history - intelligence

Integration: - PostgreSQL - ingestion - identity matching - API
serialization

ML: - feature schema - leakage checks - model input validation -
prediction contract - explanation contract

## 21. Observability

Record: - request latency - API errors - ingestion status - pipeline
failures - model version - prediction timestamp - data
snapshot/version - warning status

## 22. Deployment

Future:

``` text
Next.js
   ↓
FastAPI
   ↓
PostgreSQL

Background:
Celery + Redis

ML:
Python model service / backend
```

Docker should be introduced after local architecture is stable.

## 23. Current Boundary

Implemented: - project DB - PAIMANA observations - project identity -
project APIs - historical cost/progress - deterministic cost
intelligence - backend tests

Not implemented: - ML risk prediction - SHAP - early-warning engine -
portfolio analytics - what-if engine - LLM assistant

## 24. Implementation Order

``` text
Data
 ↓
Cost
 ↓
Progress
 ↓
Schedule
 ↓
Risk
 ↓
Explainability
 ↓
Warnings
 ↓
Analytics
 ↓
What-If
 ↓
Assistant
```

Each stage must be verified against real stored data before moving to
the next stage.
