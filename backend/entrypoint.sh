#!/bin/sh
set -e

echo "========================================"
echo "  TRIPLE A CONSTRUCCIONES SAS"
echo "  Sistema de Cotizaciones v1.0"
echo "========================================"
echo "Python : $(python --version 2>&1)"
echo "Puerto : ${PORT:-8000}"
echo "DB     : $(echo "${DATABASE_URL:-NO_CONFIG}" | cut -c1-25)..."
echo ""

echo ">>> Ejecutando migraciones Alembic..."
alembic upgrade head && echo ">>> Migraciones completadas" || {
    echo ">>> ADVERTENCIA: Migración con errores — continuando con el servidor..."
}
echo ""
echo ""

echo ">>> Iniciando servidor en puerto ${PORT:-8000}..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --log-level info \
  --no-access-log
