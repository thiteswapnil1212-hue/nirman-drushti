from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.assistant import AssistantAnswer, AssistantResponse
from app.services.cost_intelligence import build_cost_intelligence
from app.services.projects import get_project, get_project_history
from app.services.project_actions import build_project_actions
from app.services.risk import build_risk_assessment
from app.services.schedule_prediction import predict_project as predict_schedule_project
from app.services.warnings import build_project_warnings


UNAVAILABLE_TEXT = "This information is not available in the current project data."
SYSTEM_INSTRUCTION = """You are the Nirman Drushti Project Intelligence Assistant.
Answer only from the supplied context for the selected project. Do not use web search,
outside knowledge, assumptions, or invented facts. Reported values are facts only when
labelled REPORTED. DERIVED values are calculations, PREDICTED values are model signals,
and MODEL SIGNAL values are explanations of model output. Never present derived or
predicted values as reported facts. Warnings indicate attention or review, not proof of
failure. Do not claim causality. If the requested information is absent, say exactly:
This information is not available in the current project data.
Keep the answer concise and decision-oriented. Return only the requested JSON object.
"""


def _json_safe(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    return value


def _model_dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_model_dump(item) for item in value]
    if isinstance(value, dict):
        return {key: _model_dump(item) for key, item in value.items()}
    return _json_safe(value)


def build_grounded_context(database: Session, project_id: UUID) -> tuple[dict[str, Any], list[str]]:
    project = get_project(database, project_id)
    progress, costs = get_project_history(database, project_id)
    risk = build_risk_assessment(database, project_id)
    warnings = build_project_warnings(database, project_id)
    cost_intelligence = build_cost_intelligence(database, project_id)
    schedule_prediction = predict_schedule_project(database, project_id)
    actions = build_project_actions(database, project_id)

    context = {
        "project_identity": {
            "classification": "REPORTED",
            "project_id": str(project.id),
            "project_code": project.project_code,
            "name": project.name,
            "state": project.state,
            "implementing_agency": project.implementing_agency,
        },
        "reported_project_values": {
            "original_cost": _json_safe(project.original_cost),
            "current_cost": _json_safe(project.current_cost),
            "expenditure": _json_safe(project.expenditure),
            "physical_progress": _json_safe(project.physical_progress),
            "planned_completion_date": _json_safe(project.planned_completion_date),
            "expected_completion_date": _json_safe(project.expected_completion_date),
        },
        "reported_history": {
            "cost_observations": [_model_dump(item) for item in costs],
            "progress_observations": [_model_dump(item) for item in progress],
        },
        "derived_assessment": _model_dump(cost_intelligence),
        "derived_risk_assessment": _model_dump(risk),
        "reported_warning_rules": [_model_dump(item) for item in warnings],
        "predicted_schedule_revision": _model_dump(schedule_prediction),
        "deterministic_project_actions": _model_dump(actions),
    }
    evidence = [
        "reported project identity and current values",
        "reported historical cost observations",
        "reported historical progress observations",
        "derived cost assessment",
        "derived risk assessment",
        "reported warning-rule outputs",
        "predicted cost and schedule revision signals",
        "deterministic project actions and data limitations",
    ]
    return context, evidence


def _unavailable(project_id: UUID, limitation: str, model: str = "unavailable") -> AssistantResponse:
    return AssistantResponse(
        project_id=project_id,
        answer=UNAVAILABLE_TEXT,
        key_points=[],
        evidence_used=[],
        data_limitations=[limitation],
        model=model,
        grounded=False,
    )


def _response_schema() -> dict[str, Any]:
    return {
        "type": "OBJECT",
        "properties": {
            "answer": {"type": "STRING"},
            "key_points": {"type": "ARRAY", "items": {"type": "STRING"}},
            "evidence_used": {"type": "ARRAY", "items": {"type": "STRING"}},
            "data_limitations": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": ["answer", "key_points", "evidence_used", "data_limitations"],
    }


def _call_gemini(question: str, context: dict[str, Any], model: str, api_key: str) -> AssistantAnswer:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": [{"text": f"QUESTION:\n{question}\n\nVERIFIED PROJECT CONTEXT:\n{json.dumps(context, ensure_ascii=True)}"}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": _response_schema(),
        },
    }
    with httpx.Client(timeout=30.0) as client:
        response = client.post(endpoint, params={"key": api_key}, json=payload)
        response.raise_for_status()
        body = response.json()
    text = body["candidates"][0]["content"]["parts"][0]["text"]
    return AssistantAnswer.model_validate(json.loads(text))


def answer_project_question(database: Session, project_id: UUID, question: str) -> AssistantResponse:
    get_project(database, project_id)
    settings = get_settings()
    if not settings.gemini_api_key:
        return _unavailable(project_id, "The Gemini assistant is not configured on the backend.", settings.gemini_model)

    context, evidence = build_grounded_context(database, project_id)
    try:
        answer = _call_gemini(question.strip(), context, settings.gemini_model, settings.gemini_api_key)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
        return _unavailable(project_id, "The assistant could not produce a validated grounded response.", settings.gemini_model)

    if not answer.evidence_used:
        answer = answer.model_copy(update={"evidence_used": evidence})
    return AssistantResponse(
        project_id=project_id,
        answer=answer.answer,
        key_points=answer.key_points,
        evidence_used=answer.evidence_used,
        data_limitations=answer.data_limitations,
        model=settings.gemini_model,
        grounded=True,
    )
