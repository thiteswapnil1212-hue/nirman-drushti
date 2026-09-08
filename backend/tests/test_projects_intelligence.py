from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.project import CostHistory, ProgressHistory, Project
from app.schemas.project import ProjectIntelligenceResponse

client = TestClient(app)

def project_fixture(**kwargs) -> Project:
    default_kwargs = dict(
        id=uuid4(),
        project_identity="project-000001",
        project_code="P-1",
        name="Test Project",
        original_cost=Decimal("100.00"),
        current_cost=Decimal("120.00"),
        expenditure=Decimal("50.00"),
        physical_progress=Decimal("40.00"),
        planned_completion_date=date(2024, 1, 1),
        expected_completion_date=date(2025, 1, 1),
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    default_kwargs.update(kwargs)
    return Project(**default_kwargs)

from app.services import projects as projects_service

def setup_mock(monkeypatch, project, progress_history, cost_history):
    monkeypatch.setattr(projects_service, "get_project", lambda database, project_id: project)
    monkeypatch.setattr(projects_service, "get_project_history", lambda database, project_id: (progress_history, cost_history))
    app.dependency_overrides[get_db] = lambda: object()

def teardown_mock():
    app.dependency_overrides.clear()

def test_intelligence_cost_escalation(monkeypatch):
    project = project_fixture(original_cost=Decimal("100.00"), current_cost=Decimal("150.00"))
    setup_mock(monkeypatch, project, [], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["cost"]["original_cost"] == "100.00"
    assert data["cost"]["latest_cost"] == "150.00"
    assert data["cost"]["absolute_increase"] == "50.00"
    assert data["cost"]["escalation_percentage"] == "50.0"


def test_intelligence_zero_escalation(monkeypatch):
    project = project_fixture(original_cost=Decimal("100.00"), current_cost=Decimal("100.00"))
    setup_mock(monkeypatch, project, [], [])

    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()

    assert response.status_code == 200
    assert response.json()["cost"]["escalation_amount"] == "0.00"
    assert Decimal(response.json()["cost"]["escalation_percentage"]) == Decimal("0")


def test_intelligence_expenditure_percentage(monkeypatch):
    project = project_fixture(current_cost=Decimal("200.00"), expenditure=Decimal("50.00"))
    setup_mock(monkeypatch, project, [], [])

    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()

    assert response.status_code == 200
    assert response.json()["cost"]["expenditure_percentage"] == "25.00"


def test_intelligence_historical_cost_observations_are_ordered(monkeypatch):
    project = project_fixture(original_cost=None, current_cost=None, expenditure=None)
    later = CostHistory(
        id=uuid4(), project_id=project.id, recorded_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
        original_cost=Decimal("100.00"), current_cost=Decimal("125.00"), expenditure=Decimal("40.00"),
        source_filename="later.csv", created_at=datetime(2026, 2, 2, tzinfo=timezone.utc),
    )
    earlier = CostHistory(
        id=uuid4(), project_id=project.id, recorded_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        original_cost=Decimal("100.00"), current_cost=Decimal("110.00"), expenditure=Decimal("30.00"),
        source_filename="earlier.csv", created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    setup_mock(monkeypatch, project, [], [later, earlier])

    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()

    assert response.status_code == 200
    cost = response.json()["cost"]
    assert [item["source_filename"] for item in cost["historical_observations"]] == ["earlier.csv", "later.csv"]


def test_intelligence_missing_cost_values_are_safe(monkeypatch):
    project = project_fixture(original_cost=None, current_cost=None, expenditure=None)
    observation = CostHistory(
        id=uuid4(), project_id=project.id, recorded_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        original_cost=None, current_cost=None, expenditure=None,
        source_filename="missing.csv", created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    setup_mock(monkeypatch, project, [], [observation])

    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()

    assert response.status_code == 200
    cost = response.json()["cost"]
    assert cost["original_cost"] is None
    assert cost["latest_cost"] is None
    assert cost["escalation_amount"] is None
    assert cost["expenditure_percentage"] is None
    assert cost["historical_observations"][0]["source_filename"] == "missing.csv"
    
def test_intelligence_zero_original_cost(monkeypatch):
    project = project_fixture(original_cost=Decimal("0.00"), current_cost=Decimal("150.00"))
    setup_mock(monkeypatch, project, [], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["cost"]["original_cost"] == "0.00"
    assert data["cost"]["absolute_increase"] == "150.00"
    assert data["cost"]["escalation_percentage"] is None
    
def test_intelligence_null_values(monkeypatch):
    project = project_fixture(original_cost=None, current_cost=None, planned_completion_date=None, expected_completion_date=None)
    setup_mock(monkeypatch, project, [], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["cost"]["original_cost"] is None
    assert data["cost"]["absolute_increase"] is None
    assert data["schedule"]["extension_days"] is None
    assert data["schedule"]["has_extension"] is None
    assert data["data_quality"]["sufficient_history"] is False

def test_intelligence_progress_trend_one_observation(monkeypatch):
    project = project_fixture()
    prog1 = ProgressHistory(id=uuid4(), project_id=project.id, reporting_period=date(2026, 1, 1), physical_progress=Decimal("10.00"), created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    setup_mock(monkeypatch, project, [prog1], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["progress"]["observation_count"] == 1
    assert data["progress"]["latest_progress"] == "10.00"
    assert data["progress"]["previous_progress"] is None
    assert data["progress"]["trend"] is None
    assert data["data_quality"]["sufficient_history"] is False

def test_intelligence_progress_trend_multiple_observations_increasing(monkeypatch):
    project = project_fixture()
    prog1 = ProgressHistory(id=uuid4(), project_id=project.id, reporting_period=date(2026, 1, 1), physical_progress=Decimal("10.00"), created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    prog2 = ProgressHistory(id=uuid4(), project_id=project.id, reporting_period=date(2026, 2, 1), physical_progress=Decimal("20.00"), created_at=datetime(2026, 2, 1, tzinfo=timezone.utc))
    setup_mock(monkeypatch, project, [prog1, prog2], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["progress"]["observation_count"] == 2
    assert data["progress"]["latest_progress"] == "20.00"
    assert data["progress"]["previous_progress"] == "10.00"
    assert data["progress"]["progress_change"] == "10.00"
    assert data["progress"]["trend"] == "INCREASING"
    assert data["data_quality"]["sufficient_history"] is True

def test_intelligence_schedule_extension(monkeypatch):
    project = project_fixture(planned_completion_date=date(2024, 1, 1), expected_completion_date=date(2025, 1, 1))
    setup_mock(monkeypatch, project, [], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["schedule"]["has_extension"] is True
    assert data["schedule"]["extension_days"] == 366

def test_intelligence_no_schedule_extension(monkeypatch):
    project = project_fixture(planned_completion_date=date(2024, 1, 1), expected_completion_date=date(2023, 1, 1))
    setup_mock(monkeypatch, project, [], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["schedule"]["has_extension"] is False
    assert data["schedule"]["extension_days"] == 0
    assert data["schedule"]["extension_months"] == 0.0

def test_intelligence_missing_completion_dates(monkeypatch):
    project = project_fixture(planned_completion_date=None)
    setup_mock(monkeypatch, project, [], [])
    
    try:
        response = client.get(f"/api/v1/projects/{project.id}/intelligence")
    finally:
        teardown_mock()
        
    assert response.status_code == 200
    data = response.json()
    assert data["schedule"]["has_extension"] is None
    assert data["schedule"]["extension_days"] is None
