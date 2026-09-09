from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models.project import Project
from app.schemas.assistant import AssistantAnswer, AssistantResponse
from app.services import assistant


client = TestClient(app)


def test_grounded_context_contains_only_selected_project_sources(monkeypatch):
    project_id = uuid4()
    project = Project(
        id=project_id,
        project_identity="p1",
        project_code="P-1",
        name="Bridge project",
        state="Maharashtra",
        implementing_agency="NHAI",
        original_cost=Decimal("100"),
        current_cost=Decimal("120"),
        expenditure=Decimal("80"),
        physical_progress=Decimal("55"),
        planned_completion_date=date(2027, 1, 1),
    )
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: project)
    monkeypatch.setattr(assistant, "get_project_history", lambda database, requested_id: ([], []))
    monkeypatch.setattr(assistant, "build_risk_assessment", lambda database, requested_id: {"classification": "DERIVED", "level": "HIGH"})
    monkeypatch.setattr(assistant, "build_project_warnings", lambda database, requested_id: [])
    monkeypatch.setattr(assistant, "build_cost_intelligence", lambda database, requested_id: {"classification": "DERIVED", "prediction": {"classification": "PREDICTED"}})
    monkeypatch.setattr(assistant, "predict_schedule_project", lambda database, requested_id: {"classification": "PREDICTED"})
    monkeypatch.setattr(assistant, "build_project_actions", lambda database, requested_id: {"actions": []})

    context, evidence = assistant.build_grounded_context(object(), project_id)

    assert context["project_identity"]["project_id"] == str(project_id)
    assert context["reported_project_values"]["current_cost"] == "120"
    assert context["derived_risk_assessment"]["classification"] == "DERIVED"
    assert context["predicted_schedule_revision"]["classification"] == "PREDICTED"
    assert "reported historical cost observations" in evidence
    assert "unrelated_portfolio" not in str(context)


def test_missing_gemini_key_returns_clean_unavailable_response(monkeypatch):
    project_id = uuid4()
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: Project(id=project_id, name="Project"))
    monkeypatch.setattr(assistant, "get_settings", lambda: SimpleNamespace(gemini_api_key=None, gemini_model="gemini-2.5-pro"))

    result = assistant.answer_project_question(object(), project_id, "Why is this project risky?")

    assert result.grounded is False
    assert result.answer == assistant.UNAVAILABLE_TEXT
    assert result.data_limitations


def test_assistant_answer_schema_is_validated():
    result = AssistantAnswer.model_validate({
        "answer": "Review the reported cost escalation.",
        "key_points": ["Current cost is above original cost."],
        "evidence_used": ["reported project values"],
        "data_limitations": [],
    })
    response = AssistantResponse(
        project_id=uuid4(),
        model="gemini-2.5-pro",
        grounded=True,
        **result.model_dump(),
    )
    assert response.grounded is True
    assert response.key_points == ["Current cost is above original cost."]


def test_assistant_api_returns_typed_response(monkeypatch):
    project_id = uuid4()
    response = AssistantResponse(
        project_id=project_id,
        answer="Review the reported cost signal.",
        key_points=["Current cost exceeds original cost."],
        evidence_used=["reported project values", "derived risk assessment"],
        data_limitations=[],
        model="gemini-2.5-pro",
        grounded=True,
    )
    monkeypatch.setattr(projects_route, "answer_project_question", lambda database, requested_id, question: response)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        result = client.post(f"/api/v1/projects/{project_id}/assistant", json={"question": "Why is this project risky?"})
    finally:
        app.dependency_overrides.clear()

    assert result.status_code == 200
    assert result.json()["project_id"] == str(project_id)
    assert result.json()["grounded"] is True
    assert result.json()["evidence_used"]
