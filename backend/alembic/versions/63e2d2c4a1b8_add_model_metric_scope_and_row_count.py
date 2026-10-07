"""Add model scope and training row count to model metrics.

Revision ID: 63e2d2c4a1b8
Revises: fd8f477dd986
Create Date: 2026-10-06 14:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "63e2d2c4a1b8"
down_revision: Union[str, Sequence[str], None] = "fd8f477dd986"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("modelmetrics", sa.Column("lob", sa.String(length=50), nullable=True))
    op.add_column("modelmetrics", sa.Column("train_rows_count", sa.Integer(), nullable=True))
    op.execute("UPDATE modelmetrics SET lob = 'ALL' WHERE lob IS NULL")
    op.execute("UPDATE modelmetrics SET train_rows_count = 0 WHERE train_rows_count IS NULL")
    op.alter_column("modelmetrics", "lob", existing_type=sa.String(length=50), nullable=False)
    op.alter_column("modelmetrics", "train_rows_count", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.drop_column("modelmetrics", "train_rows_count")
    op.drop_column("modelmetrics", "lob")
