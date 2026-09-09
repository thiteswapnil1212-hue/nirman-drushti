from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

import numpy as np
from sqlalchemy.orm import Session

from app.schemas.ml_evaluation import MLEvaluationResponse, MLEvaluationResult
from app.services import cost_prediction, schedule_prediction
from app.services.cost_prediction import _metrics

EVALUATION_VERSION = "ml-vs-conventional-v1"


def cost_conventional_probability(row: cost_prediction.HistoricalRow) -> float:
    """Transparent pressure rule using only cutoff features."""
    escalation = row.values.get("prior_cost_escalation_pct")
    expenditure = row.values.get("prior_expenditure_pct")
    return float((escalation is not None and escalation > 0) or (expenditure is not None and expenditure >= 100))


def schedule_conventional_probability(row: schedule_prediction.HistoricalRow) -> float:
    """Transparent schedule-pressure rule using only cutoff features."""
    revisions = row.values.get("prior_schedule_revisions")
    reported_days = row.values.get("previous_reported_completion_days")
    planned_days = row.values.get("planned_completion_days")
    already_revised = revisions is not None and revisions > 0
    later_than_plan = reported_days is not None and planned_days is not None and reported_days > planned_days
    return float(already_revised or later_than_plan)


def evaluation_result(task: str, approach: str, targets: Iterable[int], probabilities: Iterable[float], threshold: float = 0.5) -> MLEvaluationResult:
    target_array = np.asarray(list(targets), dtype=int)
    probability_array = np.asarray(list(probabilities), dtype=float)
    metrics = _metrics(target_array, probability_array, threshold=threshold)
    return MLEvaluationResult(
        task=task,
        approach=approach,
        sample_count=len(target_array),
        positive_rate=float(target_array.mean()) if len(target_array) else 0.0,
        precision=float(metrics["precision"]),
        recall=float(metrics["recall"]),
        f1=float(metrics["f1"]),
        roc_auc=float(metrics["roc_auc"]) if metrics["roc_auc"] is not None else None,
        pr_auc=float(metrics["pr_auc"]) if metrics["pr_auc"] is not None else None,
        confusion_matrix=metrics["confusion_matrix"],
    )


def _conclusion(conventional: MLEvaluationResult, ml: MLEvaluationResult) -> str:
    conventional_scores = [conventional.precision, conventional.recall, conventional.f1, conventional.roc_auc, conventional.pr_auc]
    ml_scores = [ml.precision, ml.recall, ml.f1, ml.roc_auc, ml.pr_auc]
    conventional_mean = sum(value for value in conventional_scores if value is not None) / sum(value is not None for value in conventional_scores)
    ml_mean = sum(value for value in ml_scores if value is not None) / sum(value is not None for value in ml_scores)
    if ml_mean - conventional_mean >= 0.02:
        return "ML better"
    if conventional_mean - ml_mean >= 0.02:
        return "Conventional better"
    return "Similar performance"


def evaluate_database(database: Session) -> MLEvaluationResponse:
    cost_model, cost_dataset = cost_prediction.ensure_artifact(database)
    schedule_model, schedule_dataset = schedule_prediction.ensure_artifact(database)
    cost_results: list[MLEvaluationResult] = []
    schedule_results: list[MLEvaluationResult] = []
    conclusions = {"cost_revision": "INSUFFICIENT_DATA", "schedule_revision": "INSUFFICIENT_DATA"}
    limitations: list[str] = []

    if cost_model is not None:
        try:
            cost_rows, cost_ml_probability = cost_prediction.test_probabilities(cost_dataset, cost_model)
            cost_targets = [row.target for row in cost_rows]
            conventional = evaluation_result("cost_revision", "conventional", cost_targets, [cost_conventional_probability(row) for row in cost_rows])
            ml = evaluation_result("cost_revision", "ml", cost_targets, cost_ml_probability, threshold=cost_model.threshold)
            cost_results = [conventional, ml]
            conclusions["cost_revision"] = _conclusion(conventional, ml)
        except ValueError:
            limitations.append("Cost revision does not have a valid time-aware held-out split.")
    else:
        limitations.append("Cost revision model or sufficient historical data is unavailable.")

    if schedule_model is not None:
        try:
            schedule_rows, schedule_ml_probability = schedule_prediction.test_probabilities(schedule_dataset, schedule_model)
            schedule_targets = [row.target for row in schedule_rows]
            conventional = evaluation_result("schedule_revision", "conventional", schedule_targets, [schedule_conventional_probability(row) for row in schedule_rows])
            ml = evaluation_result("schedule_revision", "ml", schedule_targets, schedule_ml_probability, threshold=schedule_model.threshold)
            schedule_results = [conventional, ml]
            conclusions["schedule_revision"] = _conclusion(conventional, ml)
        except ValueError:
            limitations.append("Schedule revision does not have a valid time-aware held-out split.")
    else:
        limitations.append("Schedule revision model or sufficient historical data is unavailable.")

    available = bool(cost_results and schedule_results)
    return MLEvaluationResponse(
        availability="AVAILABLE" if available else "INSUFFICIENT_DATA",
        cost_comparison=cost_results,
        schedule_comparison=schedule_results,
        conclusion=conclusions,
        evaluation_version=EVALUATION_VERSION,
        evaluation_timestamp=datetime.now(timezone.utc),
        limitations=limitations + ["Comparison uses the same time-aware held-out rows used by each existing ML model.", "Conventional rules are transparent pressure baselines, not retrained models."],
    )
