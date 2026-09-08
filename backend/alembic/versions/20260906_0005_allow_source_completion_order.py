"""Allow source completion dates that do not satisfy the domain ordering rule.

Revision ID: 20260906_0005
Revises: 20260906_0004
Create Date: 2026-09-06
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260906_0005"
down_revision: Union[str, Sequence[str], None] = "20260906_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_projects_completion_dates_ordered", "projects", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "ck_projects_completion_dates_ordered",
        "projects",
        "planned_completion_date IS NULL OR expected_completion_date IS NULL OR expected_completion_date >= planned_completion_date",
    )