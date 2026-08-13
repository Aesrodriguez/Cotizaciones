"""Nota crédito: factura_origen_id y factura_origen_numero

Revision ID: 037
Revises: 036
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '037'
down_revision = '036'


def upgrade():
    op.add_column('facturas_electronicas',
        sa.Column('factura_origen_id', UUID(as_uuid=True), nullable=True))
    op.add_column('facturas_electronicas',
        sa.Column('factura_origen_numero', sa.VARCHAR(100), nullable=True))
    op.create_foreign_key(
        'fk_factura_electronica_origen',
        'facturas_electronicas', 'facturas_electronicas',
        ['factura_origen_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade():
    op.drop_constraint('fk_factura_electronica_origen', 'facturas_electronicas', type_='foreignkey')
    op.drop_column('facturas_electronicas', 'factura_origen_numero')
    op.drop_column('facturas_electronicas', 'factura_origen_id')
