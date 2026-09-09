from datetime import date
from decimal import Decimal
from uuid import uuid4

import numpy as np
from fastapi.testclient import TestClient

from app.api.routes import ml_evaluation as ml_evaluation_route
from app.db.session import get_db
from app.main import app
from app.schemas.ml_evaluation import MLEvaluationResponse
from app.services import cost_prediction, ml_evaluation, schedule_prediction
from app.services.ml_evaluation import cost_conventional_probability, evaluation_result, schedule_conventional_probability
from app.services.prediction_metadata import select_validation_threshold

client = TestClient(app)


def test_conventional_baselines_use_only_cutoff_features() -> None:
    cost_row = cost_prediction.HistoricalRow("p1", uuid4(), date(2026, 1, 1), date(2026, 2, 1), 1, {
        "prior_cost_escalation_pct": Decimal("10"), "prior_expenditure_pct": Decimal("50"),
    })
    schedule_row = schedule_prediction.HistoricalRow("p1", uuid4(), date(2026, 1, 1), date(2026, 2, 1), 1, {
        "prior_schedule_revisions": 1, "previous_reported_completion_days": 10, "planned_completion_days": 0,
    })

    assert cost_conventional_probability(cost_row) == 1.0
    assert schedule_conventional_probability(schedule_row) == 1.0


def test_metric_calculation_reports_expected_values() -> None:
    result = evaluation_result("cost_revision", "conventional", [0, 1, 1, 0], [0, 1, 1, 0])

    assert result.sample_count == 4
    assert result.positive_rate == 0.5
    assert result.precision == 1.0
    assert result.recall == 1.0
    assert result.f1 == 1.0
    assert result.confusion_matrix == [[2, 0], [0, 2]]


def test_comparison_uses_same_test_sample_count() -> None:
    targets = [0, 1, 1, 0]
    conventional = evaluation_result("schedule_revision", "conventional", targets, [0, 1, 0, 0])
    model = evaluation_result("schedule_revision", "ml", targets, [0.2, 0.8, 0.7, 0.1])

    assert conventional.sample_count == model.sample_count == len(targets)
    assert conventional.positive_rate == model.positive_rate == 0.5


def test_ml_evaluation_endpoint_returns_comparison(monkeypatch) -> None:
    response = MLEvaluationResponse(
        availability="AVAILABLE", cost_comparison=[], schedule_comparison=[],
        conclusion={"cost_revision": "Similar performance", "schedule_revision": "Similar performance"},
        evaluation_version="ml-vs-conventional-v1", evaluation_timestamp="2026-01-01T00:00:00Z", limitations=[],
    )
    monkeypatch.setattr(ml_evaluation_route, "evaluate_database", lambda database: response)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        result = client.get("/api/v1/ml-evaluation")
    finally:
        app.dependency_overrides.clear()

    assert result.status_code == 200
    assert result.json()["evaluation_version"] == "ml-vs-conventional-v1"
    assert result.json()["conclusion"]["cost_revision"] == "Similar performance"


def test_no_data_returns_explicit_insufficient_data(monkeypatch) -> None:
    monkeypatch.setattr(ml_evaluation.cost_prediction, "ensure_artifact", lambda database: (None, cost_prediction.Dataset([])))
    monkeypatch.setattr(ml_evaluation.schedule_prediction, "ensure_artifact", lambda database: (None, schedule_prediction.Dataset([])))

    result = ml_evaluation.evaluate_database(object())

    assert result.availability == "INSUFFICIENT_DATA"
    assert result.cost_comparison == []
    assert result.schedule_comparison == []


def test_validation_threshold_is_selected_from_validation_probabilities() -> None:
    threshold = select_validation_threshold(np.asarray([0, 1, 1, 0]), np.asarray([0.2, 0.7, 0.8, 0.6]))

    assert threshold == 0.7
