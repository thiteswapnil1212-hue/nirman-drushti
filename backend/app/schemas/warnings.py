from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


WarningType = Literal[
    "COST_ESCALATION",
    "SCHEDULE_EXTENSION",
    "EXPENDITURE_PROGRESS_DIVERGENCE",
    "PROGRESS_SLOWDOWN",
    "DATA_QUALITY",
]
WarningSeverity = Literal["INFO", "MODERATE", "HIGH", "CRITICAL"]
WarningSource = Literal["REPORTED", "DERIVED", "DATA_QUALITY"]
EvidenceValue = str | int | float | bool | Decimal | None


class WarningEvidence(BaseModel):
    values: dict[str, EvidenceValue]


class EarlyWarning(BaseModel):
    warning_id: str
    project_id: UUID
    project_name: str
    type: WarningType
    severity: WarningSeverity
    title: str
    message: str
    evidence: WarningEvidence
    recommended_action: str
    source_type: WarningSource
    generated_at: datetime


class WarningSummary(BaseModel):
    critical: int
    high: int
    moderate: int
    info: int
    total: int


class WarningListResponse(BaseModel):
    summary: WarningSummary
    items: list[EarlyWarning]
    limitations: list[str]
    page: int
    page_size: int
