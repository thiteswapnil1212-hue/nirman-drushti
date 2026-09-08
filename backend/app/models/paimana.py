from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PaimanaObservation(Base):
    __tablename__ = "paimana_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    observation_id: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"))
    project_identity: Mapped[str | None] = mapped_column(String(64))
    match_status: Mapped[str] = mapped_column(String(32), nullable=False)
    match_method: Mapped[str | None] = mapped_column(String(64))
    review_reason: Mapped[str | None] = mapped_column(Text)
    duplicate_observation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sl_no: Mapped[str | None] = mapped_column(String(32))
    project_code: Mapped[str | None] = mapped_column(String(100))
    legacy_ocms_code: Mapped[str | None] = mapped_column(String(100))
    pmgid: Mapped[str | None] = mapped_column(String(100))
    project_name: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str | None] = mapped_column(String(255))
    implementing_agency: Mapped[str | None] = mapped_column(String(255))
    reporting_period: Mapped[date | None] = mapped_column(Date)
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    original_completion_date: Mapped[date | None] = mapped_column(Date)
    revised_completion_date: Mapped[date | None] = mapped_column(Date)
    original_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    revised_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    cumulative_expenditure: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    physical_progress: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)