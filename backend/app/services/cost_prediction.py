from __future__ import annotations

import json
import math
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
from app.schemas.cost_prediction import CostRevisionPrediction, CostPredictionSignal, CostPredictionExplanation

MODEL_VERSION = "cost-revision-v1"
ARTIFACT_PATH = Path(__file__).resolve().parents[2] / "ml_artifacts" / "cost_revision_model.json"
FEATURE_NAMES = (
    "original_cost",
    "previous_current_cost",
    "previous_expenditure",
    "previous_physical_progress",
    "prior_cost_escalation_pct",
    "prior_expenditure_pct",
    "prior_progress_change",
    "project_age_months",
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
class Standardizer:
    means: np.ndarray
    scales: np.ndarray


@dataclass(frozen=True)
class LogisticModel:
    weights: np.ndarray
    bias: float


@dataclass(frozen=True)
class TreeStump:
    feature_index: int
    threshold: float
    left_probability: float
    right_probability: float


@dataclass(frozen=True)
class ForestModel:
    stumps: tuple[TreeStump, ...]


@dataclass(frozen=True)
class TrainedModel:
    logistic: LogisticModel
    forest: ForestModel
    standardizer: Standardizer
    numeric_means: dict[str, float]
    category_values: dict[str, list[str]]
    threshold: float
    metrics: dict[str, object]
    train_rows: int
    validation_rows: int
    test_rows: int
    dataset_fingerprint: str | None = None
    split_fingerprint: str | None = None


def _decimal(value: object) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return value if isinstance(value, Decimal) else Decimal(str(value))
    except (ValueError, ArithmeticError):
        return None


def _date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _safe_divide(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator * Decimal("100")


def _reporting_period(row: PaimanaObservation) -> date | None:
    return row.reporting_period


def _observation_rows(observations: Iterable[PaimanaObservation]) -> dict[str, list[PaimanaObservation]]:
    grouped: dict[str, list[PaimanaObservation]] = {}
    for observation in observations:
        if observation.match_status != "matched" or not observation.project_identity or observation.reporting_period is None:
            continue
        grouped.setdefault(observation.project_identity, []).append(observation)
    for rows in grouped.values():
        rows.sort(key=lambda row: (row.reporting_period, str(row.id)))
    return grouped


def _feature_values(history: list[PaimanaObservation], index: int) -> dict[str, object]:
    current = history[index]
    previous = history[index - 1]
    original_cost = _decimal(previous.original_cost)
    previous_cost = _decimal(previous.revised_cost)
    previous_expenditure = _decimal(previous.cumulative_expenditure)
    previous_progress = _decimal(previous.physical_progress)
    prior_escalation = _safe_divide(previous_cost - original_cost if previous_cost is not None and original_cost is not None else None, original_cost)
    prior_expenditure_pct = _safe_divide(previous_expenditure, previous_cost)
    before_previous_progress = _decimal(history[index - 2].physical_progress) if index >= 2 else None
    prior_progress_change = previous_progress - before_previous_progress if previous_progress is not None and before_previous_progress is not None else None
    start_date = _date(previous.start_date)
    age_months = None
    if start_date is not None and previous.reporting_period is not None:
        age_months = (previous.reporting_period.year - start_date.year) * 12 + previous.reporting_period.month - start_date.month
    return {
        "original_cost": original_cost,
        "previous_current_cost": previous_cost,
        "previous_expenditure": previous_expenditure,
        "previous_physical_progress": previous_progress,
        "prior_cost_escalation_pct": prior_escalation,
        "prior_expenditure_pct": prior_expenditure_pct,
        "prior_progress_change": prior_progress_change,
        "project_age_months": age_months,
        "observation_count": index,
        "implementing_agency": previous.implementing_agency,
        "state": previous.state,
    }


def build_dataset(observations: Iterable[PaimanaObservation], projects: Iterable[Project] = ()) -> Dataset:
    project_ids = {project.project_identity: project.id for project in projects if project.project_identity}
    rows: list[HistoricalRow] = []
    for identity, history in _observation_rows(observations).items():
        if len(history) < 2:
            continue
        for index in range(1, len(history)):
            previous = history[index - 1]
            current = history[index]
            previous_cost = _decimal(previous.revised_cost)
            current_cost = _decimal(current.revised_cost)
            if previous_cost is None or current_cost is None:
                continue
            rows.append(HistoricalRow(
                project_identity=identity,
                project_id=project_ids.get(identity),
                cutoff_reporting_period=previous.reporting_period,
                target_reporting_period=current.reporting_period,
                target=int(current_cost != previous_cost),
                values=_feature_values(history, index),
            ))
    rows.sort(key=lambda row: (row.cutoff_reporting_period, row.project_identity, row.target_reporting_period))
    return Dataset(rows=rows)


def _encode(dataset: Dataset, rows: list[HistoricalRow], numeric_means: dict[str, float] | None = None, category_values: dict[str, list[str]] | None = None) -> EncodedDataset:
    numeric_means = numeric_means or {}
    category_values = category_values or {}
    if not numeric_means:
        for name in NUMERIC_FEATURES:
            values = [float(row.values[name]) for row in rows if row.values[name] is not None]
            numeric_means[name] = float(np.mean(values)) if values else 0.0
    if not category_values:
        for name in CATEGORICAL_FEATURES:
            category_values[name] = sorted({str(row.values[name]) for row in rows if row.values[name] not in (None, "")})
    columns: list[list[float]] = []
    for row in rows:
        values: list[float] = []
        for name in NUMERIC_FEATURES:
            value = row.values[name]
            values.append(float(value) if value is not None else numeric_means[name])
        for name in CATEGORICAL_FEATURES:
            current = str(row.values[name]) if row.values[name] not in (None, "") else "__MISSING__"
            values.extend(float(current == category) for category in category_values[name])
        columns.append(values)
    matrix = np.asarray(columns, dtype=float) if columns else np.empty((0, len(NUMERIC_FEATURES) + sum(len(values) for values in category_values.values())))
    return EncodedDataset(matrix, np.asarray([row.target for row in rows], dtype=int), rows, numeric_means, category_values)


def _fit_standardizer(matrix: np.ndarray) -> Standardizer:
    means = matrix.mean(axis=0) if len(matrix) else np.zeros(matrix.shape[1])
    scales = matrix.std(axis=0) if len(matrix) else np.ones(matrix.shape[1])
    scales[scales == 0] = 1
    return Standardizer(means, scales)


def _sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -30, 30)
    return 1 / (1 + np.exp(-clipped))


def _fit_logistic(matrix: np.ndarray, targets: np.ndarray, standardizer: Standardizer, epochs: int = 500, learning_rate: float = 0.05) -> LogisticModel:
    transformed = (matrix - standardizer.means) / standardizer.scales
    weights = np.zeros(transformed.shape[1])
    bias = 0.0
    positive_weight = len(targets) / max(1, 2 * int(targets.sum())) if targets.sum() else 1.0
    negative_weight = len(targets) / max(1, 2 * int((targets == 0).sum())) if (targets == 0).sum() else 1.0
    sample_weights = np.where(targets == 1, positive_weight, negative_weight)
    for _ in range(epochs):
        probabilities = _sigmoid(transformed @ weights + bias)
        error = (probabilities - targets) * sample_weights
        weights -= learning_rate * ((transformed.T @ error) / len(targets) + 0.01 * weights)
        bias -= learning_rate * float(error.mean())
    return LogisticModel(weights, bias)


def _fit_forest(matrix: np.ndarray, targets: np.ndarray, count: int = 25) -> ForestModel:
    stumps: list[TreeStump] = []
    rng = np.random.default_rng(42)
    for _ in range(count):
        sample_indices = rng.integers(0, len(matrix), len(matrix))
        feature_index = int(rng.integers(0, matrix.shape[1]))
        values = matrix[sample_indices, feature_index]
        threshold = float(np.median(values))
        left = targets[sample_indices][values <= threshold]
        right = targets[sample_indices][values > threshold]
        stumps.append(TreeStump(feature_index, threshold, float(left.mean()) if len(left) else float(targets.mean()), float(right.mean()) if len(right) else float(targets.mean())))
    return ForestModel(tuple(stumps))


def _predict_logistic(model: LogisticModel, standardizer: Standardizer, matrix: np.ndarray) -> np.ndarray:
    transformed = (matrix - standardizer.means) / standardizer.scales
    return _sigmoid(transformed @ model.weights + model.bias)


def _predict_forest(model: ForestModel, matrix: np.ndarray) -> np.ndarray:
    if not model.stumps:
        return np.full(len(matrix), 0.5)
    predictions = []
    for stump in model.stumps:
        predictions.append(np.where(matrix[:, stump.feature_index] <= stump.threshold, stump.left_probability, stump.right_probability))
    return np.asarray(predictions).mean(axis=0)


def _auc(targets: np.ndarray, probabilities: np.ndarray, precision_recall: bool = False) -> float | None:
    positives = int(targets.sum())
    negatives = len(targets) - positives
    if positives == 0 or negatives == 0:
        return None
    order = np.argsort(-probabilities)
    sorted_targets = targets[order]
    cumulative_positive = np.cumsum(sorted_targets)
    cumulative_negative = np.cumsum(1 - sorted_targets)
    if precision_recall:
        precision = cumulative_positive / np.maximum(1, np.arange(len(targets)) + 1)
        recall = cumulative_positive / positives
        return float(np.trapezoid(np.r_[0, precision], np.r_[0, recall]))
    ranks = np.argsort(np.argsort(probabilities)) + 1
    return float((ranks[targets == 1].sum() - positives * (positives + 1) / 2) / (positives * negatives))


def _metrics(targets: np.ndarray, probabilities: np.ndarray, threshold: float = 0.5) -> dict[str, object]:
    predictions = probabilities >= threshold
    tp = int(((predictions == 1) & (targets == 1)).sum())
    tn = int(((predictions == 0) & (targets == 0)).sum())
    fp = int(((predictions == 1) & (targets == 0)).sum())
    fn = int(((predictions == 0) & (targets == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1, "roc_auc": _auc(targets, probabilities), "pr_auc": _auc(targets, probabilities, True), "confusion_matrix": [[tn, fp], [fn, tp]]}


def train_model(dataset: Dataset) -> TrainedModel:
    if len(dataset.rows) < 20:
        raise ValueError("At least 20 leakage-safe historical rows are required")
    train_rows, validation_rows, test_rows = time_aware_split(dataset)
    if not validation_rows or not test_rows or len({row.target for row in train_rows}) < 2:
        raise ValueError("Historical rows do not support time-aware train/validation/test splits")
    train = _encode(dataset, train_rows)
    validation = _encode(dataset, validation_rows, train.numeric_means, train.category_values)
    test = _encode(dataset, test_rows, train.numeric_means, train.category_values)
    standardizer = _fit_standardizer(train.matrix)
    logistic = _fit_logistic(train.matrix, train.targets, standardizer)
    forest = _fit_forest(train.matrix, train.targets)
    validation_probability = (_predict_logistic(logistic, standardizer, validation.matrix) + _predict_forest(forest, validation.matrix)) / 2
    from app.services.prediction_metadata import dataset_fingerprint, select_validation_threshold, split_fingerprint
    threshold = select_validation_threshold(validation.targets, validation_probability)
    split = (train_rows, validation_rows, test_rows)
    test_probability = (_predict_logistic(logistic, standardizer, test.matrix) + _predict_forest(forest, test.matrix)) / 2
    return TrainedModel(logistic, forest, standardizer, train.numeric_means, train.category_values, threshold, _metrics(test.targets, test_probability, threshold=threshold), len(train_rows), len(validation_rows), len(test_rows), dataset_fingerprint(dataset), split_fingerprint(dataset, split))


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
    encoded = _encode(dataset, rows, model.numeric_means, model.category_values)
    probabilities = (_predict_logistic(model.logistic, model.standardizer, encoded.matrix) + _predict_forest(model.forest, encoded.matrix)) / 2
    return rows, probabilities


def _artifact_dict(model: TrainedModel) -> dict[str, object]:
    return {"model_version": MODEL_VERSION, "feature_names": list(FEATURE_NAMES), "numeric_means": model.numeric_means, "category_values": model.category_values, "logistic_weights": model.logistic.weights.tolist(), "logistic_bias": model.logistic.bias, "forest_stumps": [stump.__dict__ for stump in model.forest.stumps], "standardizer_means": model.standardizer.means.tolist(), "standardizer_scales": model.standardizer.scales.tolist(), "threshold": model.threshold, "metrics": model.metrics, "train_rows": model.train_rows, "validation_rows": model.validation_rows, "test_rows": model.test_rows, "dataset_fingerprint": model.dataset_fingerprint, "split_fingerprint": model.split_fingerprint}


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
        numeric_means=data["numeric_means"], category_values=data["category_values"], threshold=data["threshold"], metrics=data["metrics"], train_rows=data["train_rows"], validation_rows=data["validation_rows"], test_rows=data["test_rows"], dataset_fingerprint=data.get("dataset_fingerprint"), split_fingerprint=data.get("split_fingerprint"),
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
    if len(history) < 2:
        return None, history[-1].reporting_period if history else None
    return _feature_values(history, len(history) - 1), history[-1].reporting_period


def predict_project(database: Session, project_id: UUID) -> CostRevisionPrediction:
    project = database.get(Project, project_id)
    if project is None:
        raise LookupError("Project not found")
    observations = list(database.scalars(select(PaimanaObservation).where(PaimanaObservation.project_id == project_id, PaimanaObservation.match_status == "matched")).all())
    if not observations and project.project_identity:
        observations = list(database.scalars(select(PaimanaObservation).where(PaimanaObservation.project_identity == project.project_identity, PaimanaObservation.match_status == "matched")).all())
    model, dataset = ensure_artifact(database)
    features, cutoff = _prediction_features(observations)
    if model is None or features is None:
        return CostRevisionPrediction(project_id=project_id, availability="INSUFFICIENT_DATA", model_version=MODEL_VERSION, cutoff_reporting_period=cutoff, feature_coverage=Decimal("0"), features_used=list(FEATURE_NAMES), limitations=["At least two matched observations with prior and current reported costs are required.", "No prediction is returned."])
    row = HistoricalRow(str(project.project_identity or project_id), project_id, cutoff or date.today(), cutoff or date.today(), 0, features)
    encoded = _encode(Dataset([row]), [row], model.numeric_means, model.category_values)
    probability = float((_predict_logistic(model.logistic, model.standardizer, encoded.matrix)[0] + _predict_forest(model.forest, encoded.matrix)[0]) / 2)
    present = sum(features[name] is not None for name in NUMERIC_FEATURES) + sum(features[name] not in (None, "") for name in CATEGORICAL_FEATURES)
    coverage = Decimal(present) / Decimal(len(FEATURE_NAMES))
    
    signals: list[CostPredictionSignal] = []
    for feature_name in FEATURE_NAMES:
        if feature_name in NUMERIC_FEATURES and features.get(feature_name) is None:
            continue
        if feature_name in CATEGORICAL_FEATURES and features.get(feature_name) in (None, ""):
            continue
            
        modified_features = features.copy()
        modified_features[feature_name] = None
        
        mod_row = HistoricalRow(str(project.project_identity or project_id), project_id, cutoff or date.today(), cutoff or date.today(), 0, modified_features)
        mod_encoded = _encode(Dataset([mod_row]), [mod_row], model.numeric_means, model.category_values)
        mod_prob = float((_predict_logistic(model.logistic, model.standardizer, mod_encoded.matrix)[0] + _predict_forest(model.forest, mod_encoded.matrix)[0]) / 2)
        
        contribution = probability - mod_prob
        
        val = features[feature_name]
        formatted_val = str(val)
        if isinstance(val, Decimal):
            if feature_name in ("original_cost", "previous_current_cost", "previous_expenditure"):
                formatted_val = f"₹{val.quantize(Decimal('0.01'))} Cr"
            elif feature_name in ("previous_physical_progress", "prior_cost_escalation_pct", "prior_expenditure_pct", "prior_progress_change"):
                formatted_val = f"{val.quantize(Decimal('0.1'))}%"
            else:
                formatted_val = f"{val.quantize(Decimal('0.1'))}"
        elif isinstance(val, (int, float)):
            formatted_val = str(val)
            
        signals.append(CostPredictionSignal(
            feature=feature_name,
            value=formatted_val,
            contribution=Decimal(str(round(contribution, 4)))
        ))
        
    positive_signals = sorted([s for s in signals if s.contribution > Decimal("0.005")], key=lambda x: x.contribution, reverse=True)
    negative_signals = sorted([s for s in signals if s.contribution < Decimal("-0.005")], key=lambda x: x.contribution)
    
    explanation = CostPredictionExplanation(
        positive_signals=positive_signals,
        negative_signals=negative_signals,
        model_note="These are model signals, not causal explanations."
    )
    
    return CostRevisionPrediction(project_id=project_id, availability="AVAILABLE", prediction=probability >= model.threshold, probability=Decimal(str(probability)), confidence_label="Historical feature coverage", model_version=MODEL_VERSION, cutoff_reporting_period=cutoff, feature_coverage=coverage, features_used=list(FEATURE_NAMES), limitations=["Predicts future reported cost revision, not final or audited cost overrun.", "Model is trained on leakage-safe historical reporting rows."], explanation=explanation)
