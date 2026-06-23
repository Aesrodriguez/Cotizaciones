"""cotizacion_items: make producto_id nullable for APU items

Revision ID: 014
Revises: 013
Create Date: 2026-06-22
"""
from alembic import op

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE cotizacion_items ALTER COLUMN producto_id DROP NOT NULL")


def downgrade():
    op.execute("UPDATE cotizacion_items SET producto_id = gen_random_uuid() WHERE producto_id IS NULL")
    op.execute("ALTER TABLE cotizacion_items ALTER COLUMN producto_id SET NOT NULL")
