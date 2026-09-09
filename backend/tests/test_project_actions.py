from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.project import Project
from app.schemas.actions import ProjectAction, ProjectActionsResponse
from app.schemas.risk import RiskAssessment
from app.services.project_actions import build_project_actions

client = TestClient(app)


def project_fixture(**overrides) -> Project:
    values = {
        "id": uuid4(),
        "project_code": "TEST-ACT-001",
        "name": "Action test project",
        "state": "Maharashtra",
        "implementing_agency": "Roads Agency",
        "original_cost": Decimal("100"),
        "current_cost": Decimal("100"),
        "expenditure": Decimal("50"),
        "physical_progress": Decimal("50"),
        "planned_start_date": date(2020, 1, 1),
        "planned_completion_date": date(2024, 1, 1),
        "expected_completion_date": date(2024, 1, 1),
    }
    values.update(overrides)
    return Project(**values)


def mock_risk(pid) -> RiskAssessment:
    return RiskAssessment(
        project_id=pid,
        score=20,
        level="LOW",
        availability="AVAILABLE",
        data_coverage=Decimal("1.0"),
        confidence_label="High coverage",
        factors=[],
        explanation="Low risk",
        limitations=[],
    )


def test_cost_action_generated_on_cost_escalation(monkeypatch) -> None:
    p = project_fixture(original_cost=Decimal("100"), current_cost=Decimal("130"))
    monkeypatch.setattr("app.services.project_actions.get_project", lambda db, pid: p)
    monkeypatch.setattr("app.services.project_actions.build_risk_assessment", lambda db, pid: mock_risk(pid))
    monkeypatch.setattr("app.services.project_actions.build_project_warnings", lambda db, pid: [])

    res = build_project_actions(None, p.id)
    action_ids = [a.action_id for a in res.actions]
    assert "ACTION_COST_ESCALATION" in action_ids
    cost_act = next(a for a in res.actions if a.action_id == "ACTION_COST_ESCALATION")
    assert cost_act.priority == "CRITICAL"
    assert "Review Approved Cost Revision" in cost_act.title


def test_schedule_action_generated_on_schedule_extension(monkeypatch) -> None:
    p = project_fixture(planned_completion_date=date(2024, 1, 1), expected_completion_date=date(2025, 6, 1))
    monkeypatch.setattr("app.services.project_actions.get_project", lambda db, pid: p)
    monkeypatch.setattr("app.services.project_actions.build_risk_assessment", lambda db, pid: mock_risk(pid))
    monkeypatch.setattr("app.services.project_actions.build_project_warnings", lambda db, pid: [])

    res = build_project_actions(None, p.id)
    action_ids = [a.action_id for a in res.actions]
    assert "ACTION_SCHEDULE_EXTENSION" in action_ids
    sched_act = next(a for a in res.actions if a.action_id == "ACTION_SCHEDULE_EXTENSION")
    assert "Verify Revised Completion Commitment" in sched_act.title


def test_divergence_action_generated_on_expenditure_divergence(monkeypatch) -> None:
    p = project_fixture(current_cost=Decimal("100"), expenditure=Decimal("80"), physical_progress=Decimal("20"))
    monkeypatch.setattr("app.services.project_actions.get_project", lambda db, pid: p)
    monkeypatch.setattr("app.services.project_actions.build_risk_assessment", lambda db, pid: mock_risk(pid))
    monkeypatch.setattr("app.services.project_actions.build_project_warnings", lambda db, pid: [])

    res = build_project_actions(None, p.id)
    action_ids = [a.action_id for a in res.actions]
    assert "ACTION_EXPENDITURE_DIVERGENCE" in action_ids
    div_act = next(a for a in res.actions if a.action_id == "ACTION_EXPENDITURE_DIVERGENCE")
    assert "Verify Financial Discrepancy" in div_act.title


def test_data_quality_action_generated_on_missing_fields(monkeypatch) -> None:
    p = project_fixture(physical_progress=None)
    monkeypatch.setattr("app.services.project_actions.get_project", lambda db, pid: p)
    monkeypatch.setattr("app.services.project_actions.build_risk_assessment", lambda db, pid: mock_risk(pid))
    monkeypatch.setattr("app.services.project_actions.build_project_warnings", lambda db, pid: [])

    res = build_project_actions(None, p.id)
    action_ids = [a.action_id for a in res.actions]
    assert "ACTION_DATA_QUALITY" in action_ids
    dq_act = next(a for a in res.actions if a.action_id == "ACTION_DATA_QUALITY")
    assert "physical_progress" in dq_act.evidence


def test_clean_project_returns_no_actions(monkeypatch) -> None:
    p = project_fixture()
    monkeypatch.setattr("app.services.project_actions.get_project", lambda db, pid: p)
    monkeypatch.setattr("app.services.project_actions.build_risk_assessment", lambda db, pid: mock_risk(pid))
    monkeypatch.setattr("app.services.project_actions.build_project_warnings", lambda db, pid: [])

    res = build_project_actions(None, p.id)
    assert res.action_count == 0
    assert len(res.actions) == 0


def test_actions_api_endpoint(monkeypatch) -> None:
    pid = uuid4()
    mock_resp = ProjectActionsResponse(
        project_id=pid,
        actions=[
            ProjectAction(
                action_id="ACTION_COST_ESCALATION",
                priority="HIGH",
                title="Review Approved Cost Revision",
                reason="Reason string",
                evidence="Evidence string",
                recommended_check="Check string",
                source="COST_ENGINE",
            )
        ],
        action_count=1,
    )
    monkeypatch.setattr(projects_route, "build_project_actions", lambda db, p_id: mock_resp)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        response = client.get(f"/api/v1/projects/{pid}/actions")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == str(pid)
    assert data["action_count"] == 1
    assert data["actions"][0]["action_id"] == "ACTION_COST_ESCALATION"
