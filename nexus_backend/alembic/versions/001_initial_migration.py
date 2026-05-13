"""Initial migration

Revision ID: 001_initial
Revises: 
Create Date: 2026-05-13 01:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('file_sync_status',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_file_sync_status_file_path'), 'file_sync_status', ['file_path'], unique=True)
    op.create_index(op.f('ix_file_sync_status_id'), 'file_sync_status', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_file_sync_status_id'), table_name='file_sync_status')
    op.drop_index(op.f('ix_file_sync_status_file_path'), table_name='file_sync_status')
    op.drop_table('file_sync_status')
