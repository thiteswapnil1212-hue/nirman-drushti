from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.assistant import AssistantResponse, AssistantStatus
from app.services.cost_intelligence import build_cost_intelligence
from app.services.projects import get_project, get_project_history
from app.services.project_actions import build_project_actions
from app.services.risk import build_risk_assessment
from app.services.schedule_prediction import predict_project as predict_schedule_project
from app.services.warnings import build_project_warnings


UNAVAILABLE_TEXT = "This information is not available in the current project data."
PROVIDER_UNAVAILABLE_TEXT = "Drushti AI could not complete the request. Please try again."
PROVIDER_QUOTA_TEXT = "Drushti AI is temporarily unavailable because the configured AI provider has reached its usage limit."
PROVIDER_CONFIGURATION_TEXT = "Drushti AI is not configured on the backend."
SYSTEM_INSTRUCTION = """You are the Nirman Drushti Project Intelligence Assistant.
Answer only from the supplied context for the selected project. Do not use web search,
outside knowledge, assumptions, or invented facts. Reported values are facts only when
labelled REPORTED. DERIVED values are calculations, PREDICTED values are model signals,
and MODEL SIGNAL values are explanations of model output. Never present derived or
predicted values as reported facts. Warnings indicate attention or review, not proof of
failure. Do not claim causality. If the requested information is absent, say exactly:
This information is not available in the current project data.
Keep the answer concise and decision-oriented. Return a natural-language answer only;
do not wrap it in JSON, markdown metadata, or commentary about these instructions.
"""
logger = logging.getLogger(__name__)


class GeminiProviderError(Exception):
    def __init__(self, status: AssistantStatus):
        self.status = status
        super().__init__(status)


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
    if hasattr(value, "__table__"):
        return {
            column.name: _json_safe(getattr(value, column.name))
            for column in value.__table__.columns
        }
    if isinstance(value, list):
        return [_model_dump(item) for item in value]
    if isinstance(value, dict):
        return {key: _model_dump(item) for key, item in value.items()}
    return _json_safe(value)


def _pick_fields(value: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {
        field: value[field]
        for field in fields
        if field in value and value[field] is not None
    }


def _compact_observations(items: list[Any], fields: tuple[str, ...], limit: int = 6) -> list[dict[str, Any]]:
    compacted = [_pick_fields(_model_dump(item), fields) for item in items]
    return [item for item in compacted if item][-limit:]


def _compact_context(
    project: Any,
    progress: list[Any],
    costs: list[Any],
    risk: Any,
    warnings: list[Any],
    cost_intelligence: Any,
    schedule_prediction: Any,
    actions: Any,
) -> dict[str, Any]:
    cost_assessment = _model_dump(cost_intelligence)
    risk_assessment = _model_dump(risk)
    prediction = cost_assessment.get("prediction", {}) if isinstance(cost_assessment, dict) else {}
    prediction = _model_dump(prediction)
    schedule = _model_dump(schedule_prediction)
    warning_rows = []
    for warning in warnings[:10]:
        row = _pick_fields(
            _model_dump(warning),
            ("warning_id", "type", "severity", "title", "message", "recommended_action", "source_type", "evidence"),
        )
        if row:
            warning_rows.append(row)
    risk_factors = []
    if isinstance(risk_assessment, dict):
        risk_factors = [
            _pick_fields(
                factor,
                ("factor", "value", "unit", "contribution", "severity", "classification", "available", "explanation"),
            )
            for factor in risk_assessment.get("factors", [])
            if isinstance(factor, dict)
        ]
    action_data = _model_dump(actions)
    action_rows = []
    if isinstance(action_data, dict):
        for action in action_data.get("actions", [])[:10]:
            row = _pick_fields(
                action,
                ("action_id", "priority", "title", "reason", "evidence", "recommended_check", "source"),
            )
            if row:
                action_rows.append(row)

    return {
        "project_identity": {
            "classification": "REPORTED",
            "project_id": str(project.id),
            "project_code": project.project_code,
            "name": project.name,
            "state": project.state,
            "implementing_agency": project.implementing_agency,
        },
        "reported_project_values": {
            "classification": "REPORTED",
            "original_cost": _json_safe(project.original_cost),
            "current_cost": _json_safe(project.current_cost),
            "expenditure": _json_safe(project.expenditure),
            "physical_progress": _json_safe(project.physical_progress),
            "expected_progress": _json_safe(project.expected_progress),
            "planned_completion_date": _json_safe(project.planned_completion_date),
            "expected_completion_date": _json_safe(project.expected_completion_date),
            "status": project.status.value if hasattr(project.status, "value") else project.status,
        },
        "reported_history": {
            "cost_observations": _compact_observations(
                costs,
                ("recorded_at", "original_cost", "current_cost", "expenditure"),
            ),
            "progress_observations": _compact_observations(
                progress,
                ("reporting_period", "physical_progress", "expected_progress", "expenditure", "status"),
            ),
        },
        "derived_cost_assessment": {
            "classification": "DERIVED",
            **_pick_fields(
            cost_assessment,
            ("original_cost", "revised_current_cost", "expenditure", "current_cost_overrun_amount", "current_cost_overrun_percentage", "escalation_amount", "escalation_percentage", "expenditure_percentage", "amount_above_revised_cost", "expenditure_exceeds_revised_cost", "limitations"),
            ),
        },
        "derived_risk_assessment": {
            "classification": "DERIVED",
            **_pick_fields(
                risk_assessment,
                ("score", "level", "availability", "data_coverage", "confidence_label", "explanation", "limitations", "predicted"),
            ),
            "factors": risk_factors,
        },
        "reported_warning_rules": warning_rows,
        "predicted_cost_revision": {
            "classification": "PREDICTED",
            **_pick_fields(
                prediction,
                ("availability", "prediction", "probability", "confidence_label", "model_version", "cutoff_reporting_period", "feature_coverage", "features_used", "limitations", "explanation"),
            ),
        },
        "predicted_schedule_revision": {
            "classification": "PREDICTED",
            **_pick_fields(
                schedule,
                ("availability", "prediction", "probability", "model_version", "cutoff_reporting_period", "feature_coverage", "limitations"),
            ),
        },
        "deterministic_project_actions": {
            "action_count": action_data.get("action_count", len(action_rows)) if isinstance(action_data, dict) else len(action_rows),
            "actions": action_rows,
        },
    }


def build_grounded_context(database: Session, project_id: UUID) -> tuple[dict[str, Any], list[str]]:
    project = get_project(database, project_id)
    progress, costs = get_project_history(database, project_id)
    risk = build_risk_assessment(database, project_id)
    warnings = build_project_warnings(database, project_id)
    cost_intelligence = build_cost_intelligence(database, project_id)
    schedule_prediction = predict_schedule_project(database, project_id)
    actions = build_project_actions(database, project_id)

    context = _compact_context(
        project,
        progress,
        costs,
        risk,
        warnings,
        cost_intelligence,
        schedule_prediction,
        actions,
    )
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


def _unavailable(
    project_id: UUID,
    status: AssistantStatus,
    message: str,
    limitation: str | None,
    model: str = "unavailable",
) -> AssistantResponse:
    return AssistantResponse(
        project_id=project_id,
        answer=message,
        key_points=[],
        evidence_used=[],
        data_limitations=[limitation] if limitation else [],
        model=model,
        grounded=False,
        status=status,
    )


def _context_limitations(context: dict[str, Any]) -> list[str]:
    limitations: list[str] = []
    for section_name in (
        "derived_assessment",
        "derived_risk_assessment",
        "predicted_schedule_revision",
    ):
        section = context.get(section_name)
        if isinstance(section, dict):
            values = section.get("limitations", [])
            if isinstance(values, list):
                limitations.extend(str(value) for value in values)
    return list(dict.fromkeys(limitations))


def _provider_error_code(response: httpx.Response) -> str | None:
    try:
        body = response.json()
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(body, dict):
        return None
    error = body.get("error")
    if not isinstance(error, dict):
        return None
    code = error.get("status") or error.get("code")
    return str(code) if code is not None else None


def _log_provider_failure(
    *,
    status_code: int | None,
    provider_error: str | None,
    model: str,
    response_present: bool,
) -> None:
    logger.warning(
        "Gemini assistant provider failure status=%s provider_error=%s model=%s response_present=%s",
        status_code,
        provider_error,
        model,
        response_present,
    )


def _call_gemini(question: str, context: dict[str, Any], model: str, api_key: str) -> str:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    serialized_context = json.dumps(context, ensure_ascii=True)
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": [{"text": f"QUESTION:\n{question}\n\nVERIFIED PROJECT CONTEXT:\n{serialized_context}"}]}],
        "generationConfig": {"temperature": 0.1},
    }
    logger.info("Gemini assistant request start model=%s context_chars=%s", model, len(serialized_context))
    with httpx.Client(timeout=30.0) as client:
        try:
            response = client.post(
                endpoint,
                headers={"x-goog-api-key": api_key},
                json=payload,
            )
            response.raise_for_status()
            logger.info(
                "Gemini assistant response model=%s status=%s response_present=%s",
                model,
                response.status_code,
                bool(response.content),
            )
        except httpx.HTTPStatusError as error:
            status_code = error.response.status_code
            provider_error = _provider_error_code(error.response)
            _log_provider_failure(
                status_code=status_code,
                provider_error=provider_error,
                model=model,
                response_present=bool(error.response.content),
            )
            if status_code == 429 or provider_error == "RESOURCE_EXHAUSTED":
                raise GeminiProviderError("provider_quota_exhausted") from error
            if status_code in (401, 403) or provider_error in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
                raise GeminiProviderError("provider_configuration_error") from error
            raise GeminiProviderError("provider_unavailable") from error
        except httpx.RequestError as error:
            _log_provider_failure(
                status_code=None,
                provider_error=type(error).__name__,
                model=model,
                response_present=False,
            )
            raise GeminiProviderError("provider_unavailable") from error
        try:
            body = response.json()
        except (ValueError, json.JSONDecodeError) as error:
            _log_provider_failure(
                status_code=response.status_code,
                provider_error="invalid_response_json",
                model=model,
                response_present=bool(response.content),
            )
            raise GeminiProviderError("invalid_provider_response") from error

    try:
        candidates = body["candidates"]
        parts = candidates[0]["content"]["parts"]
    except (KeyError, IndexError, TypeError) as error:
        _log_provider_failure(
            status_code=response.status_code,
            provider_error="invalid_response_shape",
            model=model,
            response_present=bool(body),
        )
        raise GeminiProviderError("invalid_provider_response") from error

    if not isinstance(parts, list):
        _log_provider_failure(
            status_code=response.status_code,
            provider_error="invalid_response_parts",
            model=model,
            response_present=bool(body),
        )
        raise GeminiProviderError("invalid_provider_response")

    text_parts = [
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and not part.get("thought", False) and isinstance(part.get("text", ""), str)
    ]
    answer = "\n".join(text_parts).strip()
    if not answer:
        _log_provider_failure(
            status_code=response.status_code,
            provider_error="empty_response_text",
            model=model,
            response_present=bool(body),
        )
        raise GeminiProviderError("invalid_provider_response")
    return answer


def answer_project_question(database: Session, project_id: UUID, question: str) -> AssistantResponse:
    get_project(database, project_id)
    settings = get_settings()
    if not settings.gemini_api_key:
        return _unavailable(
            project_id,
            "provider_configuration_error",
            PROVIDER_CONFIGURATION_TEXT,
            None,
            settings.gemini_model,
        )

    context, evidence = build_grounded_context(database, project_id)
    if not isinstance(context, dict) or not context.get("project_identity"):
        return _unavailable(
            project_id,
            "project_data_unavailable",
            UNAVAILABLE_TEXT,
            UNAVAILABLE_TEXT,
            settings.gemini_model,
        )
    try:
        answer = _call_gemini(question.strip(), context, settings.gemini_model, settings.gemini_api_key)
    except GeminiProviderError as error:
        if error.status == "provider_quota_exhausted":
            return _unavailable(project_id, error.status, PROVIDER_QUOTA_TEXT, None, settings.gemini_model)
        if error.status == "provider_unavailable":
            return _unavailable(project_id, error.status, PROVIDER_UNAVAILABLE_TEXT, None, settings.gemini_model)
        if error.status == "provider_configuration_error":
            return _unavailable(project_id, error.status, PROVIDER_CONFIGURATION_TEXT, None, settings.gemini_model)
        return _unavailable(project_id, error.status, PROVIDER_UNAVAILABLE_TEXT, None, settings.gemini_model)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
        _log_provider_failure(
            status_code=None,
            provider_error=type(error).__name__,
            model=settings.gemini_model,
            response_present=False,
        )
        return _unavailable(
            project_id,
            "invalid_provider_response",
            PROVIDER_UNAVAILABLE_TEXT,
            None,
            settings.gemini_model,
        )

    return AssistantResponse(
        project_id=project_id,
        answer=answer,
        key_points=[],
        evidence_used=evidence,
        data_limitations=_context_limitations(context),
        model=settings.gemini_model,
        grounded=True,
        status="success",
    )
