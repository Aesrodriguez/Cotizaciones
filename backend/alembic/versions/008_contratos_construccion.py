"""Add construction contract management tables

Revision ID: 008
Revises: 007
Create Date: 2026-06-11 00:00:00.000000

Root cause of previous failure
--------------------------------
The original migration called op.execute("CREATE TYPE estadoacta ...") and then
passed sa.Enum(..., name='estadoacta') to op.create_table(). SQLAlchemy's ENUM
type emits its own CREATE TYPE statement before the CREATE TABLE, so the type was
created twice → DuplicateObject error.

Fix
---
* Types are created with an idempotent DO $$ … $$ block (safe to run many times).
* Column definitions use postgresql.ENUM(..., create_type=False) so SQLAlchemy
  never tries to emit a second CREATE TYPE.
* downgrade() drops tables first, then types with IF EXISTS (no CASCADE needed
  because the tables are gone by then).
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Reusable ENUM references (create_type=False → type created by the DO block,
# SQLAlchemy must not emit a second CREATE TYPE).
# ---------------------------------------------------------------------------
_estadoacta = postgresql.ENUM(
    'BORRADOR', 'APROBADA', 'PAGADA',
    name='estadoacta',
    create_type=False,
)

_categoriagasto = postgresql.ENUM(
    'MATERIALES', 'MANO_OBRA', 'EQUIPOS', 'TRANSPORTE', 'COMBUSTIBLE',
    'VIATICOS', 'HOSPEDAJE', 'ADMINISTRACION', 'IMPREVISTOS', 'OTROS',
    name='categoriagastocontrato',
    create_type=False,
)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create ENUM types — idempotent (safe on reruns / Render redeploys)
    # ------------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estadoacta') THEN
                CREATE TYPE estadoacta AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA');
            END IF;
        END$$;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoriagastocontrato') THEN
                CREATE TYPE categoriagastocontrato AS ENUM (
                    'MATERIALES', 'MANO_OBRA', 'EQUIPOS', 'TRANSPORTE', 'COMBUSTIBLE',
                    'VIATICOS', 'HOSPEDAJE', 'ADMINISTRACION', 'IMPREVISTOS', 'OTROS'
                );
            END IF;
        END$$;
    """)

    # ------------------------------------------------------------------
    # 2. Add new columns to the existing contratos table
    # ------------------------------------------------------------------
    op.add_column('contratos', sa.Column('objeto', sa.Text(), nullable=True))
    op.add_column('contratos', sa.Column('nombre', sa.VARCHAR(255), nullable=True))
    op.add_column('contratos', sa.Column('con_aiu', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('contratos', sa.Column('aiu_administracion', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('aiu_imprevistos', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('aiu_utilidad', sa.Numeric(5, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('aiu_monto', sa.Numeric(15, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('impuesto', sa.Numeric(15, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('valor_final', sa.Numeric(15, 2), nullable=False, server_default='0'))
    op.add_column('contratos', sa.Column('condiciones_pago', sa.Text(), nullable=True))
    op.add_column('contratos', sa.Column('plazo_dias', sa.Integer(), nullable=True))
    op.add_column('contratos', sa.Column('nit_cliente', sa.VARCHAR(50), nullable=True))

    # ------------------------------------------------------------------
    # 3. contrato_capitulos  (self-referential: padre_id → id)
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_capitulos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('padre_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_capitulos.id', ondelete='CASCADE'), nullable=True),
        sa.Column('codigo', sa.VARCHAR(50), nullable=True),
        sa.Column('nombre', sa.VARCHAR(255), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_capitulos_contrato_id', 'contrato_capitulos', ['contrato_id'])

    # ------------------------------------------------------------------
    # 4. contrato_items
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('capitulo_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_capitulos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('codigo', sa.VARCHAR(50), nullable=True),
        sa.Column('descripcion', sa.VARCHAR(500), nullable=False),
        sa.Column('unidad', sa.VARCHAR(30), nullable=False, server_default='UN'),
        sa.Column('cantidad_contratada', sa.Numeric(15, 4), nullable=False),
        sa.Column('valor_unitario', sa.Numeric(15, 2), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_items_capitulo_id', 'contrato_items', ['capitulo_id'])

    # ------------------------------------------------------------------
    # 5. contrato_actas  (must exist before ejecuciones references it)
    #    Uses _estadoacta with create_type=False — no second CREATE TYPE.
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_actas',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('numero', sa.VARCHAR(50), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('responsable', sa.VARCHAR(255), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('valor_total', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('estado', _estadoacta, nullable=False, server_default='BORRADOR'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('contrato_id', 'numero', name='uq_actas_contrato_numero'),
    )
    op.create_index('idx_actas_contrato_id', 'contrato_actas', ['contrato_id'])

    # ------------------------------------------------------------------
    # 6. contrato_ejecuciones  (references items + actas)
    #    No SoftDelete → no deleted_at column.
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_ejecuciones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('acta_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_actas.id', ondelete='SET NULL'), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('cantidad', sa.Numeric(15, 4), nullable=False),
        sa.Column('valor_unitario', sa.Numeric(15, 2), nullable=False),
        sa.Column('valor_total', sa.Numeric(15, 2), nullable=False),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('cantidad > 0', name='ck_ejecuciones_cantidad'),
        sa.CheckConstraint('valor_total >= 0', name='ck_ejecuciones_valor_total'),
    )
    op.create_index('idx_ejecuciones_item_id', 'contrato_ejecuciones', ['item_id'])
    op.create_index('idx_ejecuciones_acta_id', 'contrato_ejecuciones', ['acta_id'])

    # ------------------------------------------------------------------
    # 7. contrato_pagos
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_pagos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('acta_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_actas.id', ondelete='SET NULL'), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('valor', sa.Numeric(15, 2), nullable=False),
        sa.Column('descripcion', sa.VARCHAR(500), nullable=True),
        sa.Column('metodo_pago', sa.VARCHAR(100), nullable=True),
        sa.Column('referencia', sa.VARCHAR(200), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('valor > 0', name='ck_pagos_valor'),
    )
    op.create_index('idx_pagos_contrato_id', 'contrato_pagos', ['contrato_id'])

    # ------------------------------------------------------------------
    # 8. contrato_gastos
    #    Uses _categoriagasto with create_type=False — no second CREATE TYPE.
    # ------------------------------------------------------------------
    op.create_table(
        'contrato_gastos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('categoria', _categoriagasto, nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('descripcion', sa.VARCHAR(500), nullable=False),
        sa.Column('proveedor', sa.VARCHAR(255), nullable=True),
        sa.Column('factura', sa.VARCHAR(100), nullable=True),
        sa.Column('valor', sa.Numeric(15, 2), nullable=False),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('valor > 0', name='ck_contrato_gastos_valor'),
    )
    op.create_index('idx_contrato_gastos_contrato_id', 'contrato_gastos', ['contrato_id'])


def downgrade() -> None:
    # Drop tables in reverse FK dependency order
    op.drop_table('contrato_gastos')
    op.drop_table('contrato_pagos')
    op.drop_table('contrato_ejecuciones')
    op.drop_table('contrato_actas')
    op.drop_table('contrato_items')
    op.drop_table('contrato_capitulos')

    # Remove columns added to contratos
    for col in ('nit_cliente', 'plazo_dias', 'condiciones_pago', 'valor_final',
                'impuesto', 'aiu_monto', 'aiu_utilidad', 'aiu_imprevistos',
                'aiu_administracion', 'con_aiu', 'nombre', 'objeto'):
        op.drop_column('contratos', col)

    # Drop ENUM types — tables are already gone, no CASCADE needed.
    # IF EXISTS makes the downgrade idempotent as well.
    op.execute('DROP TYPE IF EXISTS categoriagastocontrato')
    op.execute('DROP TYPE IF EXISTS estadoacta')
