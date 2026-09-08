from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.project import ProgressHistory, Project
from app.services.risk import ProjectBundle, assess_project

client = TestClient(app)


def project_fixture(**overrides) -> Project:
    values = {
        "id": uuid4(),
        "name": "Risk test project",
        "state": "Maharashtra",
        "implementing_agency": "Roads Agency",
        "original_cost": Decimal("100"),
        "current_cost": Decimal("100"),
        "expenditure": Decimal("20"),
        "physical_progress": Decimal("20"),
        "planned_start_date": date(2020, 1, 1),
        "planned_completion_date": date(2024, 1, 1),
        "expected_completion_date": date(2024, 1, 1),
    }
    values.update(overrides)
    return Project(**values)


def bundle(project: Project, progress: list[ProgressHistory] | None = None) -> ProjectBundle:
    return ProjectBundle(project=project, progress=progress or [], costs=[])


def factor(assessment, name: str):
    return next(item for item in assessment.factors if item.factor == name)


def test_cost_escalation_thresholds() -> None:
    assert factor(assess_project(bundle(project_fixture(current_cost=Decimal("105")))), "cost_escalation").severity == "LOW"
    assert factor(assess_project(bundle(project_fixture(current_cost=Decimal("110")))), "cost_escalation").severity == "MODERATE"
    assert factor(assess_project(bundle(project_fixture(current_cost=Decimal("120")))), "cost_escalation").severity == "HIGH"
    assert factor(assess_project(bundle(project_fixture(current_cost=Decimal("140")))), "cost_escalation").severity == "CRITICAL"


def test_schedule_extension_and_invalid_dates() -> None:
    no_extension = assess_project(bundle(project_fixture()))
    assert factor(no_extension, "schedule_extension").contribution == 0

    extension = assess_project(bundle(project_fixture(expected_completion_date=date(2024, 7, 1))))
    assert factor(extension, "schedule_extension").available is True
    assert factor(extension, "schedule_extension").severity == "HIGH"

    invalid = assess_project(bundle(project_fixture(expected_completion_date=date(2023, 1, 1))))
    assert factor(invalid, "schedule_extension").available is False
    assert invalid.score is not None


def test_divergence_and_progress_trend_require_real_values() -> None:
    divergence = assess_project(bundle(project_fixture(expenditure=Decimal("80"), physical_progress=Decimal("20"))))
    assert factor(divergence, "expenditure_progress_divergence").severity == "CRITICAL"

    progress = [
        ProgressHistory(id=uuid4(), project_id=uuid4(), reporting_period=date(2024, 1, 1), physical_progress=Decimal("10"), created_at=datetime.now(timezone.utc)),
        ProgressHistory(id=uuid4(), project_id=uuid4(), reporting_period=date(2024, 2, 1), physical_progress=Decimal("20"), created_at=datetime.now(timezone.utc)),
        ProgressHistory(id=uuid4(), project_id=uuid4(), reporting_period=date(2024, 3, 1), physical_progress=Decimal("25"), created_at=datetime.now(timezone.utc)),
    ]
    slowing = assess_project(bundle(project_fixture(), progress))
    assert factor(slowing, "progress_trend").value == "SLOWING"

    insufficient = assess_project(bundle(project_fixture(), progress[:1]))
    assert factor(insufficient, "progress_trend").available is False


def test_missing_cost_data_is_unavailable_and_coverage_is_reduced() -> None:
    assessment = assess_project(bundle(project_fixture(original_cost=None, current_cost=None)))
    assert factor(assessment, "cost_escalation").available is False
    assert assessment.data_coverage < Decimal("0.8")
    assert "Missing original cost." in assessment.limitations


def test_low_high_and_critical_risk_levels_are_deterministic() -> None:
    low = assess_project(bundle(project_fixture()))
    high = assess_project(bundle(project_fixture(current_cost=Decimal("120"), expected_completion_date=date(2025, 1, 1), expenditure=Decimal("70"), physical_progress=Decimal("20"))))
    critical = assess_project(bundle(project_fixture(current_cost=Decimal("150"), expected_completion_date=date(2026, 1, 1), expenditure=Decimal("90"), physical_progress=Decimal("10"))))
    assert low.level == "LOW"
    assert high.level in {"HIGH", "CRITICAL"}
    assert critical.level == "CRITICAL"
    assert low.predicted is False


def test_project_risk_endpoint_is_typed(monkeypatch) -> None:
    project = project_fixture()
    assessment = assess_project(bundle(project))
    monkeypatch.setattr(projects_route, "build_risk_assessment", lambda database, project_id: assessment)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        response = client.get(f"/api/v1/projects/{project.id}/risk")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["predicted"] is False
    assert response.json()["level"] == "LOW"
