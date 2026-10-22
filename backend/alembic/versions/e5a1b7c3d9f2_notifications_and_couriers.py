"""WhatsApp and email notifications per order, courier list in store settings

Revision ID: e5a1b7c3d9f2
Revises: d4f8a1c2e6b7
Create Date: 2026-10-22 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5a1b7c3d9f2'
down_revision: Union[str, Sequence[str], None] = 'd4f8a1c2e6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(length=12), nullable=False),
        sa.Column('channel', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('detail', sa.String(length=1200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('order_id', 'kind', 'channel'),
    )
    op.create_index('ix_notifications_order_id', 'notifications', ['order_id'])
    op.add_column('store_settings', sa.Column('couriers', sa.JSON(), server_default='[]', nullable=False))


def downgrade() -> None:
    op.drop_column('store_settings', 'couriers')
    op.drop_index('ix_notifications_order_id', 'notifications')
    op.drop_table('notifications')
