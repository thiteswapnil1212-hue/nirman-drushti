from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


PredictionAvailability = Literal["AVAILABLE", "INSUFFICIENT_DATA", "UNAVAILABLE"]


class CostPredictionSignal(BaseModel):
    feature: str
    value: str
    contribution: Decimal


class CostPredictionExplanation(BaseModel):
    positive_signals: list[CostPredictionSignal]
    negative_signals: list[CostPredictionSignal]
    model_note: str


class CostRevisionPrediction(BaseModel):
    project_id: UUID
    availability: PredictionAvailability
    prediction: bool | None = None
    probability: Decimal | None = Field(default=None, ge=0, le=1)
    confidence_label: str | None = None
    model_version: str
    cutoff_reporting_period: date | None = None
    feature_coverage: Decimal = Field(ge=0, le=1)
    features_used: list[str]
    limitations: list[str]
    explanation: CostPredictionExplanation | None = None
