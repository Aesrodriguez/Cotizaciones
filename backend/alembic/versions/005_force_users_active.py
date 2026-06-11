"""Force initial users to ACTIVO state with correct hashes

Revision ID: 005
Revises: 004
Create Date: 2026-06-11 01:00:00.000000

"""
from alembic import op

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Force all three initial users to ACTIVO with verified hashes
    # Migration 004 only updated password_hash but not estado
    op.execute("""
    UPDATE usuarios SET
      password_hash = '$2b$12$10T6cxORZf5tVhdsbuVRlOMfzyj3JwrxlGCEIKIYrxwwj0E1IJ6HS',
      estado        = 'ACTIVO',
      verificado    = true,
      intentos_fallidos = 0,
      updated_at    = NOW()
    WHERE email = 'admin@tripleaconstrucciones.com.co';
    """)

    op.execute("""
    UPDATE usuarios SET
      password_hash = '$2b$12$9uqloFiWK7YaloVh3YbL..xXt/on.e9aCCPyt.uLqb27VpXMnKxXO',
      estado        = 'ACTIVO',
      verificado    = true,
      intentos_fallidos = 0,
      updated_at    = NOW()
    WHERE email = 'gerencia@tripleaconstrucciones.com.co';
    """)

    op.execute("""
    UPDATE usuarios SET
      password_hash = '$2b$12$.qlXeEK4iMu3ewGO/6V/r.HE0THhHC2C1ryrTFd7zIXdhvXmJLBJ6',
      estado        = 'ACTIVO',
      verificado    = true,
      intentos_fallidos = 0,
      updated_at    = NOW()
    WHERE email = 'comercial@tripleaconstrucciones.com.co';
    """)


def downgrade() -> None:
    pass
