from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from collections.abc import Sequence


class ProjectStatus(str, enum.Enum):
    ON_TRACK = "ON_TRACK"
    WATCH = "WATCH"
    HIGH_RISK = "HIGH_RISK"


class MilestoneStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    DELAYED = "DELAYED"


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("project_code", name="uq_projects_project_code"),
        UniqueConstraint("project_identity", name="uq_projects_project_identity"),
        Index("ix_projects_status", "status"),
        Index("ix_projects_sector", "sector"),
        Index("ix_projects_ministry", "ministry"),
        Index("ix_projects_project_code", "project_code"),
        CheckConstraint("original_cost >= 0", name="ck_projects_original_cost_non_negative"),
        CheckConstraint("current_cost >= 0", name="ck_projects_current_cost_non_negative"),
        CheckConstraint("expenditure >= 0", name="ck_projects_expenditure_non_negative"),
        CheckConstraint("physical_progress BETWEEN 0 AND 100", name="ck_projects_physical_progress_range"),
        CheckConstraint("expected_progress BETWEEN 0 AND 100", name="ck_projects_expected_progress_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code: Mapped[str | None] = mapped_column(String(64))
    project_identity: Mapped[str | None] = mapped_column(String(64))
    legacy_ocms_code: Mapped[str | None] = mapped_column(String(100))
    pmgid: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    ministry: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(255))
    sector: Mapped[str | None] = mapped_column(String(150))
    location: Mapped[str | None] = mapped_column(String(255))
    state: Mapped[str | None] = mapped_column(String(255))
    implementing_agency: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ProjectStatus | None] = mapped_column(Enum(ProjectStatus, name="project_status"))
    original_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    current_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    expenditure: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    physical_progress: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    expected_progress: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    planned_start_date: Mapped[date | None] = mapped_column(Date)
    planned_completion_date: Mapped[date | None] = mapped_column(Date)
    expected_completion_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    progress_history: Mapped[list[ProgressHistory]] = relationship(back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    cost_history: Mapped[list[CostHistory]] = relationship(back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
    milestones: Mapped[list[Milestone]] = relationship(back_populates="project", cascade="all, delete-orphan", passive_deletes=True)


class ProgressHistory(Base):
    __tablename__ = "progress_history"
    __table_args__ = (
        Index("ix_progress_history_project_reporting_period", "project_id", "reporting_period"),
        CheckConstraint("physical_progress BETWEEN 0 AND 100", name="ck_progress_history_physical_progress_range"),
        CheckConstraint("expected_progress BETWEEN 0 AND 100", name="ck_progress_history_expected_progress_range"),
        CheckConstraint("expenditure >= 0", name="ck_progress_history_expenditure_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reporting_period: Mapped[date] = mapped_column(Date, nullable=False)
    physical_progress: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    expected_progress: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    expenditure: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    status: Mapped[ProjectStatus | None] = mapped_column(Enum(ProjectStatus, name="progress_status"))
    project_identity: Mapped[str | None] = mapped_column(String(64))
    source_filename: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="progress_history")


class CostHistory(Base):
    __tablename__ = "cost_history"
    __table_args__ = (
        Index("ix_cost_history_project_recorded_at", "project_id", "recorded_at"),
        CheckConstraint("original_cost >= 0", name="ck_cost_history_original_cost_non_negative"),
        CheckConstraint("current_cost >= 0", name="ck_cost_history_current_cost_non_negative"),
        CheckConstraint("expenditure >= 0", name="ck_cost_history_expenditure_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    original_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    current_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    expenditure: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    project_identity: Mapped[str | None] = mapped_column(String(64))
    source_filename: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="cost_history")


class Milestone(Base):
    __tablename__ = "milestones"
    __table_args__ = (
        Index("ix_milestones_project_id", "project_id"),
        CheckConstraint("expected_date IS NULL OR planned_date IS NULL OR expected_date >= planned_date", name="ck_milestones_expected_date_ordered"),
        CheckConstraint("actual_date IS NULL OR expected_date IS NULL OR actual_date >= expected_date", name="ck_milestones_actual_date_ordered"),
        CheckConstraint("status <> 'COMPLETED' OR actual_date IS NOT NULL", name="ck_milestones_completed_has_actual_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    planned_date: Mapped[date | None] = mapped_column(Date)
    expected_date: Mapped[date | None] = mapped_column(Date)
    actual_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[MilestoneStatus] = mapped_column(Enum(MilestoneStatus, name="milestone_status"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="milestones")
