# Database Setup Guide

## Overview

This guide covers database initialization, migrations, and seeding for the Triplaa Cotizaciones system.

## Database Configuration

### Prerequisites

- PostgreSQL 12+
- Python 3.9+
- Dependencies installed: `pip install -r requirements.txt`

### Environment Variables

Set the following environment variables:

```bash
# Database connection string
DATABASE_URL=postgresql://user:password@localhost:5432/triplaa_db

# Optional: Enable SQL query logging (verbose)
DATABASE_ECHO=false
```

## Migrations

Alembic is used for database version control.

### Running Migrations

```bash
# Upgrade to latest migration
python3 -m alembic upgrade head

# Downgrade to previous migration
python3 -m alembic downgrade -1

# Show current revision
python3 -m alembic current

# Show migration history
python3 -m alembic history
```

### Creating New Migrations

After modifying models, create a new migration:

```bash
# Auto-generate migration from model changes
python3 -m alembic revision --autogenerate -m "Description of changes"

# Create empty migration for manual SQL
python3 -m alembic revision -m "Description"
```

## Schema Overview

The database contains 23 tables organized in the following modules:

### Authentication & Authorization
- **usuarios** - User accounts with credentials and verification status
- **roles** - Role definitions (Admin, Manager, etc.)
- **permisos** - Permission definitions
- **usuario_rol** - M:N relationship between users and roles
- **rol_permiso** - M:N relationship between roles and permissions

### Customers & Products
- **clientes** - Customer companies with contact information
- **productos** - Product catalog with pricing

### Quotations
- **cotizaciones** - Main quotation records
- **cotizacion_items** - Line items in quotations
- **cotizacion_calculos** - Calculation history (not used currently)
- **cotizacion_historial** - Audit trail of quotation changes

### Contracts
- **contratos** - Contracts derived from quotations
- **gastos** - Expenses charged to contracts
- **trabajadores** - Worker/employee records
- **trabajador_pagos** - Salary/payment records

### Cost Estimation (APU - Análisis de Precios Unitarios)
- **apu** - Unit price analysis records
- **apu_materiales** - Material components
- **apu_mano_obra** - Labor components
- **apu_equipos** - Equipment components

### System
- **audit_log** - Audit trail of all changes
- **notificaciones** - System notifications
- **parametros_sistema** - Configuration parameters
- **secuencias** - Document number sequences

## Data Types & Constraints

### UUIDs
All primary keys use UUID v4 for horizontal scalability and security.

### Soft Deletes
Records include a `deleted_at` timestamp for soft deletes rather than hard deletes, preserving audit trails.

### Timestamps
All tables include:
- `created_at` - Record creation time (auto-set, UTC)
- `updated_at` - Last modification time (auto-updated, UTC)
- `deleted_at` - Soft delete marker (NULL = active)

### Enums

PostgreSQL ENUM types used for status fields:

```
EstadoUsuario: ACTIVO, INACTIVO, SUSPENDIDO
EstadoCliente: ACTIVO, INACTIVO
EstadoProducto: ACTIVO, INACTIVO, DESCONTINUADO
EstadoCotizacion: BORRADOR, ENVIADA, ACEPTADA, RECHAZADA, CANCELADA
EstadoAPU: ACTIVO, INACTIVO
EstadoContrato: BORRADOR, ACTIVO, FINALIZADO, CANCELADO
TipoContrato: COMPRAVENTA, SERVICIOS, MANTENIMIENTO, OTROS
TipoTrabajador: PERMANENTE, TEMPORAL, SUBCONTRATISTA
EstadoGasto: PENDIENTE, APROBADO, RECHAZADO
TipoGasto: MATERIAL, MANO_OBRA, EQUIPOS, OTROS
```

## Seeding Data

After running migrations, populate the database with initial data:

```bash
# Run seed script
psql -U user -d triplaa_db -f database/seed.sql

# Or using Python
python3 backend/app/scripts/seed.py
```

## Indexing Strategy

Indexes are created on:

1. Foreign keys (automatic)
2. Status columns for filtering (`estado`)
3. Lookup columns (`codigo`, `email`, `rut`)
4. Soft delete filters (`deleted_at`)
5. Frequently sorted columns (`created_at`)

Partial indexes on soft-delete columns improve performance for active records:
```sql
CREATE INDEX idx_table_deleted_at ON table_name (deleted_at) 
WHERE deleted_at IS NOT NULL
```

## Backup & Recovery

### Backup
```bash
pg_dump -U user -d triplaa_db > backup.sql
```

### Restore
```bash
psql -U user -d triplaa_db < backup.sql
```

## Performance Considerations

1. **Connection Pooling**: Configure in production for better performance
2. **Partitioning**: Consider partitioning `cotizacion_historial` and `audit_log` by date for large datasets
3. **Archival**: Implement archival process for old records and historical data
4. **Vacuuming**: Run `VACUUM ANALYZE` regularly on large tables

## Troubleshooting

### Cannot Connect to Database
```bash
# Check PostgreSQL is running
ps aux | grep postgres

# Check connection string in DATABASE_URL
# Format: postgresql://[user]:[password]@[host]:[port]/[database]
```

### Migration Conflicts
```bash
# Check current migration state
python3 -m alembic current

# Downgrade to known state
python3 -m alembic downgrade base

# Re-apply migrations
python3 -m alembic upgrade head
```

### Permission Errors
Create database and user:
```sql
CREATE USER triplaa WITH PASSWORD 'secure_password';
CREATE DATABASE triplaa_db OWNER triplaa;
GRANT ALL PRIVILEGES ON DATABASE triplaa_db TO triplaa;
```
