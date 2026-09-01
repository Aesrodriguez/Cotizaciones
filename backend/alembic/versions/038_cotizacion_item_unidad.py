"""Agregar columna unidad a cotizacion_items

Revision ID: 038
Revises: 037
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


def upgrade():
    conn = op.get_bind()
    exists = conn.execute(text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name='cotizacion_items' AND column_name='unidad'"
    )).scalar()
    if not exists:
        op.add_column('cotizacion_items', sa.Column('unidad', sa.VARCHAR(20), nullable=True))


def downgrade():
    op.drop_column('cotizacion_items', 'unidad')
