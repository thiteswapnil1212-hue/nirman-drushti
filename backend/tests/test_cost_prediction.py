from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.paimana import PaimanaObservation
from app.models.project import Project
from app.schemas.cost_prediction import CostRevisionPrediction
from app.services.cost_prediction import build_dataset, train_model

client = TestClient(app)


def observation(identity: str, period: date, revised_cost: str, index: int, original_cost: str = "100") -> PaimanaObservation:
    return PaimanaObservation(
        id=uuid4(), observation_id=f"obs-{identity}-{index}", project_identity=identity,
        match_status="matched", source_filename=f"{period}.csv", reporting_period=period,
        project_name="Training project", implementing_agency="Agency", state="State",
        start_date=date(2020, 1, 1), original_completion_date=date(2025, 1, 1),
        revised_completion_date=date(2025, 1, 1), original_cost=Decimal(original_cost),
        revised_cost=Decimal(revised_cost), cumulative_expenditure=Decimal("20"),
        physical_progress=Decimal(str(index * 10)), created_at=datetime.now(timezone.utc),
    )


def test_dataset_uses_previous_row_features_and_next_row_target() -> None:
    rows = [observation("p1", date(2025, 1, 1), "100", 1), observation("p1", date(2025, 2, 1), "120", 2), observation("p1", date(2025, 3, 1), "120", 3)]
    dataset = build_dataset(rows)

    assert len(dataset.rows) == 2
    assert dataset.rows[0].cutoff_reporting_period == date(2025, 1, 1)
    assert dataset.rows[0].target_reporting_period == date(2025, 2, 1)
    assert dataset.rows[0].target == 1
    assert dataset.rows[0].values["previous_current_cost"] == Decimal("100")
    assert dataset.rows[0].values["previous_physical_progress"] == Decimal("10")
    assert dataset.rows[0].values["previous_current_cost"] != Decimal("120")


def test_dataset_excludes_unusable_missing_cost_rows() -> None:
    rows = [observation("p1", date(2025, 1, 1), "100", 1), observation("p1", date(2025, 2, 1), "120", 2)]
    rows[0].revised_cost = None
    assert build_dataset(rows).rows == []


def test_model_trains_only_with_time_split_and_infers() -> None:
    rows = []
    for project_number in range(12):
        identity = f"p{project_number}"
        for month in range(1, 7):
            revised = str(100 + (20 if project_number % 3 == 0 and month >= 4 else 0))
            rows.append(observation(identity, date(2025 + (month - 1) // 12, ((month - 1) % 12) + 1, 1), revised, month))
    dataset = build_dataset(rows)
    model = train_model(dataset)
    assert model.train_rows > 0
    assert model.validation_rows > 0
    assert model.test_rows > 0
    assert "roc_auc" in model.metrics
    assert len(model.dataset_fingerprint or "") == 64
    assert len(model.split_fingerprint or "") == 64


def test_prediction_endpoint_returns_explicit_insufficient_data(monkeypatch) -> None:
    project = Project(id=uuid4(), project_identity="p1", name="Sparse project")
    response = CostRevisionPrediction(project_id=project.id, availability="INSUFFICIENT_DATA", model_version="cost-revision-v1", feature_coverage=Decimal("0"), features_used=[], limitations=["No prediction is returned."])
    monkeypatch.setattr(projects_route, "predict_project", lambda database, project_id: response)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        result = client.get(f"/api/v1/projects/{project.id}/prediction/cost")
    finally:
        app.dependency_overrides.clear()
    assert result.status_code == 200
    assert result.json()["availability"] == "INSUFFICIENT_DATA"
    assert result.json()["prediction"] is None
