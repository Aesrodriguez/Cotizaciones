"""Fix user password hashes for initial users

Revision ID: 004
Revises: 003
Create Date: 2026-06-11 00:00:00.000000

"""
from alembic import op

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update password hashes with verified bcrypt hashes (cost=12)
    # admin@tripleaconstrucciones.com.co / TripleA2024
    op.execute("""
    UPDATE usuarios SET password_hash = '$2b$12$10T6cxORZf5tVhdsbuVRlOMfzyj3JwrxlGCEIKIYrxwwj0E1IJ6HS'
    WHERE email = 'admin@tripleaconstrucciones.com.co';
    """)

    # gerencia@tripleaconstrucciones.com.co / Gerencia2024
    op.execute("""
    UPDATE usuarios SET password_hash = '$2b$12$9uqloFiWK7YaloVh3YbL..xXt/on.e9aCCPyt.uLqb27VpXMnKxXO'
    WHERE email = 'gerencia@tripleaconstrucciones.com.co';
    """)

    # comercial@tripleaconstrucciones.com.co / Comercial2024
    op.execute("""
    UPDATE usuarios SET password_hash = '$2b$12$.qlXeEK4iMu3ewGO/6V/r.HE0THhHC2C1ryrTFd7zIXdhvXmJLBJ6'
    WHERE email = 'comercial@tripleaconstrucciones.com.co';
    """)

    # Also ensure users exist in case migration 003 was skipped
    op.execute("""
    INSERT INTO usuarios (id, email, password_hash, nombres, apellidos, telefono, estado, verificado, intentos_fallidos, created_at, updated_at) VALUES
      ('c0000000-0000-0000-0000-000000000001',
       'admin@tripleaconstrucciones.com.co',
       '$2b$12$10T6cxORZf5tVhdsbuVRlOMfzyj3JwrxlGCEIKIYrxwwj0E1IJ6HS',
       'Administrador', 'Sistema', '3001234567',
       'ACTIVO', true, 0, NOW(), NOW()),
      ('c0000000-0000-0000-0000-000000000002',
       'gerencia@tripleaconstrucciones.com.co',
       '$2b$12$9uqloFiWK7YaloVh3YbL..xXt/on.e9aCCPyt.uLqb27VpXMnKxXO',
       'Gerencia', 'Triple A', '3007654321',
       'ACTIVO', true, 0, NOW(), NOW()),
      ('c0000000-0000-0000-0000-000000000003',
       'comercial@tripleaconstrucciones.com.co',
       '$2b$12$.qlXeEK4iMu3ewGO/6V/r.HE0THhHC2C1ryrTFd7zIXdhvXmJLBJ6',
       'Asesor', 'Comercial', '3009876543',
       'ACTIVO', true, 0, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      estado = 'ACTIVO',
      verificado = true,
      intentos_fallidos = 0,
      updated_at = NOW();
    """)

    # Ensure roles exist
    op.execute("""
    INSERT INTO roles (id, nombre, descripcion, activo, created_at, updated_at) VALUES
      ('a0000000-0000-0000-0000-000000000001', 'ADMIN',    'Administrador con acceso total al sistema',  true, NOW(), NOW()),
      ('a0000000-0000-0000-0000-000000000002', 'GERENCIA', 'Gerencia: aprueba cotizaciones y contratos', true, NOW(), NOW()),
      ('a0000000-0000-0000-0000-000000000003', 'VENDEDOR', 'Comercial: crea y edita cotizaciones',       true, NOW(), NOW())
    ON CONFLICT (nombre) DO NOTHING;
    """)

    # Ensure user-role assignments exist
    op.execute("""
    INSERT INTO usuario_rol (id, usuario_id, rol_id, created_at) VALUES
      (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NOW()),
      (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NOW()),
      (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', NOW())
    ON CONFLICT ON CONSTRAINT uq_usuario_rol_unique DO NOTHING;
    """)


def downgrade() -> None:
    pass
