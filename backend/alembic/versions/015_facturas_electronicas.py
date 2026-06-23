"""Tabla facturas_electronicas para control de e-invoices XML DIAN

Revision ID: 015
Revises: 014
Create Date: 2026-06-22
"""
from alembic import op
import sqlalchemy as sa

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS facturas_electronicas (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            numero          VARCHAR(100) NOT NULL,
            fecha_emision   DATE NOT NULL,
            proveedor_nit   VARCHAR(30),
            proveedor_nombre VARCHAR(300),
            adquiriente_nit  VARCHAR(30),
            adquiriente_nombre VARCHAR(300),
            subtotal        NUMERIC(18,2) NOT NULL DEFAULT 0,
            iva             NUMERIC(18,2) NOT NULL DEFAULT 0,
            retefuente      NUMERIC(18,2) NOT NULL DEFAULT 0,
            reteiva         NUMERIC(18,2) NOT NULL DEFAULT 0,
            reteica         NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_bruto     NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_pagar     NUMERIC(18,2) NOT NULL DEFAULT 0,
            tiene_retencion BOOLEAN NOT NULL DEFAULT FALSE,
            estado          VARCHAR(30) NOT NULL DEFAULT 'RECIBIDA',
            xml_filename    VARCHAR(255),
            xml_content     TEXT,
            observaciones   TEXT,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_fe_fecha ON facturas_electronicas(fecha_emision)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fe_estado ON facturas_electronicas(estado)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fe_proveedor ON facturas_electronicas(proveedor_nit)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS facturas_electronicas")
