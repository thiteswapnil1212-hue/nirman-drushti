from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


RiskLevel = Literal["LOW", "MODERATE", "HIGH", "CRITICAL", "UNAVAILABLE"]
RiskSeverity = Literal["LOW", "MODERATE", "HIGH", "CRITICAL", "UNAVAILABLE"]
DataClassification = Literal["REPORTED", "DERIVED", "UNAVAILABLE"]
AssessmentAvailability = Literal["AVAILABLE", "INSUFFICIENT_DATA", "UNAVAILABLE"]


class RiskFactor(BaseModel):
    factor: str
    value: Decimal | str | None = None
    unit: str | None = None
    contribution: int | None = None
    severity: RiskSeverity
    classification: DataClassification
    available: bool
    explanation: str


class RiskAssessment(BaseModel):
    project_id: UUID
    score: int | None = Field(default=None, ge=0, le=100)
    level: RiskLevel
    availability: AssessmentAvailability
    data_coverage: Decimal = Field(ge=0, le=1)
    confidence_label: str
    factors: list[RiskFactor]
    explanation: str
    limitations: list[str]
    predicted: bool = False


class RiskPortfolioItem(BaseModel):
    project_id: UUID
    project_name: str
    score: int | None
    level: RiskLevel
    data_coverage: Decimal
    cost_pressure: int | None
    schedule_pressure: int | None
    progress_pressure: int | None


class RiskSummary(BaseModel):
    projects_assessed: int
    projects_unavailable: int
    low_projects: int
    moderate_projects: int
    high_projects: int
    critical_projects: int
    average_score: Decimal | None
    average_data_coverage: Decimal | None
    top_projects: list[RiskPortfolioItem]
    limitations: list[str]


class RiskSummaryResponse(BaseModel):
    availability: AssessmentAvailability
    summary: RiskSummary
