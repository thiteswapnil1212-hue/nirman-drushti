"""Add PAIMANA identifiers to projects.

Revision ID: 20260906_0003
Revises: 20260906_0002
Create Date: 2026-09-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260906_0003"
down_revision: Union[str, Sequence[str], None] = "20260906_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("legacy_ocms_code", sa.String(length=100), nullable=True))
    op.add_column("projects", sa.Column("pmgid", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "pmgid")
    op.drop_column("projects", "legacy_ocms_code")