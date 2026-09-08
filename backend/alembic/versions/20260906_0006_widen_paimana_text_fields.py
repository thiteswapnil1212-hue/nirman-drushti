"""Widen PAIMANA project text fields.

Revision ID: 20260906_0006
Revises: 20260906_0005
Create Date: 2026-09-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260906_0006"
down_revision: Union[str, Sequence[str], None] = "20260906_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("projects", "name", existing_type=sa.String(length=255), type_=sa.Text(), existing_nullable=False)
    op.alter_column("projects", "implementing_agency", existing_type=sa.String(length=255), type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("projects", "implementing_agency", existing_type=sa.Text(), type_=sa.String(length=255), existing_nullable=True)
    op.alter_column("projects", "name", existing_type=sa.Text(), type_=sa.String(length=255), existing_nullable=False)