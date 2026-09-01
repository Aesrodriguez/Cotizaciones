"""Link público y registro de vistas para cotizaciones

Revision ID: 039
Revises: 038
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID


def upgrade():
    conn = op.get_bind()

    # token_publico en cotizaciones
    exists = conn.execute(text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name='cotizaciones' AND column_name='token_publico'"
    )).scalar()
    if not exists:
        op.add_column('cotizaciones', sa.Column(
            'token_publico', sa.VARCHAR(64), nullable=True, unique=True
        ))

    # tabla de vistas
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS cotizacion_vistas (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
            fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ip          VARCHAR(64),
            user_agent  VARCHAR(512)
        )
    """))
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_cot_vistas_cotizacion ON cotizacion_vistas(cotizacion_id)"
    ))


def downgrade():
    op.drop_table('cotizacion_vistas')
    op.drop_column('cotizaciones', 'token_publico')
