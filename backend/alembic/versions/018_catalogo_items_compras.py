"""Catálogo de ítems de compra deduplicado

Revision ID: 018
Revises: 017
Create Date: 2026-06-23
"""
from alembic import op

revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS items_catalogo_compras (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            referencia       VARCHAR(100),
            descripcion      VARCHAR(500) NOT NULL,
            unidad           VARCHAR(20),
            proveedor_nit    VARCHAR(30),
            proveedor_nombre VARCHAR(300),
            ultimo_precio    NUMERIC(18,2),
            ultima_compra    DATE,
            total_compras    INTEGER NOT NULL DEFAULT 1,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    # Mismo código de referencia del mismo proveedor = mismo ítem
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_catalogo_ref_nit
        ON items_catalogo_compras(referencia, proveedor_nit)
        WHERE referencia IS NOT NULL AND proveedor_nit IS NOT NULL
    """)

    # Sin referencia: misma descripción (normalizada) del mismo proveedor
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_catalogo_desc_nit
        ON items_catalogo_compras(LOWER(descripcion), proveedor_nit)
        WHERE referencia IS NULL AND proveedor_nit IS NOT NULL
    """)

    # FK en los ítems de factura → catálogo
    op.execute("""
        ALTER TABLE facturas_electronicas_items
            ADD COLUMN IF NOT EXISTS catalogo_item_id UUID
                REFERENCES items_catalogo_compras(id) ON DELETE SET NULL
    """)


def downgrade():
    op.execute("ALTER TABLE facturas_electronicas_items DROP COLUMN IF EXISTS catalogo_item_id")
    op.execute("DROP TABLE IF EXISTS items_catalogo_compras")
