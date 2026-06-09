"""Add impuesto_porcentaje to productos

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('productos', sa.Column('impuesto_porcentaje', sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('productos', 'impuesto_porcentaje')
