"""agregar archivo_contrato_nombre y ampliar archivo_contrato en contratos"""
from alembic import op
import sqlalchemy as sa

revision = '029'
down_revision = '028'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('contratos', sa.Column('archivo_contrato_nombre', sa.String(300), nullable=True))
    op.alter_column('contratos', 'archivo_contrato', type_=sa.String(500), existing_nullable=True)


def downgrade():
    op.drop_column('contratos', 'archivo_contrato_nombre')
    op.alter_column('contratos', 'archivo_contrato', type_=sa.String(255), existing_nullable=True)
