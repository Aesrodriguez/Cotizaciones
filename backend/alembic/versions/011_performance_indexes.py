"""Performance: índices compuestos para queries frecuentes.

Revision ID: 011
Revises: 010
"""
from alembic import op

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    # Índice compuesto en trabajador_asignaciones(trabajador_id, deleted_at)
    # Evita full-scan al filtrar por trabajador activo
    op.create_index(
        'idx_trab_asig_trab_deleted',
        'trabajador_asignaciones',
        ['trabajador_id', 'deleted_at'],
    )

    # Índice compuesto en trabajador_asignaciones(trabajador_id, estado)
    # Acelera _build_resumen y list con filtro de estado ACTIVA
    op.create_index(
        'idx_trab_asig_trab_estado',
        'trabajador_asignaciones',
        ['trabajador_id', 'estado'],
    )

    # Índice en trabajador_pagos(contrato_id) para joins/filtros por contrato
    op.create_index(
        'idx_trab_pagos_contrato_id',
        'trabajador_pagos',
        ['contrato_id'],
    )

    # Índice compuesto en contratos(cliente_id, estado) para búsquedas filtradas
    op.create_index(
        'idx_contratos_cliente_estado',
        'contratos',
        ['cliente_id', 'estado'],
    )

    # Índice en trabajadores(cedula) para búsqueda por cédula
    op.create_index(
        'idx_trabajadores_cedula',
        'trabajadores',
        ['cedula'],
    )

    # Índice compuesto en cotizaciones(usuario_id, estado)
    op.create_index(
        'idx_cotizaciones_usuario_estado',
        'cotizaciones',
        ['usuario_id', 'estado'],
    )

    # Índice en corte_detalles(corte_id) para bulk-load
    op.create_index(
        'idx_trab_corte_det_corte_lookup',
        'trabajador_cortes_detalle',
        ['corte_id', 'fecha_pago'],
    )


def downgrade():
    op.drop_index('idx_trab_asig_trab_deleted',       table_name='trabajador_asignaciones')
    op.drop_index('idx_trab_asig_trab_estado',        table_name='trabajador_asignaciones')
    op.drop_index('idx_trab_pagos_contrato_id',       table_name='trabajador_pagos')
    op.drop_index('idx_contratos_cliente_estado',     table_name='contratos')
    op.drop_index('idx_trabajadores_cedula',          table_name='trabajadores')
    op.drop_index('idx_cotizaciones_usuario_estado',  table_name='cotizaciones')
    op.drop_index('idx_trab_corte_det_corte_lookup',  table_name='trabajador_cortes_detalle')
