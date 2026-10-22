"""contact details in store settings, photos stored in the database

Revision ID: b3e1c0d4a2f9
Revises: 7141f713e08a
Create Date: 2026-10-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e1c0d4a2f9'
down_revision: Union[str, Sequence[str], None] = '7141f713e08a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONTACT = [("contact_phone", 20), ("contact_whatsapp", 20), ("contact_email", 120), ("contact_address", 300), ("contact_hours", 120)]


def upgrade() -> None:
    for name, length in CONTACT:
        op.add_column('store_settings', sa.Column(name, sa.String(length=length), server_default="", nullable=False))
    op.create_table('image_files',
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.PrimaryKeyConstraint('name')
    )


def downgrade() -> None:
    op.drop_table('image_files')
    for name, _ in CONTACT:
        op.drop_column('store_settings', name)
