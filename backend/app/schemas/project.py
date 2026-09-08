from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.project import MilestoneStatus, ProjectStatus


class ProjectBase(BaseModel):
    project_code: str | None = Field(default=None, max_length=64)
    legacy_ocms_code: str | None = Field(default=None, max_length=100)
    pmgid: str | None = Field(default=None, max_length=100)
    name: str | None = None
    ministry: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    sector: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=255)
    state: str | None = Field(default=None, max_length=255)
    implementing_agency: str | None = None
    status: ProjectStatus | None = None
    original_cost: Decimal | None = Field(default=None, ge=0)
    current_cost: Decimal | None = Field(default=None, ge=0)
    expenditure: Decimal | None = Field(default=None, ge=0)
    physical_progress: Decimal | None = Field(default=None, ge=0, le=100)
    expected_progress: Decimal | None = Field(default=None, ge=0, le=100)
    project_identity: str | None = None
    planned_start_date: date | None = None
    planned_completion_date: date | None = None
    expected_completion_date: date | None = None

class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_code: str | None = Field(default=None, max_length=64)
    legacy_ocms_code: str | None = Field(default=None, max_length=100)
    pmgid: str | None = Field(default=None, max_length=100)
    name: str | None = None
    ministry: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    sector: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=255)
    state: str | None = Field(default=None, max_length=255)
    implementing_agency: str | None = None
    status: ProjectStatus | None = None
    original_cost: Decimal | None = Field(default=None, ge=0)
    current_cost: Decimal | None = Field(default=None, ge=0)
    expenditure: Decimal | None = Field(default=None, ge=0)
    physical_progress: Decimal | None = Field(default=None, ge=0, le=100)
    expected_progress: Decimal | None = Field(default=None, ge=0, le=100)
    planned_start_date: date | None = None
    planned_completion_date: date | None = None
    expected_completion_date: date | None = None

    @model_validator(mode="after")
    def validate_completion_dates(self) -> "ProjectUpdate":
        if self.planned_completion_date and self.expected_completion_date and self.expected_completion_date < self.planned_completion_date:
            raise ValueError("expected_completion_date must be on or after planned_completion_date")
        return self


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class ProgressHistoryBase(BaseModel):
    reporting_period: date
    physical_progress: Decimal | None = Field(default=None, ge=0, le=100)
    expected_progress: Decimal | None = Field(default=None, ge=0, le=100)
    expenditure: Decimal | None = Field(default=None, ge=0)
    status: ProjectStatus | None = None
    project_identity: str | None = None
    source_filename: str | None = None
    notes: str | None = None


class ProgressHistoryCreate(ProgressHistoryBase):
    pass


class ProgressHistoryResponse(ProgressHistoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: datetime


class CostHistoryBase(BaseModel):
    recorded_at: datetime
    original_cost: Decimal | None = Field(default=None, ge=0)
    current_cost: Decimal | None = Field(default=None, ge=0)
    expenditure: Decimal | None = Field(default=None, ge=0)
    project_identity: str | None = None
    source_filename: str | None = None


class CostHistoryCreate(CostHistoryBase):
    pass


class CostHistoryResponse(CostHistoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: datetime


class MilestoneBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    planned_date: date | None = None
    expected_date: date | None = None
    actual_date: date | None = None
    status: MilestoneStatus

    @model_validator(mode="after")
    def validate_dates(self) -> "MilestoneBase":
        if self.planned_date and self.expected_date and self.expected_date < self.planned_date:
            raise ValueError("expected_date must be on or after planned_date")
        if self.actual_date and self.expected_date and self.actual_date < self.expected_date:
            raise ValueError("actual_date must be on or after expected_date")
        if self.status is MilestoneStatus.COMPLETED and self.actual_date is None:
            raise ValueError("actual_date is required when status is COMPLETED")
        return self


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    planned_date: date | None = None
    expected_date: date | None = None
    actual_date: date | None = None
    status: MilestoneStatus | None = None


class MilestoneResponse(MilestoneBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class ProjectPage(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int


class ProjectHistoryResponse(BaseModel):
    progress: list[ProgressHistoryResponse]
    costs: list[CostHistoryResponse]


class CostIntelligence(BaseModel):
    original_cost: Decimal | None
    latest_cost: Decimal | None
    absolute_increase: Decimal | None
    escalation_percentage: Decimal | None
    expenditure: Decimal | None
    escalation_amount: Decimal | None
    cumulative_expenditure: Decimal | None
    expenditure_percentage: Decimal | None
    historical_observations: list[CostHistoryResponse]


class ProgressIntelligence(BaseModel):
    latest_progress: Decimal | None
    previous_progress: Decimal | None
    progress_change: Decimal | None
    trend: str | None
    observation_count: int


class ScheduleIntelligence(BaseModel):
    planned_completion: date | None
    expected_completion: date | None
    extension_days: int | None
    extension_months: float | None
    has_extension: bool | None


class DataQuality(BaseModel):
    sufficient_history: bool
    available_fields: list[str]


class ProjectIntelligenceResponse(BaseModel):
    cost: CostIntelligence
    progress: ProgressIntelligence
    schedule: ScheduleIntelligence
    data_quality: DataQuality
