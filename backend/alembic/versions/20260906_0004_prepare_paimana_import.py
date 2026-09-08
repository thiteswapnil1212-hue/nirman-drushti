"""Prepare the domain for PAIMANA historical import.

Revision ID: 20260906_0004
Revises: 20260906_0003
Create Date: 2026-09-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260906_0004"
down_revision: Union[str, Sequence[str], None] = "20260906_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("projects", "project_code", existing_type=sa.String(length=64), nullable=True)
    op.alter_column("projects", "ministry", existing_type=sa.String(length=255), nullable=True)
    op.alter_column("projects", "sector", existing_type=sa.String(length=150), nullable=True)
    op.alter_column("projects", "status", existing_type=postgresql.ENUM(name="project_status", create_type=False), nullable=True)
    for column in ("original_cost", "current_cost", "expenditure", "physical_progress", "expected_progress"):
        op.alter_column("projects", column, existing_type=sa.Numeric(), nullable=True)
    op.add_column("projects", sa.Column("project_identity", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_projects_project_identity", "projects", ["project_identity"])
    op.add_column("progress_history", sa.Column("project_identity", sa.String(length=64), nullable=True))
    op.add_column("progress_history", sa.Column("source_filename", sa.String(length=255), nullable=True))
    op.alter_column("progress_history", "expected_progress", existing_type=sa.Numeric(), nullable=True)
    op.alter_column("progress_history", "physical_progress", existing_type=sa.Numeric(), nullable=True)
    op.alter_column("progress_history", "expenditure", existing_type=sa.Numeric(), nullable=True)
    op.alter_column("progress_history", "status", existing_type=postgresql.ENUM(name="progress_status", create_type=False), nullable=True)
    op.add_column("cost_history", sa.Column("project_identity", sa.String(length=64), nullable=True))
    op.add_column("cost_history", sa.Column("source_filename", sa.String(length=255), nullable=True))
    op.alter_column("cost_history", "original_cost", existing_type=sa.Numeric(), nullable=True)
    op.alter_column("cost_history", "current_cost", existing_type=sa.Numeric(), nullable=True)
    op.alter_column("cost_history", "expenditure", existing_type=sa.Numeric(), nullable=True)
    op.create_table(
        "paimana_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("observation_id", sa.String(length=320), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_identity", sa.String(length=64), nullable=True),
        sa.Column("match_status", sa.String(length=32), nullable=False),
        sa.Column("match_method", sa.String(length=64), nullable=True),
        sa.Column("review_reason", sa.Text(), nullable=True),
        sa.Column("duplicate_observation", sa.Boolean(), nullable=False),
        sa.Column("sl_no", sa.String(length=32), nullable=True),
        sa.Column("project_code", sa.String(length=100), nullable=True),
        sa.Column("legacy_ocms_code", sa.String(length=100), nullable=True),
        sa.Column("pmgid", sa.String(length=100), nullable=True),
        sa.Column("project_name", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=255), nullable=True),
        sa.Column("implementing_agency", sa.String(length=255), nullable=True),
        sa.Column("reporting_period", sa.Date(), nullable=True),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("original_completion_date", sa.Date(), nullable=True),
        sa.Column("revised_completion_date", sa.Date(), nullable=True),
        sa.Column("original_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("revised_cost", sa.Numeric(18, 2), nullable=True),
        sa.Column("cumulative_expenditure", sa.Numeric(18, 2), nullable=True),
        sa.Column("physical_progress", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("observation_id"),
    )


def downgrade() -> None:
    op.drop_table("paimana_observations")
    op.drop_column("cost_history", "source_filename")
    op.drop_column("cost_history", "project_identity")
    for column in ("expenditure", "current_cost", "original_cost"):
        op.alter_column("cost_history", column, existing_type=sa.Numeric(), nullable=False)
    op.alter_column("progress_history", "status", existing_type=postgresql.ENUM(name="progress_status", create_type=False), nullable=False)
    op.alter_column("progress_history", "expected_progress", existing_type=sa.Numeric(), nullable=False)
    op.alter_column("progress_history", "physical_progress", existing_type=sa.Numeric(), nullable=False)
    op.alter_column("progress_history", "expenditure", existing_type=sa.Numeric(), nullable=False)
    op.drop_column("progress_history", "source_filename")
    op.drop_column("progress_history", "project_identity")
    op.drop_constraint("uq_projects_project_identity", "projects", type_="unique")
    op.drop_column("projects", "project_identity")
    for column in ("expected_progress", "physical_progress", "expenditure", "current_cost", "original_cost"):
        op.alter_column("projects", column, existing_type=sa.Numeric(), nullable=False)
    op.alter_column("projects", "status", existing_type=postgresql.ENUM(name="project_status", create_type=False), nullable=False)
    op.alter_column("projects", "sector", existing_type=sa.String(length=150), nullable=False)
    op.alter_column("projects", "ministry", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("projects", "project_code", existing_type=sa.String(length=64), nullable=False)