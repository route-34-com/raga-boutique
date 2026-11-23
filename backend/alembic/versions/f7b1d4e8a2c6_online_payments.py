"""Online payments: the Razorpay order id on orders

Revision ID: f7b1d4e8a2c6
Revises: e5a9c3d7f1b2
Create Date: 2026-11-10 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f7b1d4e8a2c6"
down_revision: str | Sequence[str] | None = "e5a9c3d7f1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("gateway_order_id", sa.String(40), nullable=False, server_default=""))
    op.create_index("ix_orders_gateway_order_id", "orders", ["gateway_order_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_gateway_order_id", table_name="orders")
    op.drop_column("orders", "gateway_order_id")
