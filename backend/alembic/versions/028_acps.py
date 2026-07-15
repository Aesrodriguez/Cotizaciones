"""crear tablas actas de corte de pago (ACP)"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '028'
down_revision = '027'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'contrato_acps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('contrato_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contratos.id', ondelete='SET NULL'), nullable=True),
        # Encabezado del acta
        sa.Column('numero_acta', sa.String(30), nullable=False),
        sa.Column('codigo_corte', sa.Integer, nullable=True),
        sa.Column('obra', sa.String(200), nullable=True),
        sa.Column('numero_contrato_cliente', sa.String(50), nullable=True),
        sa.Column('objeto', sa.Text, nullable=True),
        sa.Column('contratista', sa.String(200), nullable=True),
        sa.Column('nit_contratista', sa.String(20), nullable=True),
        sa.Column('elaborado_por', sa.String(200), nullable=True),
        sa.Column('fecha_acta', sa.Date, nullable=True),
        sa.Column('fecha_terminacion', sa.Date, nullable=True),
        sa.Column('forma_pago', sa.String(100), nullable=True),
        sa.Column('archivo_nombre', sa.String(300), nullable=True),
        sa.Column('archivo_url', sa.String(500), nullable=True),
        # Valores del contrato (según encabezado del ACP)
        sa.Column('vr_inicial', sa.Numeric(15, 2), nullable=True),
        sa.Column('vr_modificacion', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_contrato', sa.Numeric(15, 2), nullable=True),
        sa.Column('acumulado_anterior', sa.Numeric(15, 2), nullable=True),
        sa.Column('acumulado_actual', sa.Numeric(15, 2), nullable=True),
        sa.Column('saldo_contrato', sa.Numeric(15, 2), nullable=True),
        # Resumen financiero del acta
        sa.Column('vr_neto', sa.Numeric(15, 2), nullable=True),
        sa.Column('pct_administracion', sa.Numeric(5, 2), server_default='0'),
        sa.Column('vr_administracion', sa.Numeric(15, 2), server_default='0'),
        sa.Column('pct_imprevistos', sa.Numeric(5, 2), server_default='0'),
        sa.Column('vr_imprevistos', sa.Numeric(15, 2), server_default='0'),
        sa.Column('pct_utilidad', sa.Numeric(5, 2), server_default='0'),
        sa.Column('vr_utilidad', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_subtotal_antes_iva', sa.Numeric(15, 2), nullable=True),
        sa.Column('pct_iva', sa.Numeric(5, 2), server_default='0'),
        sa.Column('base_iva', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_iva', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_acta', sa.Numeric(15, 2), nullable=True),
        sa.Column('pct_anticipo', sa.Numeric(5, 2), server_default='0'),
        sa.Column('vr_amortizacion_anticipo', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_anticipos_girados', sa.Numeric(15, 2), server_default='0'),
        sa.Column('pct_ret_anticipo', sa.Numeric(5, 2), server_default='0'),
        sa.Column('vr_ret_anticipo_acta', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_ret_anticipo_acumulado', sa.Numeric(15, 2), server_default='0'),
        sa.Column('pct_retencion_garantia', sa.Numeric(5, 2), server_default='0'),
        sa.Column('vr_retencion_acta', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_retencion_acumulado', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_total_descuentos', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_total_pagar', sa.Numeric(15, 2), nullable=True),
        sa.Column('observaciones', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'contrato_acp_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('acp_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contrato_acps.id', ondelete='CASCADE'), nullable=False),
        sa.Column('actividad', sa.String(300), nullable=False),
        sa.Column('articulo', sa.String(100), nullable=True),
        sa.Column('unidad', sa.String(20), nullable=True),
        sa.Column('cantidad', sa.Numeric(14, 4), nullable=True),
        sa.Column('vr_unitario', sa.Numeric(15, 2), nullable=True),
        sa.Column('vr_iva', sa.Numeric(15, 2), server_default='0'),
        sa.Column('vr_total', sa.Numeric(15, 2), nullable=True),
        sa.Column('observaciones', sa.Text, nullable=True),
        sa.Column('orden', sa.Integer, server_default='0'),
    )

    op.create_index('ix_acps_contrato', 'contrato_acps', ['contrato_id'])
    op.create_index('ix_acps_numero', 'contrato_acps', ['numero_acta'])


def downgrade():
    op.drop_index('ix_acps_numero')
    op.drop_index('ix_acps_contrato')
    op.drop_table('contrato_acp_items')
    op.drop_table('contrato_acps')
