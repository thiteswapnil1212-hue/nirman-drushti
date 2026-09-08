"""Create project domain tables.

Revision ID: 20260905_0001
Revises:
Create Date: 2026-09-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260905_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

project_status = postgresql.ENUM("ON_TRACK", "WATCH", "HIGH_RISK", name="project_status")
progress_status = postgresql.ENUM("ON_TRACK", "WATCH", "HIGH_RISK", name="progress_status")
milestone_status = postgresql.ENUM("PENDING", "IN_PROGRESS", "COMPLETED", "DELAYED", name="milestone_status")
project_status_column = postgresql.ENUM("ON_TRACK", "WATCH", "HIGH_RISK", name="project_status", create_type=False)
progress_status_column = postgresql.ENUM("ON_TRACK", "WATCH", "HIGH_RISK", name="progress_status", create_type=False)
milestone_status_column = postgresql.ENUM("PENDING", "IN_PROGRESS", "COMPLETED", "DELAYED", name="milestone_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    project_status.create(bind, checkfirst=True)
    progress_status.create(bind, checkfirst=True)
    milestone_status.create(bind, checkfirst=True)

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("ministry", sa.String(length=255), nullable=False),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("sector", sa.String(length=150), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("implementing_agency", sa.String(length=255), nullable=True),
        sa.Column("status", project_status_column, nullable=False),
        sa.Column("original_cost", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("current_cost", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("expenditure", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("physical_progress", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("expected_progress", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("planned_start_date", sa.Date(), nullable=True),
        sa.Column("planned_completion_date", sa.Date(), nullable=True),
        sa.Column("expected_completion_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("original_cost >= 0", name="ck_projects_original_cost_non_negative"),
        sa.CheckConstraint("current_cost >= 0", name="ck_projects_current_cost_non_negative"),
        sa.CheckConstraint("expenditure >= 0", name="ck_projects_expenditure_non_negative"),
        sa.CheckConstraint("physical_progress BETWEEN 0 AND 100", name="ck_projects_physical_progress_range"),
        sa.CheckConstraint("expected_progress BETWEEN 0 AND 100", name="ck_projects_expected_progress_range"),
        sa.CheckConstraint("planned_completion_date IS NULL OR expected_completion_date IS NULL OR expected_completion_date >= planned_completion_date", name="ck_projects_completion_dates_ordered"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_code", name="uq_projects_project_code"),
    )
    op.create_index("ix_projects_status", "projects", ["status"])
    op.create_index("ix_projects_sector", "projects", ["sector"])
    op.create_index("ix_projects_ministry", "projects", ["ministry"])
    op.create_index("ix_projects_project_code", "projects", ["project_code"])

    op.create_table(
        "progress_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporting_period", sa.Date(), nullable=False),
        sa.Column("physical_progress", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("expected_progress", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("expenditure", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("status", progress_status_column, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("physical_progress BETWEEN 0 AND 100", name="ck_progress_history_physical_progress_range"),
        sa.CheckConstraint("expected_progress BETWEEN 0 AND 100", name="ck_progress_history_expected_progress_range"),
        sa.CheckConstraint("expenditure >= 0", name="ck_progress_history_expenditure_non_negative"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_progress_history_project_reporting_period", "progress_history", ["project_id", "reporting_period"])

    op.create_table(
        "cost_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("original_cost", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("current_cost", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("expenditure", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("original_cost >= 0", name="ck_cost_history_original_cost_non_negative"),
        sa.CheckConstraint("current_cost >= 0", name="ck_cost_history_current_cost_non_negative"),
        sa.CheckConstraint("expenditure >= 0", name="ck_cost_history_expenditure_non_negative"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cost_history_project_recorded_at", "cost_history", ["project_id", "recorded_at"])

    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=True),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column("status", milestone_status_column, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("expected_date IS NULL OR planned_date IS NULL OR expected_date >= planned_date", name="ck_milestones_expected_date_ordered"),
        sa.CheckConstraint("actual_date IS NULL OR expected_date IS NULL OR actual_date >= expected_date", name="ck_milestones_actual_date_ordered"),
        sa.CheckConstraint("status <> 'COMPLETED' OR actual_date IS NOT NULL", name="ck_milestones_completed_has_actual_date"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_milestones_project_id", "milestones", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_milestones_project_id", table_name="milestones")
    op.drop_table("milestones")
    op.drop_index("ix_cost_history_project_recorded_at", table_name="cost_history")
    op.drop_table("cost_history")
    op.drop_index("ix_progress_history_project_reporting_period", table_name="progress_history")
    op.drop_table("progress_history")
    op.drop_index("ix_projects_project_code", table_name="projects")
    op.drop_index("ix_projects_ministry", table_name="projects")
    op.drop_index("ix_projects_sector", table_name="projects")
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_table("projects")
    milestone_status.drop(op.get_bind(), checkfirst=True)
    progress_status.drop(op.get_bind(), checkfirst=True)
    project_status.drop(op.get_bind(), checkfirst=True)
