from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.project import CostHistory, ProgressHistory, Project
from app.services.projects import list_projects


client = TestClient(app)


def project_fixture() -> Project:
    return Project(
        id=uuid4(),
        project_identity="project-000001",
        project_code="P-1",
        legacy_ocms_code="OC-1",
        pmgid="PMG-1",
        name="River Bridge",
        state="Maharashtra",
        implementing_agency="Roads Agency",
        original_cost=Decimal("100.00"),
        current_cost=Decimal("120.00"),
        expenditure=Decimal("50.00"),
        physical_progress=Decimal("40.00"),
        planned_start_date=date(2020, 1, 1),
        planned_completion_date=date(2024, 1, 1),
        expected_completion_date=date(2025, 1, 1),
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def test_list_projects_forwards_search_and_filters(monkeypatch) -> None:
    project = project_fixture()
    captured = {}

    def fake_list(database, **filters):
        captured.update(filters)
        return [project], 1

    monkeypatch.setattr(projects_route, "list_projects", fake_list)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        response = client.get("/api/v1/projects", params={"page": 2, "page_size": 1, "search": "Bridge", "state": "Maharashtra", "implementing_agency": "Roads Agency"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["items"][0]["project_code"] == "P-1"
    assert captured == {"page": 2, "page_size": 1, "status": None, "sector": None, "ministry": None, "search": "Bridge", "state": "Maharashtra", "implementing_agency": "Roads Agency"}


def test_project_state_and_agency_filters_are_case_insensitive_partial_matches() -> None:
    statements = []

    class Result:
        def all(self):
            return []

    class Database:
        def scalar(self, statement):
            statements.append(statement)
            return 0

        def scalars(self, statement):
            statements.append(statement)
            return Result()

    list_projects(Database(), page=1, page_size=20, search="bridge", state=" maharashtra ", implementing_agency=" roads ")
    sql = str(statements[0].compile())

    assert "lower(projects.state) LIKE lower(:state_1)" in sql
    assert "lower(projects.implementing_agency) LIKE lower(:implementing_agency_1)" in sql
    assert "lower(projects.name) LIKE lower(:name_1)" in sql
    assert "lower(projects.project_code) LIKE lower(:project_code_1)" in sql


def test_project_detail_returns_imported_fields(monkeypatch) -> None:
    project = project_fixture()
    monkeypatch.setattr(projects_route, "get_project", lambda database, project_id: project)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        response = client.get(f"/api/v1/projects/{project.id}")
    finally:
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body["project_code"] == "P-1"
    assert body["legacy_ocms_code"] == "OC-1"
    assert body["pmgid"] == "PMG-1"
    assert body["current_cost"] == "120.00"
    assert body["state"] == "Maharashtra"


def test_project_history_returns_progress_cost_and_provenance(monkeypatch) -> None:
    project = project_fixture()
    progress = ProgressHistory(
        id=uuid4(), project_id=project.id, reporting_period=date(2026, 3, 1),
        physical_progress=Decimal("40"), expenditure=Decimal("50"),
        project_identity="project-000001", source_filename="march.csv",
        created_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
    )
    cost = CostHistory(
        id=uuid4(), project_id=project.id, recorded_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        original_cost=Decimal("100"), current_cost=Decimal("120"), expenditure=Decimal("50"),
        project_identity="project-000001", source_filename="march.csv",
        created_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(projects_route, "get_project_history", lambda database, project_id: ([progress], [cost]))
    app.dependency_overrides[get_db] = lambda: object()
    try:
        response = client.get(f"/api/v1/projects/{project.id}/history")
    finally:
        app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body["progress"][0]["reporting_period"] == "2026-03-01"
    assert body["progress"][0]["source_filename"] == "march.csv"
    assert body["costs"][0]["source_filename"] == "march.csv"
