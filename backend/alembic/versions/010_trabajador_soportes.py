"""010 trabajador_soportes — tabla de soportes de pago de trabajadores

Revision ID: 010
Revises: 009
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'trabajador_soportes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('trabajador_id', UUID(as_uuid=True), sa.ForeignKey('trabajadores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pago_id', UUID(as_uuid=True), sa.ForeignKey('trabajador_pagos.id', ondelete='SET NULL'), nullable=True),
        sa.Column('nombre', sa.String(255), nullable=False),
        sa.Column('tipo', sa.String(80), nullable=False, server_default='COMPROBANTE'),
        sa.Column('mime_type', sa.String(120), nullable=False, server_default='application/octet-stream'),
        sa.Column('archivo', sa.LargeBinary(), nullable=False),
        sa.Column('tamano', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by_id', UUID(as_uuid=True), sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('idx_soportes_trabajador_id', 'trabajador_soportes', ['trabajador_id'])
    op.create_index('idx_soportes_pago_id', 'trabajador_soportes', ['pago_id'])


def downgrade():
    op.drop_table('trabajador_soportes')
