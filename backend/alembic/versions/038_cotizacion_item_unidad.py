"""Agregar columna unidad a cotizacion_items

Revision ID: 038
Revises: 037
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('cotizacion_items', sa.Column('unidad', sa.VARCHAR(20), nullable=True))


def downgrade():
    op.drop_column('cotizacion_items', 'unidad')
