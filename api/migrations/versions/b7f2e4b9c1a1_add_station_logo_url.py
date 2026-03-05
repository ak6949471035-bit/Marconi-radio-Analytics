"""Add station logo URL

Revision ID: b7f2e4b9c1a1
Revises: 6a33b3f2561d
Create Date: 2026-02-25 07:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7f2e4b9c1a1"
down_revision: Union[str, Sequence[str], None] = "6a33b3f2561d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stations", sa.Column("logo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("stations", "logo_url")

