"""UPI payments: the shop's UPI ID in settings, the customer's payment reference on orders

Revision ID: e5a9c3d7f1b2
Revises: c4e7b2a9d1f3
Create Date: 2026-11-10 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5a9c3d7f1b2'
down_revision: Union[str, Sequence[str], None] = 'c4e7b2a9d1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('store_settings', sa.Column('upi_id', sa.String(60), nullable=False, server_default=''))
    op.add_column('store_settings', sa.Column('upi_name', sa.String(60), nullable=False, server_default=''))
    op.add_column('orders', sa.Column('payment_ref', sa.String(40), nullable=False, server_default=''))


def downgrade() -> None:
    op.drop_column('orders', 'payment_ref')
    op.drop_column('store_settings', 'upi_name')
    op.drop_column('store_settings', 'upi_id')
