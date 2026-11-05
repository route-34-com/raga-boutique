"""Brand colour (plum or cocoa) in store settings

Revision ID: a8d3f1c7b2e9
Revises: f6b2c8d4e0a3
Create Date: 2026-11-05 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8d3f1c7b2e9'
down_revision: Union[str, Sequence[str], None] = 'f6b2c8d4e0a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('store_settings', sa.Column('brand_theme', sa.String(10), nullable=False, server_default='plum'))


def downgrade() -> None:
    op.drop_column('store_settings', 'brand_theme')
