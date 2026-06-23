"""Módulo de extractos bancarios

Revision ID: 019
Revises: 018
Create Date: 2026-06-23
"""
from alembic import op

revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS extractos_bancarios (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre_archivo  VARCHAR(255) NOT NULL,
            cuenta          VARCHAR(30),
            periodo         VARCHAR(7),          -- YYYY-MM
            saldo_inicial   NUMERIC(18,2),
            saldo_final     NUMERIC(18,2),
            total_creditos  NUMERIC(18,2) DEFAULT 0,
            total_debitos   NUMERIC(18,2) DEFAULT 0,
            num_movimientos INTEGER DEFAULT 0,
            observaciones   TEXT,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS extractos_bancarios_movimientos (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            extracto_id         UUID NOT NULL REFERENCES extractos_bancarios(id) ON DELETE CASCADE,
            tipo                VARCHAR(10) NOT NULL,   -- CREDITO | DEBITO
            tipo_codigo         VARCHAR(10),            -- 0034 | 0055 | 0046
            fecha               DATE NOT NULL,
            fecha_aplicacion    DATE,
            hora                TIME,
            oficina             VARCHAR(10),
            consecutivo         VARCHAR(20),
            valor               NUMERIC(18,2) NOT NULL, -- positivo siempre
            valor_con_cargos    NUMERIC(18,2),
            banco_codigo        VARCHAR(10),
            codigo_servicio     VARCHAR(10),
            descripcion_servicio VARCHAR(80),
            cuenta_ref1         VARCHAR(25),
            cuenta_ref2         VARCHAR(25),
            saldo               NUMERIC(18,2),
            referencia          VARCHAR(30),
            clasificacion       VARCHAR(40),
            created_at          TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ebm_extracto ON extractos_bancarios_movimientos(extracto_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ebm_fecha ON extractos_bancarios_movimientos(fecha)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS extractos_bancarios_movimientos")
    op.execute("DROP TABLE IF EXISTS extractos_bancarios")
