from __future__ import annotations

import hashlib
import json
from typing import Any, Iterable

import numpy as np

from app.services.cost_prediction import _metrics


def _row_payload(row: Any) -> dict[str, object]:
    return {
        "project_identity": row.project_identity,
        "cutoff_reporting_period": row.cutoff_reporting_period,
        "target_reporting_period": row.target_reporting_period,
        "target": row.target,
        "values": row.values,
    }


def _fingerprint(payload: object) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def dataset_fingerprint(dataset: Any) -> str:
    return _fingerprint({"feature_names": dataset.feature_names, "rows": [_row_payload(row) for row in dataset.rows]})


def split_fingerprint(dataset: Any, partitions: tuple[Iterable[Any], Iterable[Any], Iterable[Any]]) -> str:
    labels = ("train", "validation", "test")
    payload = {label: [_row_payload(row) for row in rows] for label, rows in zip(labels, partitions)}
    return _fingerprint({"dataset": dataset_fingerprint(dataset), "partitions": payload})


def select_validation_threshold(targets: np.ndarray, probabilities: np.ndarray) -> float:
    if not len(targets):
        return 0.5
    candidates = sorted({0.5, *(float(value) for value in probabilities)})
    best_threshold = 0.5
    best_score = (-1.0, -1.0, float("-inf"))
    for threshold in candidates:
        metrics = _metrics(targets, probabilities, threshold=threshold)
        score = (float(metrics["f1"]), float(metrics["recall"]), -abs(threshold - 0.5))
        if score > best_score:
            best_score = score
            best_threshold = threshold
    return best_threshold
