#!/bin/sh
set -e

echo "=== TRIPLE A CONSTRUCCIONES SAS ==="
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."

echo ">>> Migraciones..."
alembic upgrade head
echo ">>> Migraciones OK"

echo ">>> Iniciando uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
