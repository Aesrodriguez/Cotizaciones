"""Agregar restricciones de unicidad a facturas_electronicas

Revision ID: 017
Revises: 016
Create Date: 2026-06-23
"""
from alembic import op

revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    # CUFE es globalmente único (hash criptográfico DIAN)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_cufe
        ON facturas_electronicas(cufe)
        WHERE cufe IS NOT NULL
    """)

    # Número + NIT del proveedor también debe ser único
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_numero_nit
        ON facturas_electronicas(numero, proveedor_nit)
        WHERE proveedor_nit IS NOT NULL
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_facturas_cufe")
    op.execute("DROP INDEX IF EXISTS uq_facturas_numero_nit")
