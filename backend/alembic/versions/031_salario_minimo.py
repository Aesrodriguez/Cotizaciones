"""salario mínimo por año + tipo_salario en trabajadores"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '031'
down_revision = '030'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'salario_minimo',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('anio', sa.Integer(), nullable=False),
        sa.Column('valor', sa.Numeric(15, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('anio', name='uq_salario_minimo_anio'),
    )

    op.add_column('trabajadores', sa.Column('tipo_salario', sa.String(10), nullable=True, server_default='OTRO'))


def downgrade():
    op.drop_column('trabajadores', 'tipo_salario')
    op.drop_table('salario_minimo')
