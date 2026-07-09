"""crear tablas planillas seguridad social"""
from alembic import op
import sqlalchemy as sa

revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'planillas',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('numero_planilla', sa.String(30), nullable=False, unique=True),
        sa.Column('nit', sa.String(20)),
        sa.Column('razon_social', sa.String(200)),
        sa.Column('periodo_pension', sa.String(7)),
        sa.Column('periodo_salud', sa.String(7)),
        sa.Column('tipo', sa.String(5)),
        sa.Column('fecha_limite', sa.String(10)),
        sa.Column('fecha_pago', sa.String(10)),
        sa.Column('banco', sa.String(100)),
        sa.Column('dias_mora', sa.Integer, server_default='0'),
        sa.Column('valor_total', sa.Numeric(15, 0), server_default='0'),
        sa.Column('total_afiliados', sa.Integer, server_default='0'),
        sa.Column('exonerado_sena_icbf', sa.Boolean, server_default='false'),
        sa.Column('archivo_nombre', sa.String(255)),
        sa.Column('archivo_url', sa.String(500)),  # futuro: Google Drive URL
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        'planilla_empleados',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('planilla_id', sa.Integer,
                  sa.ForeignKey('planillas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('numero', sa.Integer),
        sa.Column('tipo_doc', sa.String(5)),
        sa.Column('cedula', sa.String(20)),
        sa.Column('nombre', sa.String(200)),
        # Pensión
        sa.Column('cod_pension', sa.String(10)),
        sa.Column('dias_pension', sa.Integer),
        sa.Column('ibc_pension', sa.Numeric(15, 0)),
        sa.Column('aporte_pension', sa.Numeric(15, 0)),
        # Salud
        sa.Column('cod_salud', sa.String(10)),
        sa.Column('dias_salud', sa.Integer),
        sa.Column('ibc_salud', sa.Numeric(15, 0)),
        sa.Column('aporte_salud', sa.Numeric(15, 0)),
        # CCF
        sa.Column('cod_ccf', sa.String(10)),
        sa.Column('dias_ccf', sa.Integer),
        sa.Column('ibc_ccf', sa.Numeric(15, 0)),
        sa.Column('aporte_ccf', sa.Numeric(15, 0)),
        # ARL / Riesgos
        sa.Column('cod_riesgo', sa.String(10)),
        sa.Column('dias_riesgo', sa.Integer),
        sa.Column('ibc_riesgo', sa.Numeric(15, 0)),
        sa.Column('tarifa_riesgo', sa.Numeric(8, 4)),
        sa.Column('aporte_riesgo', sa.Numeric(15, 0)),
        # Parafiscales
        sa.Column('dias_parafiscales', sa.Integer),
        sa.Column('ibc_parafiscales', sa.Numeric(15, 0)),
        sa.Column('aporte_parafiscales', sa.Numeric(15, 0)),
        sa.Column('exonerado', sa.Boolean, server_default='false'),
        sa.Column('total_aportes', sa.Numeric(15, 0)),
    )

    op.create_table(
        'planilla_entidades',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('planilla_id', sa.Integer,
                  sa.ForeignKey('planillas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('categoria', sa.String(10)),   # AFP / ARL / CCF / EPS
        sa.Column('entidad', sa.String(100)),
        sa.Column('codigo', sa.String(20)),
        sa.Column('nit_entidad', sa.String(20)),
        sa.Column('dv', sa.String(2)),
        sa.Column('afiliados', sa.Integer),
        sa.Column('valor_liquidado', sa.Numeric(15, 0)),
        sa.Column('intereses_mora', sa.Numeric(15, 0), server_default='0'),
        sa.Column('saldos_incapacidades', sa.Numeric(15, 0), server_default='0'),
        sa.Column('valor_a_pagar', sa.Numeric(15, 0)),
        sa.Column('es_subtotal', sa.Boolean, server_default='false'),
    )


def downgrade():
    op.drop_table('planilla_entidades')
    op.drop_table('planilla_empleados')
    op.drop_table('planillas')
