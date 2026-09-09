from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MLEvaluationResult(BaseModel):
    task: Literal["cost_revision", "schedule_revision"]
    approach: Literal["conventional", "ml"]
    sample_count: int
    positive_rate: float = Field(ge=0, le=1)
    precision: float = Field(ge=0, le=1)
    recall: float = Field(ge=0, le=1)
    f1: float = Field(ge=0, le=1)
    roc_auc: float | None = Field(default=None, ge=0, le=1)
    pr_auc: float | None = Field(default=None, ge=0, le=1)
    confusion_matrix: list[list[int]]


class MLEvaluationResponse(BaseModel):
    availability: Literal["AVAILABLE", "INSUFFICIENT_DATA"]
    cost_comparison: list[MLEvaluationResult]
    schedule_comparison: list[MLEvaluationResult]
    conclusion: dict[str, str]
    evaluation_version: str
    evaluation_timestamp: datetime
    limitations: list[str]
