"""Reemplazar uq_facturas_numero_nit para excluir prefijos truncados

El constraint anterior aplicaba a TODOS los valores de numero, incluyendo
prefijos parciales como "94-" o "2401-" que el parser puede generar cuando
el PDF divide el número en dos líneas.  El nuevo constraint solo se activa
para números completos (que no terminan en "-").

Revision ID: 035
Revises: 034
Create Date: 2026-07-27
"""
from alembic import op

revision = '035'
down_revision = '034'
branch_labels = None
depends_on = None


def upgrade():
    # Eliminar el constraint que bloquea prefijos truncados con el mismo NIT
    op.execute("DROP INDEX IF EXISTS uq_facturas_numero_nit")

    # Nuevo constraint: solo aplica a números que no son prefijos parciales
    op.execute("""
        CREATE UNIQUE INDEX uq_facturas_numero_nit
        ON facturas_electronicas(numero, proveedor_nit)
        WHERE proveedor_nit IS NOT NULL
          AND numero NOT LIKE '%-'
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_facturas_numero_nit")
    op.execute("""
        CREATE UNIQUE INDEX uq_facturas_numero_nit
        ON facturas_electronicas(numero, proveedor_nit)
        WHERE proveedor_nit IS NOT NULL
    """)
