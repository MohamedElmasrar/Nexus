"""Add images column to messages

Revision ID: 004_add_images
Revises: 003_ai_fields
Create Date: 2026-06-01 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_add_images'
down_revision: Union[str, None] = '003_ai_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('images', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'images')
