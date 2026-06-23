"""Ampliar facturas_electronicas y crear tabla de ítems de factura

Revision ID: 016
Revises: 015
Create Date: 2026-06-23
"""
from alembic import op

revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    # Columnas adicionales en facturas_electronicas
    op.execute("""
        ALTER TABLE facturas_electronicas
            ADD COLUMN IF NOT EXISTS cufe              VARCHAR(250),
            ADD COLUMN IF NOT EXISTS tipo_documento    VARCHAR(10),
            ADD COLUMN IF NOT EXISTS nota              TEXT,
            ADD COLUMN IF NOT EXISTS moneda            VARCHAR(10) DEFAULT 'COP',
            ADD COLUMN IF NOT EXISTS forma_pago        VARCHAR(30),
            ADD COLUMN IF NOT EXISTS dian_validado     BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS dian_respuesta    VARCHAR(100),
            ADD COLUMN IF NOT EXISTS proveedor_telefono   VARCHAR(100),
            ADD COLUMN IF NOT EXISTS proveedor_email      VARCHAR(200),
            ADD COLUMN IF NOT EXISTS proveedor_direccion  VARCHAR(300),
            ADD COLUMN IF NOT EXISTS proveedor_ciudad     VARCHAR(100),
            ADD COLUMN IF NOT EXISTS adquiriente_telefono   VARCHAR(100),
            ADD COLUMN IF NOT EXISTS adquiriente_email      VARCHAR(200),
            ADD COLUMN IF NOT EXISTS adquiriente_direccion  VARCHAR(300),
            ADD COLUMN IF NOT EXISTS adquiriente_ciudad     VARCHAR(100),
            ADD COLUMN IF NOT EXISTS autorizacion_dian  VARCHAR(60),
            ADD COLUMN IF NOT EXISTS autorizacion_desde DATE,
            ADD COLUMN IF NOT EXISTS autorizacion_hasta DATE,
            ADD COLUMN IF NOT EXISTS prefijo           VARCHAR(20),
            ADD COLUMN IF NOT EXISTS qr_url            TEXT
    """)

    # Tabla de líneas de la factura
    op.execute("""
        CREATE TABLE IF NOT EXISTS facturas_electronicas_items (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            factura_id      UUID NOT NULL REFERENCES facturas_electronicas(id) ON DELETE CASCADE,
            linea_num       INTEGER NOT NULL DEFAULT 0,
            descripcion     VARCHAR(500),
            referencia      VARCHAR(100),
            cantidad        NUMERIC(12,4) NOT NULL DEFAULT 0,
            unidad          VARCHAR(20),
            precio_unitario NUMERIC(18,2) NOT NULL DEFAULT 0,
            subtotal        NUMERIC(18,2) NOT NULL DEFAULT 0,
            iva_pct         NUMERIC(6,2) NOT NULL DEFAULT 0,
            iva_monto       NUMERIC(18,2) NOT NULL DEFAULT 0,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_fei_factura ON facturas_electronicas_items(factura_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS facturas_electronicas_items")
