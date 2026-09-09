from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.project import Project
from app.schemas.cost_prediction import CostRevisionPrediction
from app.schemas.project import CostIntelligenceResponse
from app.services import cost_intelligence
from app.services.cost_intelligence import calculate_current_cost_assessment


client = TestClient(app)


def test_mospi_ongoing_assessment_uses_revised_cost_when_expenditure_is_below_it():
    result = calculate_current_cost_assessment(Decimal("100"), Decimal("125"), Decimal("80"))
    assert result["current_cost_overrun_amount"] == Decimal("25")
    assert result["amount_above_revised_cost"] is None
    assert result["expenditure_exceeds_revised_cost"] is False


def test_mospi_ongoing_assessment_uses_expenditure_above_revised_cost():
    result = calculate_current_cost_assessment(Decimal("100"), Decimal("125"), Decimal("140"))
    assert result["current_cost_overrun_amount"] == Decimal("40")
    assert result["amount_above_revised_cost"] == Decimal("15")
    assert result["current_cost_overrun_percentage"] == Decimal("40")
    assert result["expenditure_exceeds_revised_cost"] is True


def test_missing_revised_cost_does_not_fabricate_assessment():
    result = calculate_current_cost_assessment(Decimal("100"), None, Decimal("140"))
    assert result["escalation_amount"] is None
    assert result["current_cost_overrun_amount"] is None
    assert result["expenditure_exceeds_revised_cost"] is None


def test_missing_expenditure_does_not_assume_mospi_branch():
    result = calculate_current_cost_assessment(Decimal("100"), Decimal("125"), None)
    assert result["escalation_amount"] == Decimal("25")
    assert result["current_cost_overrun_amount"] is None
    assert result["expenditure_percentage"] is None


def test_service_integrates_existing_cost_revision_prediction(monkeypatch):
    project_id = uuid4()
    project = Project(id=project_id, name="Project", original_cost=Decimal("100"), current_cost=Decimal("120"), expenditure=Decimal("50"))
    prediction = CostRevisionPrediction(
        project_id=project_id,
        availability="INSUFFICIENT_DATA",
        model_version="cost-revision-v1",
        feature_coverage=Decimal("0"),
        features_used=[],
        limitations=["Insufficient history"],
    )
    monkeypatch.setattr(cost_intelligence, "get_project", lambda database, requested_id: project)
    monkeypatch.setattr(cost_intelligence, "get_project_history", lambda database, requested_id: ([], []))
    monkeypatch.setattr(cost_intelligence, "predict_project", lambda database, requested_id: prediction)

    result = cost_intelligence.build_cost_intelligence(object(), project_id)

    assert result.prediction.model_version == "cost-revision-v1"
    assert result.current_cost_overrun_amount == Decimal("20")


def test_cost_intelligence_api_exposes_prediction_and_completion_unavailable(monkeypatch):
    project_id = uuid4()
    prediction = CostRevisionPrediction(
        project_id=project_id,
        availability="AVAILABLE",
        prediction=True,
        probability=Decimal("0.75"),
        model_version="cost-revision-v1",
        feature_coverage=Decimal("0.90"),
        features_used=["previous_current_cost"],
        limitations=[],
    )
    response = CostIntelligenceResponse(
        project_id=project_id,
        availability="AVAILABLE",
        original_cost=Decimal("100"),
        revised_current_cost=Decimal("125"),
        expenditure=Decimal("140"),
        **calculate_current_cost_assessment(Decimal("100"), Decimal("125"), Decimal("140")),
        completion_cost_availability="UNAVAILABLE",
        completion_cost_overrun_amount=None,
        completion_cost_overrun_percentage=None,
        prediction=prediction,
        limitations=["Validated completion cost is unavailable."],
    )
    monkeypatch.setattr(projects_route, "build_cost_intelligence", lambda database, project_id: response)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        result = client.get(f"/api/v1/projects/{project_id}/cost-intelligence")
    finally:
        app.dependency_overrides.clear()
    assert result.status_code == 200
    payload = result.json()
    assert payload["current_cost_overrun_amount"] == "40"
    assert payload["amount_above_revised_cost"] == "15"
    assert payload["prediction"]["model_version"] == "cost-revision-v1"
    assert payload["completion_cost_availability"] == "UNAVAILABLE"
