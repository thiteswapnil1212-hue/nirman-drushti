from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.models.project import CostHistory, ProgressHistory, Project
from app.services.analytics import (
    AnalyticsFilters,
    _histogram,
    _period_filters,
    _project_filters,
    benchmarking,
    cost_analytics,
    distribution_analytics,
    portfolio_summary,
    trend_analytics,
    composition_analytics,
)


def project_fixture(**overrides) -> Project:
    values = {
        "id": uuid4(),
        "name": "Test project",
        "implementing_agency": "Roads Agency",
        "state": "Maharashtra",
        "original_cost": Decimal("100"),
        "current_cost": Decimal("120"),
        "expenditure": Decimal("60"),
        "physical_progress": Decimal("40"),
        "planned_completion_date": date(2024, 1, 1),
        "expected_completion_date": date(2025, 1, 1),
    }
    values.update(overrides)
    return Project(**values)


def test_portfolio_summary_derives_cost_and_schedule_metrics() -> None:
    summary = portfolio_summary([project_fixture()])

    assert summary.project_count == 1
    assert summary.reported_current_cost.value == Decimal("120")
    assert summary.derived_cost_escalation_amount.value == Decimal("20")
    assert summary.derived_cost_escalation_percentage.value == Decimal("20")
    assert summary.derived_expenditure_percentage.value == Decimal("50")
    assert summary.derived_schedule_extensions.value == Decimal("1")
    assert summary.risk_status.availability == "insufficient_observations"


def test_cost_analytics_groups_real_values() -> None:
    projects = [
        project_fixture(name="A", implementing_agency="Agency A"),
        project_fixture(name="B", implementing_agency="Agency A", original_cost=Decimal("200"), current_cost=Decimal("250")),
        project_fixture(name="C", implementing_agency="Agency B", original_cost=Decimal("50"), current_cost=Decimal("50")),
    ]

    result = cost_analytics(projects, "implementing_agency")

    assert result.notice.availability == "available"
    assert result.groups[0].group == "Agency A"
    assert result.groups[0].project_count == 2
    assert result.groups[0].reported_current_cost == Decimal("370")
    assert result.groups[0].derived_escalation_amount == Decimal("70")
    assert result.groups[0].derived_escalation_percentage == Decimal("23.33333333333333333333333333")


def test_trends_aggregate_cost_and_progress_by_reporting_period() -> None:
    project = project_fixture()
    progress = [
        ProgressHistory(id=uuid4(), project_id=project.id, reporting_period=date(2026, 1, 1), physical_progress=Decimal("20")),
        ProgressHistory(id=uuid4(), project_id=project.id, reporting_period=date(2026, 2, 1), physical_progress=Decimal("35")),
    ]
    costs = [
        CostHistory(id=uuid4(), project_id=project.id, recorded_at=datetime(2026, 1, 15, tzinfo=timezone.utc), current_cost=Decimal("120"), expenditure=Decimal("50")),
        CostHistory(id=uuid4(), project_id=project.id, recorded_at=datetime(2026, 2, 15, tzinfo=timezone.utc), current_cost=Decimal("125"), expenditure=Decimal("65")),
    ]

    result = trend_analytics(progress, costs, {project.id: project})

    assert [point.reporting_period for point in result.points] == [date(2026, 1, 1), date(2026, 2, 1)]
    assert result.points[0].reported_current_cost == Decimal("120")
    assert result.points[1].reported_expenditure == Decimal("65")
    assert result.points[1].reported_physical_progress == Decimal("35")


def test_distributions_include_histogram_scatter_and_box_plot() -> None:
    projects = [
        project_fixture(name="A", implementing_agency="Agency A"),
        project_fixture(name="B", implementing_agency="Agency A", original_cost=Decimal("200"), current_cost=Decimal("300"), physical_progress=Decimal("80"), expenditure=Decimal("240")),
    ]

    result = distribution_analytics(projects)

    assert result.notice.availability == "available"
    assert sum(item.count for item in result.escalation_histogram) == 2
    assert len(result.scatter) == 2
    assert result.box_plot[0].group == "Agency A"
    assert result.box_plot[0].median == Decimal("35")


def test_histogram_preserves_all_values_and_handles_constant_series() -> None:
    assert sum(item.count for item in _histogram([Decimal("5"), Decimal("5")])) == 2
    assert len(_histogram([Decimal("1"), Decimal("2"), Decimal("3")])) == 6


def test_benchmarking_ranks_groups_by_escalation() -> None:
    result = benchmarking([
        project_fixture(implementing_agency="Low", original_cost=Decimal("100"), current_cost=Decimal("110")),
        project_fixture(implementing_agency="High", original_cost=Decimal("100"), current_cost=Decimal("160")),
    ], "implementing_agency")

    assert [row.group for row in result.rows] == ["High", "Low"]
    assert [row.rank for row in result.rows] == [1, 2]


def test_analytics_dimensions_use_case_insensitive_partial_filters() -> None:
    clauses = _project_filters(AnalyticsFilters(state=" maha ", ministry="road", sector="high", implementing_agency="nhai"))
    sql = " ".join(str(clause.compile()) for clause in clauses)

    assert sql.count("lower(") == 8
    assert "projects.state" in sql
    assert "projects.ministry" in sql
    assert "projects.sector" in sql
    assert "projects.implementing_agency" in sql


def test_reporting_period_filter_is_month_bounded_for_cost_history() -> None:
    clauses = _period_filters(CostHistory.recorded_at, date(2026, 6, 1))
    sql = " ".join(str(clause.compile()) for clause in clauses)

    assert len(clauses) == 2
    assert "cost_history.recorded_at" in sql


def test_state_and_agency_filters_can_be_combined_with_reporting_period() -> None:
    filters = AnalyticsFilters(
        reporting_period=date(2026, 6, 1),
        state="maharashtra",
        implementing_agency="nhai",
    )
    clauses = _project_filters(filters)
    sql = " ".join(str(clause.compile()) for clause in clauses)

    assert "projects.state" in sql
    assert "projects.implementing_agency" in sql
    assert len(_period_filters(CostHistory.recorded_at, filters.reporting_period)) == 2


def test_empty_analytics_filters_are_ignored() -> None:
    assert _project_filters(AnalyticsFilters(state=" ", implementing_agency="")) == []


def test_null_ministry_and_sector_return_honest_unavailable_compositions() -> None:
    projects = [project_fixture(ministry=None, sector=None)]

    ministry = composition_analytics(projects, "ministry")
    sector = composition_analytics(projects, "sector")

    assert ministry.items == []
    assert ministry.notice.availability == "insufficient_observations"
    assert sector.items == []
    assert sector.notice.availability == "insufficient_observations"
