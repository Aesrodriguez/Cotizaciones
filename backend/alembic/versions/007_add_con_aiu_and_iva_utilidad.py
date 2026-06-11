"""Add con_aiu flag and aiu_iva_monto column

Revision ID: 007
Revises: 006
Create Date: 2026-06-11 19:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cotizaciones', sa.Column('con_aiu', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('cotizaciones', sa.Column('aiu_iva_monto', sa.Numeric(15, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('cotizaciones', 'aiu_iva_monto')
    op.drop_column('cotizaciones', 'con_aiu')
