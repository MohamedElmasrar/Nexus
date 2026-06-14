"""Add favorites, recent_views, and projects tables.

Revision ID: 005_favorites_recents_projects
Revises: 004_add_images
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "005_favorites_recents_projects"
down_revision = "004_add_images"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(150), nullable=False, index=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("username", "file_path", name="uq_favorites_user_path"),
    )
    op.create_table(
        "recent_views",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(150), nullable=False, index=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("username", "file_path", name="uq_recent_views_user_path"),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("group_id", sa.String(255), nullable=False),
        sa.Column("root_path", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(150), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("projects")
    op.drop_table("recent_views")
    op.drop_table("favorites")
