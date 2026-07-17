"""trabajadores: EPS, pensión, ARL, datos personales adicionales"""
from alembic import op
import sqlalchemy as sa

revision = '032'
down_revision = '031'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('trabajadores', sa.Column('tipo_documento',   sa.String(20),  nullable=True))
    op.add_column('trabajadores', sa.Column('fecha_nacimiento', sa.Date(),       nullable=True))
    op.add_column('trabajadores', sa.Column('genero',           sa.String(10),   nullable=True))
    op.add_column('trabajadores', sa.Column('estado_civil',     sa.String(30),   nullable=True))
    op.add_column('trabajadores', sa.Column('nivel_educativo',  sa.String(30),   nullable=True))
    op.add_column('trabajadores', sa.Column('eps',              sa.String(100),  nullable=True))
    op.add_column('trabajadores', sa.Column('fondo_pension',    sa.String(100),  nullable=True))
    op.add_column('trabajadores', sa.Column('arl',              sa.String(100),  nullable=True))
    op.add_column('trabajadores', sa.Column('caja_compensacion', sa.String(100), nullable=True))
    op.add_column('trabajadores', sa.Column('numero_hijos',     sa.Integer(),    nullable=True))


def downgrade():
    for col in ['numero_hijos', 'caja_compensacion', 'arl', 'fondo_pension', 'eps',
                'nivel_educativo', 'estado_civil', 'genero', 'fecha_nacimiento', 'tipo_documento']:
        op.drop_column('trabajadores', col)
