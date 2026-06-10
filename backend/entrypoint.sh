#!/bin/sh
set -e

echo "=== TRIPLE A CONSTRUCCIONES SAS ==="
echo "PORT: ${PORT:-8000}"

echo ">>> Ejecutando migraciones..."
alembic upgrade head
echo ">>> Migraciones completadas"

echo ">>> Iniciando uvicorn en puerto ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
