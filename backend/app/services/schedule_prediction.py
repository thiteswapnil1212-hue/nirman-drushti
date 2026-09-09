from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Iterable
from uuid import UUID

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.paimana import PaimanaObservation
from app.models.project import Project
from app.schemas.schedule_prediction import ScheduleRevisionPrediction
from app.services.cost_prediction import (
    ForestModel,
    LogisticModel,
    Standardizer,
    TreeStump,
    _fit_forest,
    _fit_logistic,
    _metrics,
    _predict_forest,
    _predict_logistic,
)

MODEL_VERSION = "schedule-revision-v1"
ARTIFACT_PATH = Path(__file__).resolve().parents[2] / "ml_artifacts" / "schedule_revision_model.json"
MIN_TRAINING_ROWS = 20

FEATURE_NAMES = (
    "planned_completion_days",
    "previous_reported_completion_days",
    "previous_physical_progress",
    "previous_expenditure",
    "project_age_months",
    "progress_velocity",
    "expenditure_progression",
    "prior_schedule_revisions",
    "observation_count",
    "implementing_agency",
    "state",
)
NUMERIC_FEATURES = FEATURE_NAMES[:9]
CATEGORICAL_FEATURES = FEATURE_NAMES[9:]


@dataclass(frozen=True)
class HistoricalRow:
    project_identity: str
    project_id: UUID | None
    cutoff_reporting_period: date
    target_reporting_period: date
    target: int
    values: dict[str, object]


@dataclass(frozen=True)
class Dataset:
    rows: list[HistoricalRow]
    feature_names: tuple[str, ...] = FEATURE_NAMES


@dataclass(frozen=True)
class EncodedDataset:
    matrix: np.ndarray
    targets: np.ndarray
    rows: list[HistoricalRow]
    numeric_means: dict[str, float]
    category_values: dict[str, list[str]]


@dataclass(frozen=True)
class TrainedModel:
    logistic: LogisticModel
    forest: ForestModel
    standardizer: Standardizer
    numeric_means: dict[str, float]
    category_values: dict[str, list[str]]
    threshold: float
    metrics: dict[str, object]
    baseline: dict[str, object]
    train_rows: int
    validation_rows: int
    test_rows: int
    dataset_fingerprint: str | None = None
    split_fingerprint: str | None = None


def _date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _decimal(value: object) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return value if isinstance(value, Decimal) else Decimal(str(value))
    except (ValueError, ArithmeticError):
        return None


def _observation_rows(observations: Iterable[PaimanaObservation]) -> dict[str, list[PaimanaObservation]]:
    grouped: dict[str, list[PaimanaObservation]] = {}
    for observation in observations:
        if observation.match_status != "matched" or not observation.project_identity or observation.reporting_period is None:
            continue
        grouped.setdefault(observation.project_identity, []).append(observation)
    for rows in grouped.values():
        rows.sort(key=lambda row: (row.reporting_period, str(row.id)))
    return grouped


def _days_from_cutoff(value: object, cutoff: date) -> int | None:
    parsed = _date(value)
    return (parsed - cutoff).days if parsed is not None else None


def _feature_values(history: list[PaimanaObservation], index: int) -> dict[str, object]:
    previous = history[index]
    cutoff = previous.reporting_period
    assert cutoff is not None
    planned = previous.original_completion_date
    previous_progress = _decimal(previous.physical_progress)
    earlier_progress = _decimal(history[index - 1].physical_progress) if index >= 1 else None
    previous_expenditure = _decimal(previous.cumulative_expenditure)
    earlier_expenditure = _decimal(history[index - 1].cumulative_expenditure) if index >= 1 else None
    start_date = _date(previous.start_date)
    age_months = None
    if start_date is not None:
        age_months = (cutoff.year - start_date.year) * 12 + cutoff.month - start_date.month
    revisions = 0
    for position in range(1, index + 1):
        earlier = _date(history[position - 1].revised_completion_date)
        current = _date(history[position].revised_completion_date)
        if earlier is not None and current is not None and earlier != current:
            revisions += 1
    return {
        "planned_completion_days": _days_from_cutoff(planned, cutoff),
        "previous_reported_completion_days": _days_from_cutoff(previous.revised_completion_date, cutoff),
        "previous_physical_progress": previous_progress,
        "previous_expenditure": previous_expenditure,
        "project_age_months": age_months,
        "progress_velocity": previous_progress - earlier_progress if previous_progress is not None and earlier_progress is not None else None,
        "expenditure_progression": previous_expenditure - earlier_expenditure if previous_expenditure is not None and earlier_expenditure is not None else None,
        "prior_schedule_revisions": revisions,
        "observation_count": index + 1,
        "implementing_agency": previous.implementing_agency,
        "state": previous.state,
    }


def build_dataset(observations: Iterable[PaimanaObservation], projects: Iterable[Project] = ()) -> Dataset:
    project_map = {project.project_identity: project for project in projects if project.project_identity}
    rows: list[HistoricalRow] = []
    for identity, history in _observation_rows(observations).items():
        if len(history) < 2:
            continue
        for index in range(1, len(history)):
            previous = _date(history[index - 1].revised_completion_date)
            current = _date(history[index].revised_completion_date)
            if previous is None or current is None:
                continue
            cutoff = history[index - 1].reporting_period
            target_period = history[index].reporting_period
            if cutoff is None or target_period is None:
                continue
            rows.append(HistoricalRow(
                project_identity=identity,
                project_id=project_map.get(identity).id if project_map.get(identity) else None,
                cutoff_reporting_period=cutoff,
                target_reporting_period=target_period,
                target=int(current != previous),
                values=_feature_values(history, index - 1),
            ))
    rows.sort(key=lambda row: (row.cutoff_reporting_period, row.project_identity, row.target_reporting_period))
    return Dataset(rows=rows)


def _encode(rows: list[HistoricalRow], numeric_means: dict[str, float] | None = None, category_values: dict[str, list[str]] | None = None) -> EncodedDataset:
    numeric_means = dict(numeric_means or {})
    category_values = {name: list(values) for name, values in (category_values or {}).items()}
    for name in NUMERIC_FEATURES:
        if name not in numeric_means:
            values = [float(row.values[name]) for row in rows if row.values[name] is not None]
            numeric_means[name] = float(np.mean(values)) if values else 0.0
    for name in CATEGORICAL_FEATURES:
        if name not in category_values:
            category_values[name] = sorted({str(row.values[name]) for row in rows if row.values[name] not in (None, "")})
    columns: list[list[float]] = []
    for row in rows:
        values = [float(row.values[name]) if row.values[name] is not None else numeric_means[name] for name in NUMERIC_FEATURES]
        for name in CATEGORICAL_FEATURES:
            current = str(row.values[name]) if row.values[name] not in (None, "") else "__MISSING__"
            values.extend(float(current == category) for category in category_values[name])
        columns.append(values)
    width = len(NUMERIC_FEATURES) + sum(len(values) for values in category_values.values())
    matrix = np.asarray(columns, dtype=float) if columns else np.empty((0, width))
    return EncodedDataset(matrix, np.asarray([row.target for row in rows], dtype=int), rows, numeric_means, category_values)


def _fit_standardizer(matrix: np.ndarray) -> Standardizer:
    means = matrix.mean(axis=0) if len(matrix) else np.zeros(matrix.shape[1])
    scales = matrix.std(axis=0) if len(matrix) else np.ones(matrix.shape[1])
    scales[scales == 0] = 1
    return Standardizer(means, scales)


def _probability(model: TrainedModel, encoded: EncodedDataset) -> np.ndarray:
    return (_predict_logistic(model.logistic, model.standardizer, encoded.matrix) + _predict_forest(model.forest, encoded.matrix)) / 2


def _baseline_metrics(targets: np.ndarray) -> dict[str, object]:
    if not len(targets):
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "roc_auc": None, "pr_auc": None, "confusion_matrix": [[0, 0], [0, 0]]}
    probability = float(targets.mean())
    return _metrics(targets, np.full(len(targets), probability), threshold=0.5)


def train_model(dataset: Dataset) -> TrainedModel:
    if len(dataset.rows) < MIN_TRAINING_ROWS:
        raise ValueError(f"At least {MIN_TRAINING_ROWS} leakage-safe historical rows are required")
    train_rows, validation_rows, test_rows = time_aware_split(dataset)
    if not validation_rows or not test_rows or len({row.target for row in train_rows}) < 2:
        raise ValueError("Historical rows do not support time-aware train/validation/test splits")
    train = _encode(train_rows)
    validation = _encode(validation_rows, train.numeric_means, train.category_values)
    test = _encode(test_rows, train.numeric_means, train.category_values)
    standardizer = _fit_standardizer(train.matrix)
    logistic = _fit_logistic(train.matrix, train.targets, standardizer)
    forest = _fit_forest(train.matrix, train.targets)
    from app.services.prediction_metadata import dataset_fingerprint, select_validation_threshold, split_fingerprint
    provisional = TrainedModel(logistic, forest, standardizer, train.numeric_means, train.category_values, 0.5, {}, {}, len(train_rows), len(validation_rows), len(test_rows))
    validation_probability = _probability(provisional, validation)
    threshold = select_validation_threshold(validation.targets, validation_probability)
    test_probability = _probability(provisional, test)
    split = (train_rows, validation_rows, test_rows)
    metrics = _metrics(test.targets, test_probability, threshold=threshold)
    return TrainedModel(logistic, forest, standardizer, train.numeric_means, train.category_values, threshold, metrics, _baseline_metrics(test.targets), len(train_rows), len(validation_rows), len(test_rows), dataset_fingerprint(dataset), split_fingerprint(dataset, split))


def time_aware_split(dataset: Dataset) -> tuple[list[HistoricalRow], list[HistoricalRow], list[HistoricalRow]]:
    periods = sorted({row.cutoff_reporting_period for row in dataset.rows})
    if len(periods) < 3:
        raise ValueError("Historical rows do not support time-aware train/validation/test splits")
    first_boundary = periods[max(0, int(len(periods) * 0.6) - 1)]
    second_boundary = periods[max(0, int(len(periods) * 0.8) - 1)]
    train_rows = [row for row in dataset.rows if row.cutoff_reporting_period <= first_boundary]
    validation_rows = [row for row in dataset.rows if first_boundary < row.cutoff_reporting_period <= second_boundary]
    test_rows = [row for row in dataset.rows if row.cutoff_reporting_period > second_boundary]
    return train_rows, validation_rows, test_rows


def test_probabilities(dataset: Dataset, model: TrainedModel) -> tuple[list[HistoricalRow], np.ndarray]:
    _, _, rows = time_aware_split(dataset)
    encoded = _encode(rows, model.numeric_means, model.category_values)
    return rows, _probability(model, encoded)


def _artifact_dict(model: TrainedModel) -> dict[str, object]:
    return {
        "model_version": MODEL_VERSION,
        "feature_names": list(FEATURE_NAMES),
        "numeric_means": model.numeric_means,
        "category_values": model.category_values,
        "logistic_weights": model.logistic.weights.tolist(),
        "logistic_bias": model.logistic.bias,
        "forest_stumps": [stump.__dict__ for stump in model.forest.stumps],
        "standardizer_means": model.standardizer.means.tolist(),
        "standardizer_scales": model.standardizer.scales.tolist(),
        "threshold": model.threshold,
        "metrics": model.metrics,
        "baseline": model.baseline,
        "train_rows": model.train_rows,
        "validation_rows": model.validation_rows,
        "test_rows": model.test_rows,
        "dataset_fingerprint": model.dataset_fingerprint,
        "split_fingerprint": model.split_fingerprint,
    }


def save_artifact(model: TrainedModel, path: Path = ARTIFACT_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_artifact_dict(model), indent=2), encoding="utf-8")
    return path


def load_artifact(path: Path = ARTIFACT_PATH) -> TrainedModel:
    data = json.loads(path.read_text(encoding="utf-8"))
    return TrainedModel(
        logistic=LogisticModel(np.asarray(data["logistic_weights"]), data["logistic_bias"]),
        forest=ForestModel(tuple(TreeStump(**stump) for stump in data["forest_stumps"])),
        standardizer=Standardizer(np.asarray(data["standardizer_means"]), np.asarray(data["standardizer_scales"])),
        numeric_means=data["numeric_means"], category_values=data["category_values"], threshold=data["threshold"],
        metrics=data["metrics"], baseline=data.get("baseline", {}), train_rows=data["train_rows"], validation_rows=data["validation_rows"], test_rows=data["test_rows"], dataset_fingerprint=data.get("dataset_fingerprint"), split_fingerprint=data.get("split_fingerprint"),
    )


def build_training_dataset(database: Session) -> Dataset:
    observations = list(database.scalars(select(PaimanaObservation).order_by(PaimanaObservation.reporting_period.asc(), PaimanaObservation.id.asc())).all())
    projects = list(database.scalars(select(Project)).all())
    return build_dataset(observations, projects)


def ensure_artifact(database: Session) -> tuple[TrainedModel | None, Dataset]:
    dataset = build_training_dataset(database)
    if ARTIFACT_PATH.exists():
        model = load_artifact()
        from app.services.prediction_metadata import dataset_fingerprint, split_fingerprint
        try:
            expected_split = split_fingerprint(dataset, time_aware_split(dataset))
        except ValueError:
            expected_split = None
        if model.dataset_fingerprint == dataset_fingerprint(dataset) and model.split_fingerprint == expected_split:
            return model, dataset
    try:
        model = train_model(dataset)
    except ValueError:
        return None, dataset
    save_artifact(model)
    return model, dataset


def _prediction_features(history: list[PaimanaObservation]) -> tuple[dict[str, object] | None, date | None]:
    history = sorted([row for row in history if row.reporting_period is not None], key=lambda row: (row.reporting_period, str(row.id)))
    if len(history) < 2 or _date(history[-1].revised_completion_date) is None:
        return None, history[-1].reporting_period if history else None
    return _feature_values(history, len(history) - 1), history[-1].reporting_period


def predict_project(database: Session, project_id: UUID) -> ScheduleRevisionPrediction:
    project = database.get(Project, project_id)
    if project is None:
        raise LookupError("Project not found")
    observations = list(database.scalars(select(PaimanaObservation).where(PaimanaObservation.project_id == project_id, PaimanaObservation.match_status == "matched")).all())
    if not observations and project.project_identity:
        observations = list(database.scalars(select(PaimanaObservation).where(PaimanaObservation.project_identity == project.project_identity, PaimanaObservation.match_status == "matched")).all())
    model, dataset = ensure_artifact(database)
    features, cutoff = _prediction_features(observations)
    if model is None or features is None:
        return ScheduleRevisionPrediction(project_id=project_id, availability="INSUFFICIENT_DATA", model_version=MODEL_VERSION, cutoff_reporting_period=cutoff, feature_coverage=Decimal("0"), limitations=[f"At least two matched observations with valid reported completion dates are required; {len(dataset.rows)} usable training rows are available.", "No prediction is returned."])
    row = HistoricalRow(str(project.project_identity or project_id), project_id, cutoff or date.today(), cutoff or date.today(), 0, features)
    encoded = _encode([row], model.numeric_means, model.category_values)
    probability = float(_probability(model, encoded)[0])
    present = sum(features[name] is not None for name in NUMERIC_FEATURES) + sum(features[name] not in (None, "") for name in CATEGORICAL_FEATURES)
    coverage = Decimal(present) / Decimal(len(FEATURE_NAMES))
    limitations = ["Predicts whether a later PAIMANA observation reports a changed completion date; it is not an actual or audited time-overrun prediction.", "Model is trained on leakage-safe historical reporting rows."]
    roc_auc = model.metrics.get("roc_auc")
    pr_auc = model.metrics.get("pr_auc")
    if (isinstance(roc_auc, (int, float)) and roc_auc < 0.5) or (isinstance(pr_auc, (int, float)) and pr_auc < 0.25):
        limitations.append("Held-out ranking performance is weak; treat this signal as advisory and validate against subsequent reported observations.")
    return ScheduleRevisionPrediction(project_id=project_id, availability="AVAILABLE", prediction=probability >= model.threshold, probability=Decimal(str(probability)), model_version=MODEL_VERSION, cutoff_reporting_period=cutoff, feature_coverage=coverage, limitations=limitations)
