"""Customer reviews on products

Revision ID: f6b2c8d4e0a3
Revises: e5a1b7c3d9f2
Create Date: 2026-10-22 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6b2c8d4e0a3'
down_revision: Union[str, Sequence[str], None] = 'e5a1b7c3d9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reviews',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.String(length=600), nullable=False),
        sa.Column('name', sa.String(length=40), nullable=False),
        sa.Column('city', sa.String(length=60), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('product_id', 'user_id'),
    )
    op.create_index('ix_reviews_product_id', 'reviews', ['product_id'])
    op.create_index('ix_reviews_user_id', 'reviews', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_reviews_user_id', 'reviews')
    op.drop_index('ix_reviews_product_id', 'reviews')
    op.drop_table('reviews')
