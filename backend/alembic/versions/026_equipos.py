"""Módulo de equipos y herramientas

Revision ID: 026
Revises: 025
Create Date: 2026-07-05
"""
from alembic import op

revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS equipos (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre       VARCHAR(300) NOT NULL,
            marca        VARCHAR(100),
            modelo       VARCHAR(100),
            serial       VARCHAR(100),
            categoria    VARCHAR(100),
            estado       VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
            fecha_compra DATE,
            valor_compra NUMERIC(18, 2),
            notas        TEXT,
            created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_equipos_estado ON equipos(estado)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_equipos_cat   ON equipos(categoria)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS usos_equipos (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            equipo_id    UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
            obra_id      UUID REFERENCES obras(id) ON DELETE SET NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin    DATE,
            lugar_libre  VARCHAR(300),
            observaciones TEXT,
            created_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ue_equipo ON usos_equipos(equipo_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ue_obra   ON usos_equipos(obra_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS usos_equipos CASCADE")
    op.execute("DROP TABLE IF EXISTS equipos CASCADE")
