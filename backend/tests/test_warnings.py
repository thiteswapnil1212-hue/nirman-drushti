from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import warnings as warnings_route
from app.db.session import get_db
from app.main import app
from app.models.project import Project
from app.schemas.warnings import WarningListResponse, WarningSummary
from app.services.risk import ProjectBundle
from app.services.warnings import generate_warnings

client = TestClient(app)


def project_fixture(**overrides) -> Project:
    values = {
        "id": uuid4(),
        "name": "Warning test project",
        "state": "Maharashtra",
        "implementing_agency": "Roads Agency",
        "original_cost": Decimal("100"),
        "current_cost": Decimal("150"),
        "expenditure": Decimal("90"),
        "physical_progress": Decimal("20"),
        "planned_start_date": date(2020, 1, 1),
        "planned_completion_date": date(2024, 1, 1),
        "expected_completion_date": date(2025, 1, 1),
    }
    values.update(overrides)
    return Project(**values)


def test_warning_deduplication_and_severity_ordering() -> None:
    warnings = generate_warnings(ProjectBundle(project_fixture(state=None, implementing_agency=None), [], []))
    types = [warning.type for warning in warnings]
    severities = [warning.severity for warning in warnings]
    assert len(types) == len(set(types))
    assert severities == sorted(severities, key={"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "INFO": 3}.get)
    assert "COST_ESCALATION" in types
    assert "SCHEDULE_EXTENSION" in types
    assert "EXPENDITURE_PROGRESS_DIVERGENCE" in types
    assert "DATA_QUALITY" in types


def test_warning_requires_sufficient_progress_history_for_slowdown() -> None:
    warnings = generate_warnings(ProjectBundle(project_fixture(), [], []))
    assert "PROGRESS_SLOWDOWN" not in [warning.type for warning in warnings]


def test_warning_endpoint_returns_typed_list(monkeypatch) -> None:
    response_body = WarningListResponse(summary=WarningSummary(critical=0, high=0, moderate=0, info=0, total=0), items=[], limitations=[], page=1, page_size=50)
    monkeypatch.setattr(warnings_route, "build_warning_list", lambda *args, **kwargs: response_body)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        response = client.get("/api/v1/warnings?severity=HIGH&warning_type=COST_ESCALATION")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["summary"]["total"] == 0
