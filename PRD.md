# Nirman Drushti --- Product Requirements Document

## Product Overview

Nirman Drushti is an explainable infrastructure intelligence platform
for monitoring large public infrastructure projects.

**DATA → WHY → PREDICT → EXPLAIN → WARN → ACT**

It organizes recorded project data, calculates transparent indicators,
and provides a foundation for predictive risk analysis and early
warnings.

## Problem

Infrastructure projects can experience cost escalation, schedule
extensions, slow physical progress, increasing expenditure, repeated
revisions, and incomplete observations. Reviewing these signals manually
across many projects is difficult.

## Target Users

-   Government project-monitoring teams
-   Ministry and department monitoring officers
-   Project implementation agencies
-   Infrastructure program managers
-   Policy and analytics teams

## MVP Goals

1.  Ingest validated PAIMANA/OCMS observations.
2.  Maintain project identity across reporting periods.
3.  Store historical observations and provenance.
4.  Provide cost, progress and schedule intelligence.
5.  Provide project search, filtering and detail views.
6.  Provide transparent data-quality information.
7.  Build the foundation for validated predictive ML.

## Product Principles

-   Accuracy over novelty.
-   Real data before AI.
-   Every derived metric must be reproducible.
-   Never fabricate production values.
-   Separate reported, derived, predicted and explained information.
-   Do not make causal claims from correlation or feature importance.

## Data Source

Primary source: PAIMANA / Infrastructure & Project Monitoring Division
(IPMD), Ministry of Statistics and Programme Implementation, Government
of India.

IPMD states that it monitors projects of ₹150 crore and above and
captures project progress, cost/expenditure parameters and issues
related to project slippages.

Official sources: - https://ipm.mospi.gov.in/ -
https://ipm.mospi.gov.in/Home/PublicDashboard -
https://ipm.mospi.gov.in/AboutUs/AboutIPMD -
https://ipm.mospi.gov.in/AboutUs/AboutOCMS

## Core Modules

### Project Registry

-   Search projects
-   Filter by state
-   Filter by implementing agency
-   Open project details

### Cost Intelligence

-   Original cost
-   Latest/revised cost
-   Cost change amount
-   Cost change percentage
-   Cumulative expenditure
-   Expenditure/current-cost percentage
-   Historical cost observations
-   Source/provenance

### Progress Intelligence

-   Latest physical progress
-   Historical progress
-   Progress trend
-   Expenditure/progress indicators where valid

### Schedule Intelligence

-   Original completion date
-   Revised/expected completion date
-   Schedule extension
-   Historical completion-date changes

### Risk Intelligence --- Future

-   Cost-overrun probability
-   Time-overrun probability
-   Overall risk
-   Confidence/calibration

### Explainability --- Future

-   SHAP
-   Feature importance
-   Supporting observed signals

### Early Warnings --- Future

-   Rule-based warnings
-   Model-based warnings
-   Trend warnings
-   Data-quality warnings

### Portfolio Analytics --- Future

-   State, ministry, sector and agency comparisons
-   Cost-overrun distribution
-   Schedule-overrun distribution
-   Progress distribution

## User Flow

``` text
Dashboard
  ↓
Search / Filter
  ↓
Project
  ↓
Current Position
  ↓
Cost / Progress / Schedule
  ↓
Historical Observations
  ↓
Risk / Warnings
  ↓
Monitoring Action
```

## Success Criteria

-   Real project records load from PostgreSQL.
-   Search and filters work.
-   Project details load through the API.
-   Historical observations are available.
-   Cost intelligence uses real stored data.
-   No fabricated production metrics exist.
-   Backend tests pass.
-   Users can understand why a project needs attention.

## Non-Goals

-   Autonomous decisions
-   Unsupported causal inference
-   Real-time IoT monitoring without source data
-   GPS monitoring without source data
-   Fabricated historical datasets
-   LLM-generated numerical predictions

## UX Requirements

Serious, institutional, editorial and engineering-oriented.

Preferred: - warm white background - charcoal text - orange intelligence
accent - 1px borders - square corners - compact tables - Times New Roman
display typography - Segoe UI/Arial UI typography

Avoid: - excessive cards - glassmorphism - gradients - neon -
marketing-heavy AI copy

## Roadmap

1.  Data foundation
2.  Deterministic intelligence
3.  Predictive intelligence
4.  Explainability
5.  Early warnings
6.  Portfolio analytics
7.  What-if analysis
8.  Optional intelligence assistant

## Current Status

Implemented: - PostgreSQL project domain - project APIs - project
history API - project intelligence API - PAIMANA observations - cost
history - progress history - deterministic cost intelligence - backend
tests

In progress: - frontend cost intelligence - progress intelligence -
schedule intelligence

Not yet implemented: - ML risk prediction - SHAP - early warnings -
portfolio analytics - what-if engine - LLM assistant
