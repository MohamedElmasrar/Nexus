"""Add AI summary and tag fields to file_sync_status

Revision ID: 003_ai_fields
Revises: 002_conversations
Create Date: 2026-05-20 01:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_ai_fields'
down_revision: Union[str, None] = '002_conversations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('file_sync_status', sa.Column('ai_summary', sa.Text(), nullable=True))
    op.add_column('file_sync_status', sa.Column('ai_takeaways', sa.Text(), nullable=True))
    op.add_column('file_sync_status', sa.Column('ai_tags', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('file_sync_status', 'ai_tags')
    op.drop_column('file_sync_status', 'ai_takeaways')
    op.drop_column('file_sync_status', 'ai_summary')
