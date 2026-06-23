"""Módulo de materiales: obras, catálogo, compras y usos

Revision ID: 024
Revises: 023
Create Date: 2026-06-23
"""
from alembic import op

revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade():
    # Proyectos / obras de construcción
    op.execute("""
        CREATE TABLE IF NOT EXISTS obras (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre      VARCHAR(300) NOT NULL,
            cliente     VARCHAR(300),
            direccion   VARCHAR(400),
            ciudad      VARCHAR(100),
            estado      VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
            fecha_inicio DATE,
            fecha_fin    DATE,
            notas        TEXT,
            created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_obras_estado ON obras(estado)")

    # Catálogo de materiales
    op.execute("""
        CREATE TABLE IF NOT EXISTS materiales (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre      VARCHAR(300) NOT NULL,
            referencia  VARCHAR(100),
            categoria   VARCHAR(100),
            unidad      VARCHAR(30) NOT NULL DEFAULT 'UND',
            descripcion TEXT,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_materiales_cat ON materiales(categoria)")

    # Compras / entradas de material
    op.execute("""
        CREATE TABLE IF NOT EXISTS compras_materiales (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_id      UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
            fecha            DATE NOT NULL,
            cantidad         NUMERIC(14, 4) NOT NULL,
            precio_unitario  NUMERIC(18, 2) NOT NULL DEFAULT 0,
            proveedor_nombre VARCHAR(300),
            proveedor_nit    VARCHAR(30),
            factura_id       UUID REFERENCES facturas_electronicas(id) ON DELETE SET NULL,
            numero_factura   VARCHAR(100),
            obra_id          UUID REFERENCES obras(id) ON DELETE SET NULL,
            observaciones    TEXT,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_cm_material ON compras_materiales(material_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cm_factura  ON compras_materiales(factura_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cm_obra     ON compras_materiales(obra_id)")

    # Usos / salidas de material
    op.execute("""
        CREATE TABLE IF NOT EXISTS usos_materiales (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_id UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
            obra_id     UUID REFERENCES obras(id) ON DELETE SET NULL,
            fecha       DATE NOT NULL,
            cantidad    NUMERIC(14, 4) NOT NULL,
            lugar_libre VARCHAR(300),
            observaciones TEXT,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_um_material ON usos_materiales(material_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_um_obra     ON usos_materiales(obra_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS usos_materiales CASCADE")
    op.execute("DROP TABLE IF EXISTS compras_materiales CASCADE")
    op.execute("DROP TABLE IF EXISTS materiales CASCADE")
    op.execute("DROP TABLE IF EXISTS obras CASCADE")
