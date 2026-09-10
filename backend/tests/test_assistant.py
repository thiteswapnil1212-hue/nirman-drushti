from datetime import date
from decimal import Decimal
import json
from types import SimpleNamespace
from uuid import uuid4

import httpx
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


def test_grounded_context_is_compact_and_excludes_raw_history_fields(monkeypatch):
    project_id = uuid4()
    project = Project(id=project_id, name="Project", project_code="P-1")
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: project)
    monkeypatch.setattr(assistant, "get_project_history", lambda database, requested_id: ([], []))
    monkeypatch.setattr(assistant, "build_risk_assessment", lambda database, requested_id: {"score": 72, "factors": [], "limitations": []})
    monkeypatch.setattr(assistant, "build_project_warnings", lambda database, requested_id: [])
    monkeypatch.setattr(assistant, "build_cost_intelligence", lambda database, requested_id: {"original_cost": "100", "historical_observations": [{"unnecessary": "raw"}], "prediction": {"probability": "0.8"}})
    monkeypatch.setattr(assistant, "predict_schedule_project", lambda database, requested_id: {"probability": "0.7", "limitations": []})
    monkeypatch.setattr(assistant, "build_project_actions", lambda database, requested_id: {"actions": [], "action_count": 0})

    context, _ = assistant.build_grounded_context(object(), project_id)

    assert "historical_observations" not in str(context)
    assert len(json.dumps(context)) < 5000


def test_missing_gemini_key_returns_clean_unavailable_response(monkeypatch):
    project_id = uuid4()
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: Project(id=project_id, name="Project"))
    monkeypatch.setattr(assistant, "get_settings", lambda: SimpleNamespace(gemini_api_key=None, gemini_model="gemini-2.5-pro"))

    result = assistant.answer_project_question(object(), project_id, "Why is this project risky?")

    assert result.grounded is False
    assert result.status == "provider_configuration_error"
    assert result.answer == assistant.PROVIDER_CONFIGURATION_TEXT
    assert result.data_limitations == []


def test_successful_gemini_text_is_returned_without_structured_parsing(monkeypatch):
    project_id = uuid4()
    project = Project(id=project_id, name="Project")
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: project)
    monkeypatch.setattr(assistant, "get_settings", lambda: SimpleNamespace(gemini_api_key="configured", gemini_model="gemini-2.5-pro"))
    monkeypatch.setattr(assistant, "build_grounded_context", lambda database, requested_id: ({"project_identity": {"project_id": str(project_id)}, "derived_assessment": {"limitations": ["Current cost is reported."]}}, ["reported project values"]))
    monkeypatch.setattr(assistant, "_call_gemini", lambda question, context, model, api_key: "The project is flagged because reported cost pressure requires review.")

    result = assistant.answer_project_question(object(), project_id, "Why is this project risky?")

    assert result.grounded is True
    assert result.status == "success"
    assert result.answer == "The project is flagged because reported cost pressure requires review."
    assert result.evidence_used == ["reported project values"]
    assert result.data_limitations == ["Current cost is reported."]


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
        status="success",
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
        status="success",
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
    assert result.json()["status"] == "success"
    assert result.json()["evidence_used"]


class _FakeGeminiResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body
        self.content = b"response" if body else b""

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://example.test")
            raise httpx.HTTPStatusError("provider failure", request=request, response=self)

    def json(self):
        return self._body


class _FakeGeminiClient:
    def __init__(self, response):
        self.response = response

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def post(self, *args, **kwargs):
        return self.response


def test_gemini_text_response_is_preserved(monkeypatch):
    response = _FakeGeminiResponse(
        200,
        {"candidates": [{"content": {"parts": [{"text": "Actual Gemini answer."}]}}]},
    )
    monkeypatch.setattr(assistant.httpx, "Client", lambda timeout: _FakeGeminiClient(response))

    assert assistant._call_gemini("Question", {"project_identity": {}}, "gemini-test", "secret") == "Actual Gemini answer."


def _answer_with_provider_error(monkeypatch, error):
    project_id = uuid4()
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: Project(id=project_id, name="Project"))
    monkeypatch.setattr(assistant, "get_settings", lambda: SimpleNamespace(gemini_api_key="configured", gemini_model="gemini-test"))
    monkeypatch.setattr(assistant, "build_grounded_context", lambda database, requested_id: ({"project_identity": {"project_id": str(project_id)}}, ["reported project values"]))
    monkeypatch.setattr(assistant, "_call_gemini", lambda question, context, model, api_key: (_ for _ in ()).throw(error))
    return assistant.answer_project_question(object(), project_id, "Why is this project risky?")


def test_provider_quota_returns_distinct_status(monkeypatch):
    result = _answer_with_provider_error(monkeypatch, assistant.GeminiProviderError("provider_quota_exhausted"))

    assert result.status == "provider_quota_exhausted"
    assert result.answer == assistant.PROVIDER_QUOTA_TEXT
    assert result.answer != assistant.UNAVAILABLE_TEXT


def test_provider_auth_failure_returns_provider_status(monkeypatch):
    result = _answer_with_provider_error(monkeypatch, assistant.GeminiProviderError("provider_configuration_error"))

    assert result.status == "provider_configuration_error"
    assert result.answer == assistant.PROVIDER_CONFIGURATION_TEXT


def test_empty_gemini_response_returns_invalid_provider_status(monkeypatch):
    result = _answer_with_provider_error(monkeypatch, assistant.GeminiProviderError("invalid_provider_response"))

    assert result.status == "invalid_provider_response"
    assert result.answer == assistant.PROVIDER_UNAVAILABLE_TEXT


def test_missing_project_context_returns_project_data_status(monkeypatch):
    project_id = uuid4()
    monkeypatch.setattr(assistant, "get_project", lambda database, requested_id: Project(id=project_id, name="Project"))
    monkeypatch.setattr(assistant, "get_settings", lambda: SimpleNamespace(gemini_api_key="configured", gemini_model="gemini-test"))
    monkeypatch.setattr(assistant, "build_grounded_context", lambda database, requested_id: ({}, []))

    result = assistant.answer_project_question(object(), project_id, "Why is this project risky?")

    assert result.status == "project_data_unavailable"
    assert result.answer == assistant.UNAVAILABLE_TEXT


def test_gemini_429_is_classified_as_quota(monkeypatch):
    response = _FakeGeminiResponse(
        429,
        {"error": {"status": "RESOURCE_EXHAUSTED", "code": 429}},
    )
    monkeypatch.setattr(assistant.httpx, "Client", lambda timeout: _FakeGeminiClient(response))

    try:
        assistant._call_gemini("Question", {"project_identity": {}}, "gemini-test", "secret")
    except assistant.GeminiProviderError as error:
        assert error.status == "provider_quota_exhausted"
    else:
        raise AssertionError("Expected quota provider error")


def test_gemini_auth_failure_is_classified_as_configuration_error(monkeypatch):
    response = _FakeGeminiResponse(
        401,
        {"error": {"status": "UNAUTHENTICATED", "code": 401}},
    )
    monkeypatch.setattr(assistant.httpx, "Client", lambda timeout: _FakeGeminiClient(response))

    try:
        assistant._call_gemini("Question", {"project_identity": {}}, "gemini-test", "secret")
    except assistant.GeminiProviderError as error:
        assert error.status == "provider_configuration_error"
    else:
        raise AssertionError("Expected provider authentication error")


def test_empty_gemini_text_is_classified_as_invalid_response(monkeypatch):
    response = _FakeGeminiResponse(
        200,
        {"candidates": [{"content": {"parts": []}}]},
    )
    monkeypatch.setattr(assistant.httpx, "Client", lambda timeout: _FakeGeminiClient(response))

    try:
        assistant._call_gemini("Question", {"project_identity": {}}, "gemini-test", "secret")
    except assistant.GeminiProviderError as error:
        assert error.status == "invalid_provider_response"
    else:
        raise AssertionError("Expected invalid provider response")
