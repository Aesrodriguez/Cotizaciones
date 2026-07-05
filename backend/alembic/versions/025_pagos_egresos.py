"""Módulo de pagos / egresos

Revision ID: 025
Revises: 024
Create Date: 2026-07-05
"""
from alembic import op

revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS pagos (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            fecha            DATE NOT NULL,
            monto            NUMERIC(18, 2) NOT NULL,
            destinatario     VARCHAR(300) NOT NULL,
            tipo             VARCHAR(30) NOT NULL DEFAULT 'OTRO',
            metodo_pago      VARCHAR(30),
            referencia       VARCHAR(200),
            concepto         TEXT,
            factura_id       UUID REFERENCES facturas_electronicas(id) ON DELETE SET NULL,
            trabajador_id    UUID REFERENCES trabajadores(id) ON DELETE SET NULL,
            obra_id          UUID REFERENCES obras(id) ON DELETE SET NULL,
            notas            TEXT,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_pagos_fecha         ON pagos(fecha)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pagos_tipo          ON pagos(tipo)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pagos_destinatario  ON pagos(destinatario)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pagos_factura       ON pagos(factura_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pagos_trabajador    ON pagos(trabajador_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pagos_obra          ON pagos(obra_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS pagos CASCADE")
