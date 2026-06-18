"""Extend trabajadores module: new fields + asignaciones + pagos simples + cortes quincenales

Revision ID: 009
Revises: 008
Create Date: 2026-06-18 00:00:00.000000
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. Extend trabajadores table ──────────────────────────────────────────
    op.add_column('trabajadores', sa.Column('cedula', sa.VARCHAR(30), nullable=True))
    op.add_column('trabajadores', sa.Column('especialidad', sa.VARCHAR(100), nullable=True))
    op.add_column('trabajadores', sa.Column('tipo', sa.VARCHAR(50), nullable=True, server_default='Empleado'))
    op.add_column('trabajadores', sa.Column('salario_base', sa.Numeric(15, 2), nullable=True))
    op.add_column('trabajadores', sa.Column('banco', sa.VARCHAR(100), nullable=True))
    op.add_column('trabajadores', sa.Column('tipo_cuenta', sa.VARCHAR(50), nullable=True))
    op.add_column('trabajadores', sa.Column('numero_cuenta', sa.VARCHAR(50), nullable=True))

    # ── 2. Create ENUM types idempotently ─────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estadoasignacion') THEN
                CREATE TYPE estadoasignacion AS ENUM ('ACTIVA', 'COMPLETADA', 'CANCELADA');
            END IF;
        END $$;
    """)

    # ── 3. Create trabajador_asignaciones ─────────────────────────────────────
    op.create_table(
        'trabajador_asignaciones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trabajador_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trabajadores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contrato_items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('descripcion_item', sa.VARCHAR(500), nullable=True),
        sa.Column('unidad_item', sa.VARCHAR(30), nullable=True),
        sa.Column('cantidad_item', sa.Numeric(15, 4), nullable=True),
        sa.Column('valor_acordado', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('fecha_inicio', sa.Date, nullable=True),
        sa.Column('fecha_fin', sa.Date, nullable=True),
        sa.Column('estado', postgresql.ENUM('ACTIVA', 'COMPLETADA', 'CANCELADA', name='estadoasignacion', create_type=False), nullable=False, server_default='ACTIVA'),
        sa.Column('observaciones', sa.Text, nullable=True),
    )
    op.create_index('idx_trab_asig_trabajador_id', 'trabajador_asignaciones', ['trabajador_id'])
    op.create_index('idx_trab_asig_contrato_id', 'trabajador_asignaciones', ['contrato_id'])

    # ── 4. Rework trabajador_pagos ─────────────────────────────────────────────
    # Drop old constraints first
    op.drop_constraint('ck_trabajador_pagos_cantidad_dias', 'trabajador_pagos', type_='check')
    op.drop_constraint('ck_trabajador_pagos_monto_bruto', 'trabajador_pagos', type_='check')
    op.drop_constraint('ck_trabajador_pagos_descuentos', 'trabajador_pagos', type_='check')
    op.drop_constraint('ck_trabajador_pagos_neto', 'trabajador_pagos', type_='check')
    op.drop_index('idx_trabajador_pagos_trabajador_periodo', table_name='trabajador_pagos')

    # Make old columns nullable
    op.alter_column('trabajador_pagos', 'periodo', nullable=True)
    op.alter_column('trabajador_pagos', 'cantidad_dias', nullable=True)
    op.alter_column('trabajador_pagos', 'monto_bruto', nullable=True)
    op.alter_column('trabajador_pagos', 'monto_neto', nullable=True)

    # Add new columns
    op.add_column('trabajador_pagos', sa.Column('asignacion_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trabajador_asignaciones.id', ondelete='SET NULL'), nullable=True))
    op.add_column('trabajador_pagos', sa.Column('contrato_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contratos.id', ondelete='SET NULL'), nullable=True))
    op.add_column('trabajador_pagos', sa.Column('valor', sa.Numeric(15, 2), nullable=True))
    op.add_column('trabajador_pagos', sa.Column('metodo', sa.VARCHAR(50), nullable=True, server_default='Transferencia'))
    op.add_column('trabajador_pagos', sa.Column('observaciones', sa.Text, nullable=True))
    op.add_column('trabajador_pagos', sa.Column('registrado_por', sa.VARCHAR(255), nullable=True))

    # Make fecha_pago required (set default for any existing rows first)
    op.execute("UPDATE trabajador_pagos SET fecha_pago = periodo WHERE fecha_pago IS NULL AND periodo IS NOT NULL")
    op.execute("UPDATE trabajador_pagos SET fecha_pago = CURRENT_DATE WHERE fecha_pago IS NULL")
    op.execute("UPDATE trabajador_pagos SET valor = COALESCE(monto_bruto, 0) WHERE valor IS NULL")
    op.alter_column('trabajador_pagos', 'fecha_pago', nullable=False)

    op.create_index('idx_trabajador_pagos_asignacion_id', 'trabajador_pagos', ['asignacion_id'])
    op.create_index('idx_trabajador_pagos_fecha', 'trabajador_pagos', ['fecha_pago'])
    op.create_check_constraint('ck_trabajador_pagos_valor', 'trabajador_pagos', 'valor >= 0')

    # ── 5. Create trabajador_cortes ───────────────────────────────────────────
    op.create_table(
        'trabajador_cortes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('trabajador_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trabajadores.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fecha_inicio', sa.Date, nullable=False),
        sa.Column('fecha_fin', sa.Date, nullable=False),
        sa.Column('total_pagos', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total_descuentos', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total_deudas', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total_neto', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('descuentos_json', sa.Text, nullable=True),
        sa.Column('deudas_json', sa.Text, nullable=True),
        sa.Column('creado_por', sa.VARCHAR(255), nullable=True),
    )
    op.create_index('idx_trab_cortes_trabajador_id', 'trabajador_cortes', ['trabajador_id'])

    # ── 6. Create trabajador_cortes_detalle ───────────────────────────────────
    op.create_table(
        'trabajador_cortes_detalle',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('corte_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trabajador_cortes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pago_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trabajador_pagos.id', ondelete='SET NULL'), nullable=True),
        sa.Column('fecha_pago', sa.Date, nullable=False),
        sa.Column('contrato_consecutivo', sa.VARCHAR(50), nullable=True),
        sa.Column('descripcion_item', sa.VARCHAR(500), nullable=True),
        sa.Column('valor', sa.Numeric(15, 2), nullable=False),
        sa.Column('referencia', sa.VARCHAR(200), nullable=True),
        sa.Column('observaciones', sa.Text, nullable=True),
    )
    op.create_index('idx_trab_corte_det_corte_id', 'trabajador_cortes_detalle', ['corte_id'])


def downgrade():
    op.drop_table('trabajador_cortes_detalle')
    op.drop_table('trabajador_cortes')
    op.drop_index('idx_trabajador_pagos_asignacion_id', table_name='trabajador_pagos')
    op.drop_index('idx_trabajador_pagos_fecha', table_name='trabajador_pagos')
    op.drop_column('trabajador_pagos', 'registrado_por')
    op.drop_column('trabajador_pagos', 'observaciones')
    op.drop_column('trabajador_pagos', 'metodo')
    op.drop_column('trabajador_pagos', 'valor')
    op.drop_column('trabajador_pagos', 'contrato_id')
    op.drop_column('trabajador_pagos', 'asignacion_id')
    op.drop_table('trabajador_asignaciones')
    op.execute("DROP TYPE IF EXISTS estadoasignacion")
    op.drop_column('trabajadores', 'numero_cuenta')
    op.drop_column('trabajadores', 'tipo_cuenta')
    op.drop_column('trabajadores', 'banco')
    op.drop_column('trabajadores', 'salario_base')
    op.drop_column('trabajadores', 'tipo')
    op.drop_column('trabajadores', 'especialidad')
    op.drop_column('trabajadores', 'cedula')
