"""colour, material, work, pattern and occasions on products, for shop filters

Revision ID: d4f8a1c2e6b7
Revises: c7a2e9f15b3d
Create Date: 2026-10-22 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4f8a1c2e6b7'
down_revision: Union[str, Sequence[str], None] = 'c7a2e9f15b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TEXT = [("color", 30), ("material", 40), ("work", 40), ("pattern", 40)]


def upgrade() -> None:
    for name, length in TEXT:
        op.add_column('products', sa.Column(name, sa.String(length=length), server_default="", nullable=False))
    op.add_column('products', sa.Column('occasions', sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column('products', 'occasions')
    for name, _ in TEXT:
        op.drop_column('products', name)
