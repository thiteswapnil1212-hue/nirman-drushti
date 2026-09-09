from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from statistics import mean
from typing import Callable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.project import CostHistory, ProgressHistory, Project, ProjectStatus
from app.schemas.analytics import (
    AnalyticsMetric,
    AnalyticsNotice,
    BenchmarkRow,
    BenchmarkingAnalytics,
    BoxPlotGroup,
    CompositionAnalytics,
    CompositionItem,
    CostAnalytics,
    CostGroup,
    DistributionAnalytics,
    HistogramBin,
    HeatmapCell,
    PortfolioAnalyticsResponse,
    PortfolioSummary,
    ScatterPoint,
    TrendAnalytics,
    TrendPoint,
)

GROUP_FIELDS: dict[str, Callable[[Project], str | None]] = {
    "state": lambda project: project.state,
    "ministry": lambda project: project.ministry,
    "sector": lambda project: project.sector,
    "implementing_agency": lambda project: project.implementing_agency,
}


@dataclass(frozen=True)
class AnalyticsFilters:
    reporting_period: date | None = None
    state: str | None = None
    ministry: str | None = None
    sector: str | None = None
    implementing_agency: str | None = None


def _project_filters(filters: AnalyticsFilters) -> list[object]:
    clauses: list[object] = []
    def contains(column: object, value: str) -> object:
        return column.ilike(f"%{value.strip()}%")

    if filters.state and filters.state.strip():
        clauses.append(contains(Project.state, filters.state))
    if filters.ministry and filters.ministry.strip():
        clauses.append(contains(Project.ministry, filters.ministry))
    if filters.sector and filters.sector.strip():
        clauses.append(contains(Project.sector, filters.sector))
    if filters.implementing_agency and filters.implementing_agency.strip():
        clauses.append(contains(Project.implementing_agency, filters.implementing_agency))
    return clauses


def _period_filters(column: object, reporting_period: date | None) -> list[object]:
    if reporting_period is None:
        return []
    if column is CostHistory.recorded_at:
        if reporting_period.month == 12:
            next_month = date(reporting_period.year + 1, 1, 1)
        else:
            next_month = date(reporting_period.year, reporting_period.month + 1, 1)
        return [
            column >= datetime.combine(reporting_period, datetime.min.time()),
            column < datetime.combine(next_month, datetime.min.time()),
        ]
    return [column == reporting_period]


def _decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _sum(values: list[Decimal | None]) -> Decimal | None:
    present = [value for value in values if value is not None]
    return sum(present, Decimal("0")) if present else None


def _average(values: list[Decimal | None]) -> Decimal | None:
    present = [value for value in values if value is not None]
    return Decimal(str(mean(present))) if present else None


def _percentage(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator * Decimal("100")


def metric(value: Decimal | None, classification: str, reason: str | None = None) -> AnalyticsMetric:
    return AnalyticsMetric(value=value, classification=classification, available=value is not None, reason=reason)


def _notice(available: bool, reason: str | None = None, insufficient: bool = False) -> AnalyticsNotice:
    if available:
        return AnalyticsNotice(availability="available")
    return AnalyticsNotice(
        availability="insufficient_observations" if insufficient else "unavailable",
        reason=reason,
    )


def _group_value(project: Project, group_by: str) -> str | None:
    if group_by not in GROUP_FIELDS:
        raise ValueError(f"Unsupported group_by: {group_by}")
    return GROUP_FIELDS[group_by](project)


def _load_projects(database: Session, filters: AnalyticsFilters) -> list[Project]:
    clauses = _project_filters(filters)
    if filters.reporting_period is not None:
        progress_period = _period_filters(ProgressHistory.reporting_period, filters.reporting_period)
        cost_period = _period_filters(CostHistory.recorded_at, filters.reporting_period)
        progress_projects = select(ProgressHistory.project_id).where(*progress_period)
        cost_projects = select(CostHistory.project_id).where(*cost_period)
        clauses.append(or_(Project.id.in_(progress_projects), Project.id.in_(cost_projects)))
    statement = select(Project).where(*clauses)
    return list(database.scalars(statement).all())


def _load_progress(database: Session, filters: AnalyticsFilters) -> list[ProgressHistory]:
    statement = (
        select(ProgressHistory)
        .join(Project, ProgressHistory.project_id == Project.id)
        .where(*_project_filters(filters), *_period_filters(ProgressHistory.reporting_period, filters.reporting_period))
        .order_by(ProgressHistory.reporting_period.asc(), ProgressHistory.id.asc())
    )
    return list(database.scalars(statement).all())


def _load_costs(database: Session, filters: AnalyticsFilters) -> list[CostHistory]:
    statement = (
        select(CostHistory)
        .join(Project, CostHistory.project_id == Project.id)
        .where(*_project_filters(filters), *_period_filters(CostHistory.recorded_at, filters.reporting_period))
        .order_by(CostHistory.recorded_at.asc(), CostHistory.id.asc())
    )
    return list(database.scalars(statement).all())


def portfolio_summary(projects: list[Project]) -> PortfolioSummary:
    original = [_decimal(project.original_cost) for project in projects]
    current = [_decimal(project.current_cost) for project in projects]
    expenditure = [_decimal(project.expenditure) for project in projects]
    progress = [_decimal(project.physical_progress) for project in projects]
    escalation_amounts = [
        current_value - original_value
        for original_value, current_value in zip(original, current)
        if original_value is not None and current_value is not None
    ]
    total_original = _sum(original)
    total_current = _sum(current)
    total_expenditure = _sum(expenditure)
    total_escalation = _sum(escalation_amounts)
    extensions = [
        project.expected_completion_date - project.planned_completion_date
        for project in projects
        if project.expected_completion_date and project.planned_completion_date
        and project.expected_completion_date > project.planned_completion_date
    ]
    statuses = [project.status for project in projects if project.status is not None]

    return PortfolioSummary(
        project_count=len(projects),
        projects_with_cost=sum(value is not None for value in current),
        projects_with_progress=sum(value is not None for value in progress),
        reported_original_cost=metric(total_original, "reported", "No original cost values reported"),
        reported_current_cost=metric(total_current, "reported", "No current cost values reported"),
        reported_expenditure=metric(total_expenditure, "reported", "No expenditure values reported"),
        reported_average_progress=metric(_average(progress), "reported", "No physical progress values reported"),
        derived_cost_escalation_amount=metric(total_escalation, "derived", "Requires original and current cost"),
        derived_cost_escalation_percentage=metric(_percentage(total_escalation, total_original), "derived", "Requires positive original cost"),
        derived_expenditure_percentage=metric(_percentage(total_expenditure, total_current), "derived", "Requires positive current cost"),
        derived_schedule_extensions=metric(Decimal(len(extensions)), "derived", "Requires both completion dates"),
        risk_status=_notice(bool(statuses), "No reported project status values are available", insufficient=True),
    )


def cost_analytics(projects: list[Project], group_by: str) -> CostAnalytics:
    grouped: dict[str, list[Project]] = defaultdict(list)
    for project in projects:
        group = _group_value(project, group_by)
        if group:
            grouped[group].append(project)
    groups: list[CostGroup] = []
    for group, members in grouped.items():
        original = [_decimal(project.original_cost) for project in members]
        current = [_decimal(project.current_cost) for project in members]
        expenditure = [_decimal(project.expenditure) for project in members]
        escalation = [
            current_value - original_value
            for original_value, current_value in zip(original, current)
            if original_value is not None and current_value is not None
        ]
        groups.append(CostGroup(
            group=group,
            project_count=len(members),
            reported_original_cost=_sum(original),
            reported_current_cost=_sum(current),
            reported_expenditure=_sum(expenditure),
            derived_escalation_amount=_sum(escalation),
            derived_escalation_percentage=_percentage(_sum(escalation), _sum(original)),
        ))
    groups.sort(key=lambda item: item.derived_escalation_amount or Decimal("-Infinity"), reverse=True)
    return CostAnalytics(
        group_by=group_by,
        groups=groups,
        notice=_notice(bool(groups), "No populated grouping values are available", insufficient=True),
    )


def trend_analytics(progress: list[ProgressHistory], costs: list[CostHistory], projects_by_id: dict[object, Project]) -> TrendAnalytics:
    periods: dict[date, dict[str, list[Decimal | None]]] = defaultdict(lambda: defaultdict(list))
    for item in costs:
        period = item.recorded_at.date().replace(day=1)
        periods[period]["current_cost"].append(_decimal(item.current_cost))
        periods[period]["expenditure"].append(_decimal(item.expenditure))
    for item in progress:
        periods[item.reporting_period]["physical_progress"].append(_decimal(item.physical_progress))
    points = []
    for period in sorted(periods):
        period_values = periods[period]
        points.append(TrendPoint(
            reporting_period=period,
            reported_current_cost=_sum(period_values["current_cost"]),
            reported_expenditure=_sum(period_values["expenditure"]),
            reported_physical_progress=_average(period_values["physical_progress"]),
            observation_count=sum(len(values) for values in period_values.values()),
        ))

    heatmap_counts: dict[tuple[str, date], list[Decimal | None]] = defaultdict(list)
    for item in progress:
        project = projects_by_id.get(item.project_id)
        group = project.implementing_agency if project else None
        if group:
            heatmap_counts[(group, item.reporting_period)].append(_decimal(item.physical_progress))
    heatmap = [HeatmapCell(group=group, reporting_period=period, observation_count=len(values), average_progress=_average(values)) for (group, period), values in sorted(heatmap_counts.items())]
    return TrendAnalytics(
        points=points,
        heatmap=heatmap,
        notice=_notice(bool(points), "No reporting-period observations are available", insufficient=True),
    )


def _histogram(values: list[Decimal], bins: int = 6) -> list[HistogramBin]:
    if not values:
        return []
    minimum, maximum = min(values), max(values)
    if minimum == maximum:
        return [HistogramBin(lower=minimum, upper=maximum, count=len(values))]
    width = (maximum - minimum) / Decimal(bins)
    counts = [0] * bins
    for value in values:
        index = min(int((value - minimum) / width), bins - 1)
        counts[index] += 1
    return [HistogramBin(lower=minimum + width * index, upper=minimum + width * (index + 1), count=counts[index]) for index in range(bins)]


def _quartiles(values: list[Decimal]) -> tuple[Decimal, Decimal, Decimal, Decimal, Decimal]:
    ordered = sorted(values)
    def percentile(position: float) -> Decimal:
        if len(ordered) == 1:
            return ordered[0]
        index = (len(ordered) - 1) * position
        lower, upper = int(index), min(int(index) + 1, len(ordered) - 1)
        fraction = Decimal(str(index - lower))
        return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction
    return ordered[0], percentile(0.25), percentile(0.5), percentile(0.75), ordered[-1]


def distribution_analytics(projects: list[Project]) -> DistributionAnalytics:
    escalation_by_group: dict[str, list[Decimal]] = defaultdict(list)
    escalation_values: list[Decimal] = []
    progress_values: list[Decimal] = []
    scatter: list[ScatterPoint] = []
    for project in projects:
        original = _decimal(project.original_cost)
        current = _decimal(project.current_cost)
        expenditure = _decimal(project.expenditure)
        progress = _decimal(project.physical_progress)
        escalation = _percentage(current - original, original) if original is not None and current is not None else None
        expenditure_percentage = _percentage(expenditure, current)
        if escalation is not None:
            escalation_values.append(escalation)
            if project.implementing_agency:
                escalation_by_group[project.implementing_agency].append(escalation)
        if progress is not None:
            progress_values.append(progress)
        if progress is not None and expenditure_percentage is not None:
            scatter.append(ScatterPoint(project_id=str(project.id), project_name=project.name, physical_progress=progress, expenditure_percentage=expenditure_percentage, escalation_percentage=escalation))
    box_plot = []
    for group, values in escalation_by_group.items():
        minimum, lower, median, upper, maximum = _quartiles(values)
        box_plot.append(BoxPlotGroup(group=group, count=len(values), minimum=minimum, lower_quartile=lower, median=median, upper_quartile=upper, maximum=maximum))
    box_plot.sort(key=lambda item: item.count, reverse=True)
    return DistributionAnalytics(
        escalation_histogram=_histogram(escalation_values),
        progress_histogram=_histogram(progress_values),
        scatter=scatter,
        box_plot=box_plot,
        notice=_notice(bool(escalation_values or progress_values), "No numeric distributions are available", insufficient=True),
    )


def composition_analytics(projects: list[Project], category: str) -> CompositionAnalytics:
    if category == "status":
        values = [project.status.value for project in projects if project.status is not None]
    elif category in GROUP_FIELDS:
        values = [_group_value(project, category) for project in projects]
        values = [value for value in values if value]
    else:
        raise ValueError(f"Unsupported category: {category}")
    counts: dict[str, int] = defaultdict(int)
    for value in values:
        counts[value] += 1
    total = sum(counts.values())
    items = [CompositionItem(label=label, count=count, percentage=Decimal(count) / Decimal(total) * Decimal("100")) for label, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)]
    reason = "No reported project status values are available" if category == "status" else "No populated category values are available"
    return CompositionAnalytics(category=category, items=items, notice=_notice(bool(items), reason, insufficient=True))


def benchmarking(projects: list[Project], group_by: str) -> BenchmarkingAnalytics:
    grouped: dict[str, list[Project]] = defaultdict(list)
    for project in projects:
        group = _group_value(project, group_by)
        if group:
            grouped[group].append(project)
    rows: list[BenchmarkRow] = []
    for group, members in grouped.items():
        progress = [_decimal(project.physical_progress) for project in members]
        expenditure_pct = [_percentage(_decimal(project.expenditure), _decimal(project.current_cost)) for project in members]
        escalation_pct = []
        for project in members:
            original, current = _decimal(project.original_cost), _decimal(project.current_cost)
            if original is not None and current is not None:
                escalation_pct.append(_percentage(current - original, original))
        rows.append(BenchmarkRow(rank=0, group=group, project_count=len(members), average_progress=_average(progress), average_expenditure_percentage=_average(expenditure_pct), average_escalation_percentage=_average(escalation_pct)))
    rows.sort(key=lambda item: item.average_escalation_percentage if item.average_escalation_percentage is not None else Decimal("-Infinity"), reverse=True)
    rows = [row.model_copy(update={"rank": rank}) for rank, row in enumerate(rows, 1)]
    return BenchmarkingAnalytics(group_by=group_by, rows=rows, notice=_notice(bool(rows), "No populated grouping values are available", insufficient=True))


def build_portfolio_analytics(database: Session, filters: AnalyticsFilters, group_by: str = "implementing_agency", category: str = "implementing_agency") -> PortfolioAnalyticsResponse:
    projects = _load_projects(database, filters)
    progress = _load_progress(database, filters)
    costs = _load_costs(database, filters)
    projects_by_id = {project.id: project for project in projects}
    return PortfolioAnalyticsResponse(
        summary=portfolio_summary(projects),
        cost=cost_analytics(projects, group_by),
        trends=trend_analytics(progress, costs, projects_by_id),
        composition=composition_analytics(projects, category),
        distributions=distribution_analytics(projects),
        benchmarking=benchmarking(projects, group_by),
    )
