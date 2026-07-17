"""trabajadores: salario_diario, contacto emergencia, familiares"""
from alembic import op
import sqlalchemy as sa

revision = '030'
down_revision = '029'
branch_labels = None
depends_on = None


def upgrade():
    # Campos de emergencia / familiares
    op.add_column('trabajadores', sa.Column('contacto_emergencia_nombre',   sa.String(100), nullable=True))
    op.add_column('trabajadores', sa.Column('contacto_emergencia_telefono', sa.String(30),  nullable=True))
    op.add_column('trabajadores', sa.Column('contacto_emergencia_relacion', sa.String(50),  nullable=True))
    # Familiares como JSON (array de objetos)
    op.add_column('trabajadores', sa.Column('familiares_json', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('trabajadores', 'familiares_json')
    op.drop_column('trabajadores', 'contacto_emergencia_relacion')
    op.drop_column('trabajadores', 'contacto_emergencia_telefono')
    op.drop_column('trabajadores', 'contacto_emergencia_nombre')
