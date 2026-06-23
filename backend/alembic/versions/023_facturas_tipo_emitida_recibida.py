"""Columna tipo en facturas_electronicas: RECIBIDA | EMITIDA

Revision ID: 023
Revises: 022
Create Date: 2026-06-23
"""
from alembic import op

revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None

# NIT y palabras clave de la empresa emisora
_KEYWORDS = "TRIPLE A CONSTRUCCIONES"


def upgrade():
    op.execute("""
        ALTER TABLE facturas_electronicas
        ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'RECIBIDA'
    """)
    # Marcar retroactivamente las ya cargadas que son de la propia empresa
    op.execute(f"""
        UPDATE facturas_electronicas
        SET tipo = 'EMITIDA'
        WHERE proveedor_nombre ILIKE '%{_KEYWORDS}%'
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_fe_tipo ON facturas_electronicas(tipo)
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_fe_tipo")
    op.execute("ALTER TABLE facturas_electronicas DROP COLUMN IF EXISTS tipo")
