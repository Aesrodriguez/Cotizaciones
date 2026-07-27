"""Añadir soporte_url y soporte_filename a pagos

Revision ID: 036
Revises: 035
Create Date: 2026-07-27
"""
from alembic import op

revision = '036'
down_revision = '035'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE pagos ADD COLUMN IF NOT EXISTS soporte_url TEXT")
    op.execute("ALTER TABLE pagos ADD COLUMN IF NOT EXISTS soporte_filename TEXT")


def downgrade():
    op.execute("ALTER TABLE pagos DROP COLUMN IF EXISTS soporte_url")
    op.execute("ALTER TABLE pagos DROP COLUMN IF EXISTS soporte_filename")
