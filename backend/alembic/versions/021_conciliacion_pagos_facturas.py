"""Tabla de conciliación: sugerencias de enlace pago ↔ factura

Revision ID: 021
Revises: 020
Create Date: 2026-06-23
"""
from alembic import op

revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS pagos_facturas_links (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            -- Origen del pago (uno de los dos es NOT NULL)
            tipo_origen                 VARCHAR(20) NOT NULL,  -- PAGO | TRANSFERENCIA
            detalle_pago_id             UUID REFERENCES detalle_pagos(id) ON DELETE CASCADE,
            detalle_transferencia_id    UUID REFERENCES detalle_transferencias(id) ON DELETE CASCADE,
            -- Factura enlazada
            factura_id                  UUID NOT NULL REFERENCES facturas_electronicas(id) ON DELETE CASCADE,
            -- Puntuación y razones
            score                       INTEGER NOT NULL DEFAULT 0,
            razones                     JSONB NOT NULL DEFAULT '[]',
            -- Estado de aprobación
            estado                      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
            -- PENDIENTE | APROBADO | RECHAZADO
            aprobado_en                 TIMESTAMP,
            rechazado_en                TIMESTAMP,
            created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    # Evitar sugerencias duplicadas del mismo pago para la misma factura
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_link_pago_factura
        ON pagos_facturas_links(detalle_pago_id, factura_id)
        WHERE detalle_pago_id IS NOT NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_link_transferencia_factura
        ON pagos_facturas_links(detalle_transferencia_id, factura_id)
        WHERE detalle_transferencia_id IS NOT NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_pfl_estado ON pagos_facturas_links(estado)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pfl_factura ON pagos_facturas_links(factura_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS pagos_facturas_links")
