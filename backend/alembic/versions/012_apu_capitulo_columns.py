"""APU: agregar columnas capitulo + hacer nullable codigo en detalles.

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('apu', sa.Column('capitulo_codigo', sa.VARCHAR(10), nullable=True))
    op.add_column('apu', sa.Column('capitulo', sa.VARCHAR(200), nullable=True))
    op.alter_column('apu_materiales', 'codigo', nullable=True)
    op.alter_column('apu_mano_obra', 'codigo', nullable=True)
    op.alter_column('apu_equipos', 'codigo', nullable=True)


def downgrade():
    op.drop_column('apu', 'capitulo')
    op.drop_column('apu', 'capitulo_codigo')
