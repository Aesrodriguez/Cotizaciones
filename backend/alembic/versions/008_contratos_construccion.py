"""Add construction contract management tables

Revision ID: 008
Revises: 007
Create Date: 2026-06-11 00:00:00.000000
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create new PostgreSQL ENUM types
    # ------------------------------------------------------------------
    op.execute("CREATE TYPE estadoacta AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA')")
    op.execute(
        "CREATE TYPE categoriagastocontrato AS ENUM ("
        "'MATERIALES', 'MANO_OBRA', 'EQUIPOS', 'TRANSPORTE', 'COMBUSTIBLE',"
        "'VIATICOS', 'HOSPEDAJE', 'ADMINISTRACION', 'IMPREVISTOS', 'OTROS')"
    )

    # ------------------------------------------------------------------
    # 2. Add new columns to existing contratos table
    # ------------------------------------------------------------------
    op.add_column('contratos', sa.Column('objeto', sa.Text(), nullable=True))
    op.add_column('contratos', sa.Column('nombre', sa.VARCHAR(255), nullable=True))
    op.add_column('contratos', sa.Column('con_aiu', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('contratos', sa.Column('aiu_administracion', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('aiu_imprevistos', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('aiu_utilidad', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('aiu_monto', sa.Numeric(15, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('impuesto', sa.Numeric(15, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('valor_final', sa.Numeric(15, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('condiciones_pago', sa.Text(), nullable=True))
    op.add_column('contratos', sa.Column('plazo_dias', sa.Integer(), nullable=True))
    op.add_column('contratos', sa.Column('nit_cliente', sa.VARCHAR(50), nullable=True))

    # ------------------------------------------------------------------
    # 3. Create contrato_capitulos
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_capitulos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('padre_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_capitulos.id', ondelete='CASCADE'), nullable=True),
        sa.Column('codigo', sa.VARCHAR(50), nullable=True),
        sa.Column('nombre', sa.VARCHAR(255), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_capitulos_contrato_id', 'contrato_capitulos', ['contrato_id'])

    # ------------------------------------------------------------------
    # 4. Create contrato_items
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('capitulo_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_capitulos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('codigo', sa.VARCHAR(50), nullable=True),
        sa.Column('descripcion', sa.VARCHAR(500), nullable=False),
        sa.Column('unidad', sa.VARCHAR(30), nullable=False, server_default='UN'),
        sa.Column('cantidad_contratada', sa.Numeric(15, 4), nullable=False),
        sa.Column('valor_unitario', sa.Numeric(15, 2), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_items_capitulo_id', 'contrato_items', ['capitulo_id'])

    # ------------------------------------------------------------------
    # 5. Create contrato_actas (before ejecuciones; ejecuciones references it)
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_actas',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('numero', sa.VARCHAR(50), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('responsable', sa.VARCHAR(255), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('valor_total', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('estado', sa.Enum('BORRADOR', 'APROBADA', 'PAGADA', name='estadoacta'),
                  nullable=False, server_default='BORRADOR'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('contrato_id', 'numero', name='uq_actas_contrato_numero'),
    )
    op.create_index('idx_actas_contrato_id', 'contrato_actas', ['contrato_id'])

    # ------------------------------------------------------------------
    # 6. Create contrato_ejecuciones
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_ejecuciones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('acta_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_actas.id', ondelete='SET NULL'), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('cantidad', sa.Numeric(15, 4), nullable=False),
        sa.Column('valor_unitario', sa.Numeric(15, 2), nullable=False),
        sa.Column('valor_total', sa.Numeric(15, 2), nullable=False),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('cantidad > 0', name='ck_ejecuciones_cantidad'),
        sa.CheckConstraint('valor_total >= 0', name='ck_ejecuciones_valor_total'),
    )
    op.create_index('idx_ejecuciones_item_id', 'contrato_ejecuciones', ['item_id'])
    op.create_index('idx_ejecuciones_acta_id', 'contrato_ejecuciones', ['acta_id'])

    # ------------------------------------------------------------------
    # 7. Create contrato_pagos
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_pagos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('acta_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_actas.id', ondelete='SET NULL'), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('valor', sa.Numeric(15, 2), nullable=False),
        sa.Column('descripcion', sa.VARCHAR(500), nullable=True),
        sa.Column('metodo_pago', sa.VARCHAR(100), nullable=True),
        sa.Column('referencia', sa.VARCHAR(200), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('valor > 0', name='ck_pagos_valor'),
    )
    op.create_index('idx_pagos_contrato_id', 'contrato_pagos', ['contrato_id'])

    # ------------------------------------------------------------------
    # 8. Create contrato_gastos
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_gastos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('categoria',
                  sa.Enum('MATERIALES', 'MANO_OBRA', 'EQUIPOS', 'TRANSPORTE', 'COMBUSTIBLE',
                          'VIATICOS', 'HOSPEDAJE', 'ADMINISTRACION', 'IMPREVISTOS', 'OTROS',
                          name='categoriagastocontrato'),
                  nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('descripcion', sa.VARCHAR(500), nullable=False),
        sa.Column('proveedor', sa.VARCHAR(255), nullable=True),
        sa.Column('factura', sa.VARCHAR(100), nullable=True),
        sa.Column('valor', sa.Numeric(15, 2), nullable=False),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('valor > 0', name='ck_contrato_gastos_valor'),
    )
    op.create_index('idx_contrato_gastos_contrato_id', 'contrato_gastos', ['contrato_id'])


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table('contrato_gastos')
    op.drop_table('contrato_pagos')
    op.drop_table('contrato_ejecuciones')
    op.drop_table('contrato_actas')
    op.drop_table('contrato_items')
    op.drop_table('contrato_capitulos')

    # Drop new columns from contratos
    op.drop_column('contratos', 'nit_cliente')
    op.drop_column('contratos', 'plazo_dias')
    op.drop_column('contratos', 'condiciones_pago')
    op.drop_column('contratos', 'valor_final')
    op.drop_column('contratos', 'impuesto')
    op.drop_column('contratos', 'aiu_monto')
    op.drop_column('contratos', 'aiu_utilidad')
    op.drop_column('contratos', 'aiu_imprevistos')
    op.drop_column('contratos', 'aiu_administracion')
    op.drop_column('contratos', 'con_aiu')
    op.drop_column('contratos', 'nombre')
    op.drop_column('contratos', 'objeto')

    # Drop ENUM types
    op.execute('DROP TYPE IF EXISTS categoriagastocontrato')
    op.execute('DROP TYPE IF EXISTS estadoacta')
