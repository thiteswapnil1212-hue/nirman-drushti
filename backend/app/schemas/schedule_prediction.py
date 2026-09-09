from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


SchedulePredictionAvailability = Literal["AVAILABLE", "INSUFFICIENT_DATA", "UNAVAILABLE"]


class ScheduleRevisionPrediction(BaseModel):
    project_id: UUID
    availability: SchedulePredictionAvailability
    prediction: bool | None = None
    probability: Decimal | None = Field(default=None, ge=0, le=1)
    model_version: str
    cutoff_reporting_period: date | None = None
    feature_coverage: Decimal = Field(ge=0, le=1)
    limitations: list[str]
