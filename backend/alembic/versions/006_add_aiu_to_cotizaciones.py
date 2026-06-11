"""Add AIU columns to cotizaciones

Revision ID: 006
Revises: 005
Create Date: 2026-06-11 18:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cotizaciones', sa.Column('aiu_administracion', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('cotizaciones', sa.Column('aiu_imprevistos',    sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('cotizaciones', sa.Column('aiu_utilidad',       sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('cotizaciones', sa.Column('aiu_monto',          sa.Numeric(15, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('cotizaciones', 'aiu_monto')
    op.drop_column('cotizaciones', 'aiu_utilidad')
    op.drop_column('cotizaciones', 'aiu_imprevistos')
    op.drop_column('cotizaciones', 'aiu_administracion')
