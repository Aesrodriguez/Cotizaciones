"""extractos_bancarios: agregar archivo_url para link a Google Drive"""
from alembic import op
import sqlalchemy as sa

revision = '033'
down_revision = '032'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('extractos_bancarios', sa.Column('archivo_url', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('extractos_bancarios', 'archivo_url')
