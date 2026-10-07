"""merge migration heads

Revision ID: 85b87a47ef9d
Revises: 63e2d2c4a1b8, 94cea21d1697
Create Date: 2026-10-07 15:21:20.255671

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85b87a47ef9d'
down_revision: Union[str, Sequence[str], None] = ('63e2d2c4a1b8', '94cea21d1697')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
