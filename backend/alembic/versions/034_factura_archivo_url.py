"""add archivo_url to facturas_electronicas

Revision ID: 034
Revises: 033
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

revision = '034'
down_revision = '033'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('facturas_electronicas',
                  sa.Column('archivo_url', sa.VARCHAR(500), nullable=True))


def downgrade():
    op.drop_column('facturas_electronicas', 'archivo_url')
