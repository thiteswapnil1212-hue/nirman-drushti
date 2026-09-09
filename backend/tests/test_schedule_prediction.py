from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import projects as projects_route
from app.db.session import get_db
from app.main import app
from app.models.paimana import PaimanaObservation
from app.models.project import Project
from app.schemas.schedule_prediction import ScheduleRevisionPrediction
from app.services import schedule_prediction
from app.services.schedule_prediction import build_dataset, train_model

client = TestClient(app)


def observation(identity: str, period: date, reported: date | None, index: int, progress: str | None = None) -> PaimanaObservation:
    return PaimanaObservation(
        id=uuid4(), observation_id=f"schedule-{identity}-{index}", project_identity=identity,
        match_status="matched", source_filename=f"{period}.csv", reporting_period=period,
        project_name="Training project", implementing_agency="Agency", state="State",
        start_date=date(2020, 1, 1), original_completion_date=date(2026, 1, 1),
        revised_completion_date=reported, original_cost=Decimal("100"), revised_cost=Decimal("100"),
        cumulative_expenditure=Decimal(str(index * 10)), physical_progress=Decimal(progress or str(index * 10)),
        created_at=datetime.now(timezone.utc),
    )


def test_dataset_targets_later_reported_revision_and_keeps_future_date_out_of_features() -> None:
    rows = [
        observation("p1", date(2025, 1, 1), date(2026, 1, 1), 1),
        observation("p1", date(2025, 2, 1), date(2026, 3, 1), 2),
    ]
    dataset = build_dataset(rows)

    assert len(dataset.rows) == 1
    assert dataset.rows[0].target == 1
    assert dataset.rows[0].target_reporting_period == date(2025, 2, 1)
    assert dataset.rows[0].values["previous_reported_completion_days"] == 365
    assert dataset.rows[0].values["previous_reported_completion_days"] != 424


def test_dataset_skips_missing_and_invalid_reported_dates() -> None:
    rows = [
        observation("p1", date(2025, 1, 1), date(2026, 1, 1), 1),
        observation("p1", date(2025, 2, 1), None, 2),
        observation("p1", date(2025, 3, 1), "not-a-date", 3),
    ]
    assert build_dataset(rows).rows == []


def test_dataset_does_not_fallback_to_current_project_completion_date() -> None:
    project = Project(id=uuid4(), project_identity="p1", name="Historical project", planned_completion_date=date(2030, 1, 1))
    rows = [
        observation("p1", date(2025, 1, 1), date(2026, 1, 1), 1),
        observation("p1", date(2025, 2, 1), date(2026, 3, 1), 2),
    ]
    rows[0].original_completion_date = None

    dataset = build_dataset(rows, [project])

    assert dataset.rows[0].values["planned_completion_days"] is None


def test_model_uses_time_aware_split_and_reports_metrics() -> None:
    rows = []
    for project_number in range(12):
        identity = f"p{project_number}"
        for month in range(1, 7):
            reported = date(2026 + (1 if project_number % 3 == 0 and month >= 4 else 0), 1, 1)
            rows.append(observation(identity, date(2025, month, 1), reported, month))
    model = train_model(build_dataset(rows))

    assert model.train_rows > 0
    assert model.validation_rows > 0
    assert model.test_rows > 0
    assert {"precision", "recall", "f1", "roc_auc", "pr_auc", "confusion_matrix"} <= model.metrics.keys()
    assert "confusion_matrix" in model.baseline
    assert len(model.dataset_fingerprint or "") == 64
    assert len(model.split_fingerprint or "") == 64


def test_inference_returns_probability_without_using_future_observation(monkeypatch) -> None:
    project = Project(id=uuid4(), project_identity="p1", name="Inference project", planned_completion_date=date(2026, 1, 1))
    history = [
        observation("p1", date(2025, 1, 1), date(2026, 1, 1), 1),
        observation("p1", date(2025, 2, 1), date(2026, 3, 1), 2),
    ]
    training_rows = []
    for project_number in range(12):
        for month in range(1, 7):
            reported = date(2026 + (1 if project_number % 3 == 0 and month >= 4 else 0), 1, 1)
            training_rows.append(observation(f"train-{project_number}", date(2025, month, 1), reported, month))
    model = train_model(build_dataset(training_rows))

    class Result:
        def all(self):
            return history

    class Database:
        def get(self, model_type, project_id):
            return project

        def scalars(self, statement):
            return Result()

    monkeypatch.setattr(schedule_prediction, "ensure_artifact", lambda database: (model, build_dataset(training_rows)))
    result = schedule_prediction.predict_project(Database(), project.id)

    assert result.availability == "AVAILABLE"
    assert result.probability is not None
    assert result.cutoff_reporting_period == date(2025, 2, 1)


def test_schedule_prediction_endpoint_returns_explicit_insufficient_data(monkeypatch) -> None:
    project = Project(id=uuid4(), project_identity="p1", name="Sparse project")
    response = ScheduleRevisionPrediction(project_id=project.id, availability="INSUFFICIENT_DATA", model_version="schedule-revision-v1", feature_coverage=Decimal("0"), limitations=["No prediction is returned."])
    monkeypatch.setattr(projects_route, "predict_schedule_project", lambda database, project_id: response)
    app.dependency_overrides[get_db] = lambda: object()
    try:
        result = client.get(f"/api/v1/projects/{project.id}/prediction/schedule")
    finally:
        app.dependency_overrides.clear()
    assert result.status_code == 200
    assert result.json()["availability"] == "INSUFFICIENT_DATA"
    assert result.json()["prediction"] is None
