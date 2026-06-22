"""Performance: índices compuestos para queries frecuentes.

Revision ID: 011
Revises: 010
"""
from alembic import op
from sqlalchemy import text

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None

_INDEXES = [
    ("idx_trab_asig_trab_deleted",      "trabajador_asignaciones", "trabajador_id, deleted_at"),
    ("idx_trab_asig_trab_estado",       "trabajador_asignaciones", "trabajador_id, estado"),
    ("idx_trab_pagos_contrato_id",      "trabajador_pagos",        "contrato_id"),
    ("idx_contratos_cliente_estado",    "contratos",               "cliente_id, estado"),
    ("idx_trabajadores_cedula",         "trabajadores",            "cedula"),
    ("idx_cotizaciones_usuario_estado", "cotizaciones",            "usuario_id, estado"),
    ("idx_trab_corte_det_corte_lookup", "trabajador_cortes_detalle", "corte_id, fecha_pago"),
]


def upgrade():
    conn = op.get_bind()
    for name, table, cols in _INDEXES:
        conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})"))


def downgrade():
    conn = op.get_bind()
    for name, table, _ in _INDEXES:
        conn.execute(text(f"DROP INDEX IF EXISTS {name}"))
