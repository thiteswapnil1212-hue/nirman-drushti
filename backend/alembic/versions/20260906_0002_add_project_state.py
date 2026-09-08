"""Add state to projects.

Revision ID: 20260906_0002
Revises: 20260905_0001
Create Date: 2026-09-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260906_0002"
down_revision: Union[str, Sequence[str], None] = "20260905_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("state", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "state")