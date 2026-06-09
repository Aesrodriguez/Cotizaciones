#!/bin/sh
set -e

echo "=== TRIPLE A CONSTRUCCIONES SAS - Iniciando API ==="
echo "DATABASE_URL prefix: $(echo $DATABASE_URL | cut -c1-15)..."
echo "Python: $(python --version 2>&1)"
echo "Alembic: $(alembic --version 2>&1)"

echo ""
echo ">>> Ejecutando migraciones Alembic..."
alembic upgrade head
echo ">>> Migraciones completadas exitosamente"

echo ""
echo ">>> Iniciando servidor FastAPI en puerto 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
