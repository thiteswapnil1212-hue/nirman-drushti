from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from app.schemas.risk import RiskAssessment
from app.schemas.warnings import EarlyWarning, WarningEvidence, WarningListResponse, WarningSummary
from app.services.analytics import AnalyticsFilters
from app.services.risk import ProjectBundle, assess_project, load_project_bundles

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "INFO": 3}


def _warning(
    bundle: ProjectBundle,
    warning_type: str,
    severity: str,
    title: str,
    message: str,
    evidence: dict[str, object],
    action: str,
    source_type: str,
) -> EarlyWarning:
    return EarlyWarning(
        warning_id=f"{bundle.project.id}:{warning_type}",
        project_id=bundle.project.id,
        project_name=bundle.project.name,
        type=warning_type,
        severity=severity,
        title=title,
        message=message,
        evidence=WarningEvidence(values=evidence),
        recommended_action=action,
        source_type=source_type,
        generated_at=datetime.now(timezone.utc),
    )


def generate_warnings(bundle: ProjectBundle, assessment: RiskAssessment | None = None) -> list[EarlyWarning]:
    assessment = assessment or assess_project(bundle)
    warnings: list[EarlyWarning] = []
    factors = {factor.factor: factor for factor in assessment.factors}
    cost = factors.get("cost_escalation")
    if cost and cost.available and isinstance(cost.value, Decimal) and cost.value > Decimal("5"):
        severity = "CRITICAL" if cost.value > Decimal("30") else "HIGH" if cost.value > Decimal("15") else "MODERATE"
        warnings.append(_warning(bundle, "COST_ESCALATION", severity, "High cost escalation", "Reported current cost is materially above the original cost baseline.", {"escalation_percentage": cost.value, "severity_band": cost.severity}, "Review reported cost revisions and underlying escalation records.", "DERIVED"))

    schedule = factors.get("schedule_extension")
    if schedule and schedule.available and isinstance(schedule.value, Decimal) and schedule.value > 0:
        severity = "CRITICAL" if schedule.value > Decimal("25") else "HIGH" if schedule.value > Decimal("10") else "MODERATE"
        warnings.append(_warning(bundle, "SCHEDULE_EXTENSION", severity, "Schedule extension", "Reported expected completion is later than the planned completion baseline.", {"extension_percentage": schedule.value, "severity_band": schedule.severity}, "Review the reported completion-date revision and current delivery plan.", "DERIVED"))
    elif schedule and schedule.factor == "schedule_extension" and not schedule.available and bundle.project.planned_completion_date and bundle.project.expected_completion_date and bundle.project.expected_completion_date > bundle.project.planned_completion_date:
        extension_days = (bundle.project.expected_completion_date - bundle.project.planned_completion_date).days
        severity = "CRITICAL" if extension_days > 730 else "HIGH" if extension_days > 365 else "MODERATE"
        warnings.append(_warning(bundle, "SCHEDULE_EXTENSION", severity, "Schedule extension", "Reported completion is later than planned, but planned duration is unavailable for a percentage comparison.", {"extension_days": extension_days}, "Review the reported completion-date revision and provide the missing planned duration where available.", "DERIVED"))

    divergence = factors.get("expenditure_progress_divergence")
    if divergence and divergence.available and isinstance(divergence.value, Decimal) and divergence.value > Decimal("25"):
        severity = "HIGH" if divergence.value > Decimal("40") else "MODERATE"
        warnings.append(_warning(bundle, "EXPENDITURE_PROGRESS_DIVERGENCE", severity, "Expenditure ahead of progress", "Reported expenditure is substantially ahead of reported physical progress.", {"divergence_percentage_points": divergence.value}, "Review the reported expenditure and physical-progress observations together.", "DERIVED"))

    trend = factors.get("progress_trend")
    valid_progress_count = len([item for item in bundle.progress if item.physical_progress is not None])
    if trend and trend.available and trend.value == "SLOWING" and valid_progress_count >= 3:
        warnings.append(_warning(bundle, "PROGRESS_SLOWDOWN", "MODERATE", "Progress slowdown", "Recent reported progress movement is slower than the preceding movement.", {"trend": "SLOWING", "observations": valid_progress_count}, "Review the latest reporting periods and confirm the current delivery position.", "DERIVED"))

    if assessment.data_coverage < Decimal("0.8"):
        warnings.append(_warning(bundle, "DATA_QUALITY", "INFO", "Incomplete intelligence coverage", "Important reported inputs are missing from the available project record or history.", {"data_coverage": assessment.data_coverage, "confidence_label": assessment.confidence_label}, "Review the source record before interpreting the operational risk assessment.", "DATA_QUALITY"))
    return sorted(warnings, key=lambda item: (SEVERITY_ORDER[item.severity], item.project_name, item.type))


def build_project_warnings(database, project_id: UUID) -> list[EarlyWarning]:
    from app.services.risk import get_project_bundle

    bundle = get_project_bundle(database, project_id)
    return generate_warnings(bundle)


def build_warning_list(
    database,
    filters: AnalyticsFilters | None = None,
    severity: str | None = None,
    warning_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> WarningListResponse:
    items: list[EarlyWarning] = []
    for bundle in load_project_bundles(database, filters):
        items.extend(generate_warnings(bundle))
    if severity:
        items = [item for item in items if item.severity == severity]
    if warning_type:
        items = [item for item in items if item.type == warning_type]
    items.sort(key=lambda item: (SEVERITY_ORDER[item.severity], item.project_name, item.type))
    summary = WarningSummary(
        critical=sum(item.severity == "CRITICAL" for item in items),
        high=sum(item.severity == "HIGH" for item in items),
        moderate=sum(item.severity == "MODERATE" for item in items),
        info=sum(item.severity == "INFO" for item in items),
        total=len(items),
    )
    start = (page - 1) * page_size
    return WarningListResponse(summary=summary, items=items[start:start + page_size], limitations=["Warnings are deterministic operational rules, not predictions.", "Warning evidence is limited to reported project and history fields."], page=page, page_size=page_size)
