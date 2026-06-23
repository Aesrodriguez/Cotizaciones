"""Agrega movimiento_id a pagos_facturas_links para vincular extracto ↔ factura

Revision ID: 022
Revises: 021
Create Date: 2026-06-23
"""
from alembic import op

revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE pagos_facturas_links
        ADD COLUMN IF NOT EXISTS movimiento_id UUID
            REFERENCES extractos_bancarios_movimientos(id) ON DELETE CASCADE
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_link_movimiento_factura
        ON pagos_facturas_links(movimiento_id, factura_id)
        WHERE movimiento_id IS NOT NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_pfl_movimiento ON pagos_facturas_links(movimiento_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_link_movimiento_factura")
    op.execute("DROP INDEX IF EXISTS idx_pfl_movimiento")
    op.execute("ALTER TABLE pagos_facturas_links DROP COLUMN IF EXISTS movimiento_id")
