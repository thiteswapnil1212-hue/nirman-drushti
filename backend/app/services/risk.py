from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import CostHistory, ProgressHistory, Project
from app.schemas.risk import RiskAssessment, RiskFactor, RiskPortfolioItem, RiskSummary, RiskSummaryResponse
from app.services.analytics import AnalyticsFilters, _project_filters
from app.services.projects import ProjectNotFoundError

# Initial operational heuristics. These thresholds are transparent and configurable,
# but are not statistically calibrated predictions.
COST_THRESHOLDS = ((Decimal("5"), 0, "LOW"), (Decimal("15"), 12, "MODERATE"), (Decimal("30"), 28, "HIGH"))
SCHEDULE_THRESHOLDS = ((Decimal("0"), 0, "LOW"), (Decimal("10"), 8, "MODERATE"), (Decimal("25"), 18, "HIGH"))
DIVERGENCE_THRESHOLDS = ((Decimal("10"), 0, "LOW"), (Decimal("25"), 8, "MODERATE"), (Decimal("40"), 15, "HIGH"))
RISK_LEVEL_THRESHOLDS = ((20, "LOW"), (50, "MODERATE"), (75, "HIGH"))


@dataclass(frozen=True)
class ProjectBundle:
    project: Project
    progress: list[ProgressHistory]
    costs: list[CostHistory]


def _decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _percentage(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator * Decimal("100")


def _band(value: Decimal, thresholds: tuple[tuple[Decimal, int, str], ...]) -> tuple[int, str]:
    for upper, contribution, severity in thresholds:
        if value <= upper:
            return contribution, severity
    return 40 if thresholds is COST_THRESHOLDS else 30 if thresholds is SCHEDULE_THRESHOLDS else 20, "CRITICAL"


def _ordered_progress(progress: Iterable[ProgressHistory]) -> list[ProgressHistory]:
    return sorted(progress, key=lambda item: (item.reporting_period, str(item.id)))


def _latest_values(project: Project, costs: list[CostHistory]) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    ordered_costs = sorted(costs, key=lambda item: (item.recorded_at, str(item.id)))
    latest = ordered_costs[-1] if ordered_costs else None
    original = _decimal(project.original_cost if project.original_cost is not None else latest.original_cost if latest else None)
    current = _decimal(project.current_cost if project.current_cost is not None else latest.current_cost if latest else None)
    expenditure = _decimal(project.expenditure if project.expenditure is not None else latest.expenditure if latest else None)
    return original, current, expenditure


def _progress_trend(progress: list[ProgressHistory]) -> tuple[str | None, Decimal | None, str]:
    values = [_decimal(item.physical_progress) for item in _ordered_progress(progress)]
    values = [value for value in values if value is not None]
    if len(values) < 2:
        return None, None, "Insufficient reported progress history to determine a trend."
    deltas = [current - previous for previous, current in zip(values, values[1:])]
    latest_delta = deltas[-1]
    if latest_delta == 0:
        return "STABLE", latest_delta, "Reported physical progress is unchanged between the latest observations."
    if latest_delta < 0 or len(deltas) >= 2 and latest_delta < deltas[-2]:
        return "SLOWING", latest_delta, "Recent reported progress movement is slower than the preceding movement."
    return "IMPROVING", latest_delta, "Reported physical progress is increasing in the available history."


def _coverage(project: Project, progress: list[ProgressHistory], original: Decimal | None, current: Decimal | None, expenditure: Decimal | None) -> tuple[Decimal, list[str]]:
    checks = [
        (original is not None, "original cost"),
        (current is not None, "current cost"),
        (expenditure is not None, "expenditure"),
        (project.physical_progress is not None, "physical progress"),
        (project.planned_completion_date is not None, "planned completion date"),
        (project.expected_completion_date is not None, "expected completion date"),
        (len([item for item in progress if item.physical_progress is not None]) >= 2, "progress history"),
        (project.implementing_agency is not None, "implementing agency"),
        (project.state is not None, "state"),
    ]
    missing = [label for present, label in checks if not present]
    return Decimal(sum(present for present, _ in checks)) / Decimal(len(checks)), missing


def _confidence_label(coverage: Decimal) -> str:
    if coverage >= Decimal("0.8"):
        return "High data coverage"
    if coverage >= Decimal("0.5"):
        return "Moderate data coverage"
    return "Low data coverage"


def _risk_level(score: int | None) -> str:
    if score is None:
        return "UNAVAILABLE"
    for upper, level in RISK_LEVEL_THRESHOLDS:
        if score <= upper:
            return level
    return "CRITICAL"


def assess_project(bundle: ProjectBundle) -> RiskAssessment:
    project = bundle.project
    progress = _ordered_progress(bundle.progress)
    original, current, expenditure = _latest_values(project, bundle.costs)
    escalation = current - original if current is not None and original is not None else None
    escalation_pct = _percentage(escalation, original)
    expenditure_pct = _percentage(expenditure, current)
    coverage, missing = _coverage(project, progress, original, current, expenditure)
    factors: list[RiskFactor] = []
    contributions: list[int] = []

    if escalation_pct is None:
        factors.append(RiskFactor(factor="cost_escalation", unit="%", severity="UNAVAILABLE", classification="UNAVAILABLE", available=False, explanation="Cost escalation is unavailable because positive original and current costs were not both reported."))
    else:
        contribution, severity = _band(max(escalation_pct, Decimal("0")), COST_THRESHOLDS)
        contributions.append(contribution)
        factors.append(RiskFactor(factor="cost_escalation", value=escalation_pct, unit="%", contribution=contribution, severity=severity, classification="DERIVED", available=True, explanation="Reported current cost is above the original approved cost baseline." if escalation_pct > 0 else "Reported current cost is not above the original approved cost baseline."))

    planned = project.planned_completion_date
    expected = project.expected_completion_date
    schedule_pct: Decimal | None = None
    extension_days: int | None = None
    if planned is None or expected is None:
        factors.append(RiskFactor(factor="schedule_extension", unit="%", severity="UNAVAILABLE", classification="UNAVAILABLE", available=False, explanation="Schedule extension is unavailable because both completion dates were not reported."))
    elif expected < planned:
        factors.append(RiskFactor(factor="schedule_extension", unit="%", severity="UNAVAILABLE", classification="UNAVAILABLE", available=False, explanation="Reported completion dates have invalid ordering; the expected date precedes the planned date."))
    else:
        extension_days = (expected - planned).days
        planned_start = project.planned_start_date
        if planned_start and planned > planned_start:
            schedule_pct = Decimal(extension_days) / Decimal((planned - planned_start).days) * Decimal("100")
        elif extension_days == 0:
            schedule_pct = Decimal("0")
        if schedule_pct is None:
            factors.append(RiskFactor(factor="schedule_extension", value=extension_days, unit="days", severity="UNAVAILABLE", classification="DERIVED", available=False, explanation="A schedule extension is reported, but planned duration is unavailable for a percentage comparison."))
        else:
            contribution, severity = _band(schedule_pct, SCHEDULE_THRESHOLDS)
            contributions.append(contribution)
            factors.append(RiskFactor(factor="schedule_extension", value=schedule_pct, unit="%", contribution=contribution, severity=severity, classification="DERIVED", available=True, explanation="Reported expected completion is later than the planned completion baseline." if extension_days > 0 else "Reported expected completion is not later than the planned completion baseline."))

    if expenditure_pct is None or project.physical_progress is None:
        factors.append(RiskFactor(factor="expenditure_progress_divergence", unit="percentage points", severity="UNAVAILABLE", classification="UNAVAILABLE", available=False, explanation="Divergence is unavailable because reported expenditure and physical progress were not both available."))
    else:
        divergence = expenditure_pct - _decimal(project.physical_progress)
        contribution, severity = _band(max(divergence, Decimal("0")), DIVERGENCE_THRESHOLDS)
        contributions.append(contribution)
        factors.append(RiskFactor(factor="expenditure_progress_divergence", value=divergence, unit="percentage points", contribution=contribution, severity=severity, classification="DERIVED", available=True, explanation="Reported expenditure is compared with reported physical progress; this is an attention signal, not a finding of misuse or inefficiency."))

    trend, progress_change, trend_explanation = _progress_trend(progress)
    if trend is None:
        factors.append(RiskFactor(factor="progress_trend", value=None, unit="trend", severity="UNAVAILABLE", classification="UNAVAILABLE", available=False, explanation=trend_explanation))
    else:
        contribution = 5 if trend == "SLOWING" else 0
        contributions.append(contribution)
        factors.append(RiskFactor(factor="progress_trend", value=trend, unit="trend", contribution=contribution, severity="HIGH" if trend == "SLOWING" else "LOW", classification="DERIVED", available=True, explanation=trend_explanation))

    factors.append(RiskFactor(factor="data_coverage", value=coverage, unit="coverage", contribution=None, severity="LOW", classification="DERIVED", available=True, explanation="Coverage measures whether required reported inputs exist; it does not itself imply project risk."))
    score = min(100, sum(contributions)) if contributions else None
    available_core = sum(factor.available and factor.factor != "data_coverage" for factor in factors)
    if score is None:
        availability = "UNAVAILABLE"
        explanation = "A meaningful operational risk assessment is unavailable because no scored cost, schedule, divergence, or trend factor could be calculated."
    elif available_core < 2 or coverage < Decimal("0.5"):
        availability = "INSUFFICIENT_DATA"
        explanation = f"Operational risk score is partial because only {available_core} scored factors are available."
    else:
        availability = "AVAILABLE"
        significant = [factor.factor for factor in factors if factor.severity in {"HIGH", "CRITICAL"}]
        explanation = "Elevated attention is associated with reported and derived signals: " + ", ".join(significant) + "." if significant else "Available reported and derived signals do not indicate elevated operational attention."
    limitations = [f"Missing {item}." for item in missing]
    limitations.append("Initial operational heuristics are not statistically calibrated predictions.")
    return RiskAssessment(project_id=project.id, score=score, level=_risk_level(score), availability=availability, data_coverage=coverage, confidence_label=_confidence_label(coverage), factors=factors, explanation=explanation, limitations=limitations, predicted=False)


def load_project_bundles(database: Session, filters: AnalyticsFilters | None = None) -> list[ProjectBundle]:
    filters = filters or AnalyticsFilters()
    projects = list(database.scalars(select(Project).where(*_project_filters(filters))).all())
    if not projects:
        return []
    project_ids = [project.id for project in projects]
    progress_rows = list(database.scalars(select(ProgressHistory).where(ProgressHistory.project_id.in_(project_ids))).all())
    cost_rows = list(database.scalars(select(CostHistory).where(CostHistory.project_id.in_(project_ids))).all())
    progress_by_id: dict[UUID, list[ProgressHistory]] = defaultdict(list)
    costs_by_id: dict[UUID, list[CostHistory]] = defaultdict(list)
    for row in progress_rows:
        progress_by_id[row.project_id].append(row)
    for row in cost_rows:
        costs_by_id[row.project_id].append(row)
    return [ProjectBundle(project, progress_by_id[project.id], costs_by_id[project.id]) for project in projects]


def get_project_bundle(database: Session, project_id: UUID) -> ProjectBundle:
    project = database.get(Project, project_id)
    if project is None:
        raise ProjectNotFoundError
    progress = list(database.scalars(select(ProgressHistory).where(ProgressHistory.project_id == project_id)).all())
    costs = list(database.scalars(select(CostHistory).where(CostHistory.project_id == project_id)).all())
    return ProjectBundle(project, progress, costs)


def build_risk_assessment(database: Session, project_id: UUID) -> RiskAssessment:
    return assess_project(get_project_bundle(database, project_id))


def build_risk_summary(database: Session, filters: AnalyticsFilters | None = None) -> RiskSummaryResponse:
    assessments = [(bundle, assess_project(bundle)) for bundle in load_project_bundles(database, filters)]
    available = [assessment for _, assessment in assessments if assessment.score is not None]
    distribution = {level: sum(assessment.level == level for assessment in available) for level in ("LOW", "MODERATE", "HIGH", "CRITICAL")}
    top = sorted(assessments, key=lambda item: (item[1].score is not None, item[1].score or -1), reverse=True)[:20]
    top_items = [RiskPortfolioItem(project_id=bundle.project.id, project_name=bundle.project.name, score=assessment.score, level=assessment.level, data_coverage=assessment.data_coverage, cost_pressure=next((factor.contribution for factor in assessment.factors if factor.factor == "cost_escalation"), None), schedule_pressure=next((factor.contribution for factor in assessment.factors if factor.factor == "schedule_extension"), None), progress_pressure=sum(factor.contribution or 0 for factor in assessment.factors if factor.factor in {"expenditure_progress_divergence", "progress_trend"})) for bundle, assessment in top]
    average_score = sum((Decimal(assessment.score) for assessment in available), Decimal("0")) / Decimal(len(available)) if available else None
    average_coverage = sum((assessment.data_coverage for _, assessment in assessments), Decimal("0")) / Decimal(len(assessments)) if assessments else None
    summary = RiskSummary(projects_assessed=len(available), projects_unavailable=len(assessments) - len(available), low_projects=distribution["LOW"], moderate_projects=distribution["MODERATE"], high_projects=distribution["HIGH"], critical_projects=distribution["CRITICAL"], average_score=average_score, average_data_coverage=average_coverage, top_projects=top_items, limitations=["Scores are transparent operational heuristics, not statistically calibrated predictions.", "No ML, probability, SHAP, or causal inference is used."])
    return RiskSummaryResponse(availability="AVAILABLE" if available else "UNAVAILABLE", summary=summary)
