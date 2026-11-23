"""Instagram and Facebook links in store settings

Revision ID: c7a2e9f15b3d
Revises: b3e1c0d4a2f9
Create Date: 2026-10-22 14:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c7a2e9f15b3d"
down_revision: str | Sequence[str] | None = "b3e1c0d4a2f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "store_settings", sa.Column("instagram_url", sa.String(length=200), server_default="", nullable=False)
    )
    op.add_column("store_settings", sa.Column("facebook_url", sa.String(length=200), server_default="", nullable=False))


def downgrade() -> None:
    op.drop_column("store_settings", "facebook_url")
    op.drop_column("store_settings", "instagram_url")
