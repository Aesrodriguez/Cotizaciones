# Triplaa Cotizaciones Database Schema

## Overview
PostgreSQL database schema for the Cotizaciones (Quotes) management system. Designed to handle user management, quotations, products, contracts, budgets (APU), expenses, and audit logging.

## Architecture Decisions

### 1. Timestamps
- All tables include `created_at` and `updated_at` fields (UTC timezone)
- `updated_at` automatically updated via PostgreSQL trigger
- Enables tracking of data changes for audit purposes

### 2. Soft Deletes
- Uses `deleted_at` nullable timestamp for soft deletes instead of hard deletes
- Allows data recovery and maintains referential integrity
- Queries must filter `WHERE deleted_at IS NULL` by default

### 3. UUIDs
- Primary keys use UUID v4 for:
  - Better horizontal scalability
  - Security through non-sequential IDs
  - Cross-datacenter synchronization readiness

### 4. Indexing Strategy
- Composite indexes on frequently joined foreign keys
- Indexes on search/filter columns (email, code, status)
- BTREE indexes for equality and range queries
- Partial indexes for soft-deleted records where needed

### 5. Partitioning
- `cotizacion_historial` table partitioned by DATE (monthly) for large datasets
- `audit_log` partitioned by DATE (monthly) for archival purposes
- Improves query performance and maintenance operations

---

## Tables

### 1. **usuarios** (Users)
Core user management and authentication.

```
id (UUID) - PRIMARY KEY
email (VARCHAR 255) - UNIQUE, NOT NULL
password_hash (VARCHAR 255) - NOT NULL
nombres (VARCHAR 100) - NOT NULL
apellidos (VARCHAR 100) - NOT NULL
telefono (VARCHAR 20)
estado (ENUM) - ACTIVE, INACTIVE, SUSPENDED - DEFAULT: ACTIVE
ultimo_login (TIMESTAMP)
intentos_fallidos (INT) - DEFAULT: 0
bloqueado_hasta (TIMESTAMP)
verificado (BOOLEAN) - DEFAULT: FALSE
verificacion_token (VARCHAR)
created_at (TIMESTAMP) - DEFAULT: NOW()
updated_at (TIMESTAMP) - DEFAULT: NOW()
deleted_at (TIMESTAMP)

INDEXES:
  - email (UNIQUE)
  - estado
  - deleted_at (partial)

CONSTRAINTS:
  - email format validated
  - password_hash not empty
```

### 2. **roles** (User Roles)
Predefined roles for authorization.

```
id (UUID) - PRIMARY KEY
nombre (VARCHAR 50) - UNIQUE, NOT NULL
descripcion (TEXT)
activo (BOOLEAN) - DEFAULT: TRUE
created_at (TIMESTAMP)
updated_at (TIMESTAMP)

PREDEFINED ROLES:
  - Administrador: Full system access
  - Gerencia: Management and approval permissions
  - Contabilidad: Financial and expense management
  - Comercial: Sales and customer management
  - Ingeniero: Technical and APU management
  - Consulta: Read-only access

INDEXES:
  - nombre (UNIQUE)
```

### 3. **permisos** (Permissions)
Fine-grained permissions for role-based access control.

```
id (UUID) - PRIMARY KEY
codigo (VARCHAR 100) - UNIQUE, NOT NULL
descripcion (VARCHAR 255)
recurso (VARCHAR 50) - Entity type (usuarios, cotizaciones, etc.)
accion (VARCHAR 50) - Action type (crear, leer, editar, eliminar)
activo (BOOLEAN) - DEFAULT: TRUE
created_at (TIMESTAMP)

INDEXES:
  - codigo (UNIQUE)
  - recurso
  - (recurso, accion)
```

### 4. **rol_permiso** (Role-Permission Mapping)
M:N relationship between roles and permissions.

```
id (UUID) - PRIMARY KEY
rol_id (UUID) - FK → roles.id, NOT NULL
permiso_id (UUID) - FK → permisos.id, NOT NULL
created_at (TIMESTAMP)

CONSTRAINTS:
  - (rol_id, permiso_id) UNIQUE
  - CASCADE DELETE on both FKs

INDEXES:
  - rol_id
  - permiso_id
```

### 5. **usuario_rol** (User-Role Mapping)
M:N relationship between users and roles.

```
id (UUID) - PRIMARY KEY
usuario_id (UUID) - FK → usuarios.id, NOT NULL
rol_id (UUID) - FK → roles.id, NOT NULL
created_at (TIMESTAMP)

CONSTRAINTS:
  - (usuario_id, rol_id) UNIQUE
  - CASCADE DELETE on user_id FK
  - RESTRICT DELETE on role_id FK

INDEXES:
  - usuario_id
  - rol_id
```

### 6. **clientes** (Customers)
Customer/client information and contact details.

```
id (UUID) - PRIMARY KEY
codigo (VARCHAR 50) - UNIQUE, NOT NULL
nombre (VARCHAR 255) - NOT NULL
rut (VARCHAR 20) - UNIQUE
giro (VARCHAR 255) - Business type
contacto_nombre (VARCHAR 100)
contacto_email (VARCHAR 255)
contacto_telefono (VARCHAR 20)
direccion (VARCHAR 255)
ciudad (VARCHAR 100)
provincia (VARCHAR 100)
pais (VARCHAR 100)
condiciones_pago (VARCHAR 50) - Payment terms
dias_credito (INT)
limite_credito (DECIMAL 15,2)
estado (ENUM) - ACTIVO, INACTIVO - DEFAULT: ACTIVO
notas (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - codigo (UNIQUE)
  - rut (UNIQUE)
  - estado
  - deleted_at (partial)
  - (nombre)
```

### 7. **productos** (Products/Items)
Product catalog for quotes and contracts.

```
id (UUID) - PRIMARY KEY
codigo (VARCHAR 50) - UNIQUE, NOT NULL
nombre (VARCHAR 255) - NOT NULL
descripcion (TEXT)
unidad_medida (VARCHAR 20) - unit of measure (kg, m3, hrs, etc.)
precio_unitario (DECIMAL 15,2) - NOT NULL
precio_actualizado_en (TIMESTAMP)
categoria (VARCHAR 100)
margen_default (DECIMAL 5,2) - Default margin percentage
estado (ENUM) - ACTIVO, INACTIVO - DEFAULT: ACTIVO
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - codigo (UNIQUE)
  - categoria
  - estado
  - deleted_at (partial)
```

### 8. **cotizaciones** (Quotes/Quotations)
Main quotation records.

```
id (UUID) - PRIMARY KEY
numero (VARCHAR 50) - UNIQUE, NOT NULL
cliente_id (UUID) - FK → clientes.id, NOT NULL
usuario_id (UUID) - FK → usuarios.id, NOT NULL (creator)
titulo (VARCHAR 255) - NOT NULL
descripcion (TEXT)
fecha_emision (DATE) - NOT NULL
fecha_vencimiento (DATE)
estado (ENUM) - BORRADOR, PENDIENTE, ACEPTADA, RECHAZADA, CANCELADA - DEFAULT: BORRADOR
moneda (CHAR 3) - USD, CLP, etc. - DEFAULT: USD
subtotal (DECIMAL 15,2) - Total before tax
impuesto (DECIMAL 15,2) - Tax amount
descuento (DECIMAL 15,2) - Discount amount
total (DECIMAL 15,2) - Final total
validez_dias (INT) - Quote validity in days
condiciones_pago (VARCHAR 255)
terminos (TEXT) - General terms and conditions
observaciones (TEXT)
aprobado_por_id (UUID) - FK → usuarios.id (approver)
aprobado_en (TIMESTAMP)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - numero (UNIQUE)
  - cliente_id
  - usuario_id
  - estado
  - fecha_emision
  - (estado, cliente_id)
  - deleted_at (partial)
```

### 9. **cotizacion_items** (Quote Line Items)
Individual line items within quotations.

```
id (UUID) - PRIMARY KEY
cotizacion_id (UUID) - FK → cotizaciones.id, NOT NULL
producto_id (UUID) - FK → productos.id, NOT NULL
descripcion (VARCHAR 255) - Item description (can override product name)
cantidad (DECIMAL 12,4) - NOT NULL
precio_unitario (DECIMAL 15,2) - NOT NULL
descuento_porcentaje (DECIMAL 5,2) - Discount percentage
descuento_monto (DECIMAL 15,2) - Discount amount
impuesto_porcentaje (DECIMAL 5,2) - Tax percentage
impuesto_monto (DECIMAL 15,2) - Tax amount
subtotal (DECIMAL 15,2) - cantidad * precio_unitario - descuento_monto
total (DECIMAL 15,2) - Subtotal + tax
orden (INT) - Line item order
created_at (TIMESTAMP)
updated_at (TIMESTAMP)

INDEXES:
  - cotizacion_id
  - producto_id
  - (cotizacion_id, orden)

CONSTRAINTS:
  - CASCADE DELETE on cotizacion_id FK
```

### 10. **cotizacion_calculos** (Quote Calculations)
Audit trail of quote calculations and modifications.

```
id (UUID) - PRIMARY KEY
cotizacion_id (UUID) - FK → cotizaciones.id, NOT NULL
tipo_calculo (VARCHAR 50) - SUBTOTAL, IMPUESTO, DESCUENTO, TOTAL
valores_anteriores (JSONB) - Previous calculation values
valores_nuevos (JSONB) - New calculation values
usuario_id (UUID) - FK → usuarios.id (who made the change)
razon_cambio (TEXT)
created_at (TIMESTAMP)

INDEXES:
  - cotizacion_id
  - tipo_calculo

CONSTRAINTS:
  - CASCADE DELETE on cotizacion_id FK
```

### 11. **cotizacion_historial** (Quote History - PARTITIONED)
Tracks all changes to quotations. **PARTITIONED BY MONTH**.

```
id (UUID) - PRIMARY KEY
cotizacion_id (UUID) - FK → cotizaciones.id, NOT NULL
cambio (TEXT) - Description of change
valores_anteriores (JSONB) - Previous values
valores_nuevos (JSONB) - New values
usuario_id (UUID) - FK → usuarios.id (who made the change)
creado_en (TIMESTAMP) - PARTITION KEY
created_at (TIMESTAMP)

INDEXES:
  - cotizacion_id
  - usuario_id
  - (cotizacion_id, creado_en)

CONSTRAINTS:
  - CASCADE DELETE on cotizacion_id FK
```

### 12. **contratos** (Contracts)
Service and supply contracts.

```
id (UUID) - PRIMARY KEY
numero (VARCHAR 50) - UNIQUE, NOT NULL
cliente_id (UUID) - FK → clientes.id, NOT NULL
cotizacion_id (UUID) - FK → cotizaciones.id
usuario_id (UUID) - FK → usuarios.id (creator)
titulo (VARCHAR 255) - NOT NULL
descripcion (TEXT)
fecha_inicio (DATE) - NOT NULL
fecha_termino (DATE)
estado (ENUM) - VIGENTE, COMPLETADO, CANCELADO, SUSPENDIDO - DEFAULT: VIGENTE
monto_total (DECIMAL 15,2)
moneda (CHAR 3)
tipo (VARCHAR 50) - COMPRAVENTA, SERVICIOS, MANTENIMIENTO, etc.
responsable_id (UUID) - FK → usuarios.id (responsible person)
archivo_contrato (VARCHAR 255) - File path to contract document
terminos (TEXT) - Contract terms
observaciones (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - numero (UNIQUE)
  - cliente_id
  - estado
  - fecha_inicio
  - deleted_at (partial)
```

### 13. **apu** (Presupuestos de Análisis de Precios Unitarios)
Unit Price Analysis - detailed cost breakdown for products/services.

```
id (UUID) - PRIMARY KEY
codigo (VARCHAR 50) - UNIQUE, NOT NULL
nombre (VARCHAR 255) - NOT NULL
descripcion (TEXT)
unidad_medida (VARCHAR 20) - NOT NULL
precio_unitario (DECIMAL 15,2)
rendimiento (DECIMAL 12,4) - Productivity rate
estado (ENUM) - ACTIVO, INACTIVO - DEFAULT: ACTIVO
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - codigo (UNIQUE)
  - estado
  - deleted_at (partial)
```

### 14. **apu_materiales** (APU Materials)
Materials component of APU.

```
id (UUID) - PRIMARY KEY
apu_id (UUID) - FK → apu.id, NOT NULL
codigo (VARCHAR 50) - NOT NULL
nombre (VARCHAR 255) - NOT NULL
cantidad (DECIMAL 12,4) - NOT NULL
unidad (VARCHAR 20) - NOT NULL
precio_unitario (DECIMAL 15,2) - NOT NULL
porcentaje_desperdicio (DECIMAL 5,2)
subtotal (DECIMAL 15,2)
orden (INT)
created_at (TIMESTAMP)

INDEXES:
  - apu_id
  - (apu_id, orden)

CONSTRAINTS:
  - CASCADE DELETE on apu_id FK
```

### 15. **apu_mano_obra** (APU Labor)
Labor component of APU.

```
id (UUID) - PRIMARY KEY
apu_id (UUID) - FK → apu.id, NOT NULL
codigo (VARCHAR 50) - NOT NULL
descripcion (VARCHAR 255) - NOT NULL
cantidad (DECIMAL 12,4) - NOT NULL (hours or units)
unidad (VARCHAR 20) - NOT NULL (e.g., horas, dias)
precio_unitario (DECIMAL 15,2) - NOT NULL
subtotal (DECIMAL 15,2)
orden (INT)
created_at (TIMESTAMP)

INDEXES:
  - apu_id
  - (apu_id, orden)

CONSTRAINTS:
  - CASCADE DELETE on apu_id FK
```

### 16. **apu_equipos** (APU Equipment)
Equipment component of APU.

```
id (UUID) - PRIMARY KEY
apu_id (UUID) - FK → apu.id, NOT NULL
codigo (VARCHAR 50) - NOT NULL
descripcion (VARCHAR 255) - NOT NULL
cantidad (DECIMAL 12,4) - NOT NULL
unidad (VARCHAR 20) - NOT NULL
precio_unitario (DECIMAL 15,2) - NOT NULL
subtotal (DECIMAL 15,2)
orden (INT)
created_at (TIMESTAMP)

INDEXES:
  - apu_id
  - (apu_id, orden)

CONSTRAINTS:
  - CASCADE DELETE on apu_id FK
```

### 17. **gastos** (Expenses)
Expense tracking and management.

```
id (UUID) - PRIMARY KEY
numero (VARCHAR 50) - UNIQUE, NOT NULL
usuario_id (UUID) - FK → usuarios.id (creator)
contrato_id (UUID) - FK → contratos.id
tipo (VARCHAR 50) - MATERIAL, MANO_OBRA, EQUIPOS, OTROS
descripcion (VARCHAR 255) - NOT NULL
monto (DECIMAL 15,2) - NOT NULL
moneda (CHAR 3)
fecha_gasto (DATE) - NOT NULL
estado (ENUM) - PENDIENTE, APROBADO, RECHAZADO - DEFAULT: PENDIENTE
aprobado_por_id (UUID) - FK → usuarios.id (approver)
aprobado_en (TIMESTAMP)
comprobante (VARCHAR 255) - Receipt/proof file path
centro_costo (VARCHAR 50)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - numero (UNIQUE)
  - usuario_id
  - contrato_id
  - estado
  - fecha_gasto
  - deleted_at (partial)
```

### 18. **trabajadores** (Workers/Employees)
Worker/employee information.

```
id (UUID) - PRIMARY KEY
codigo (VARCHAR 50) - UNIQUE, NOT NULL
nombres (VARCHAR 100) - NOT NULL
apellidos (VARCHAR 100) - NOT NULL
rut (VARCHAR 20) - UNIQUE
email (VARCHAR 255)
telefono (VARCHAR 20)
direccion (VARCHAR 255)
ciudad (VARCHAR 100)
cargo (VARCHAR 100)
tipo_contrato (VARCHAR 50) - PERMANENTE, TEMPORAL, SUBCONTRATISTA
salario_diario (DECIMAL 15,2)
estado (ENUM) - ACTIVO, INACTIVO, LICENCIA - DEFAULT: ACTIVO
fecha_ingreso (DATE)
fecha_termino (DATE)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)

INDEXES:
  - codigo (UNIQUE)
  - rut (UNIQUE)
  - estado
  - deleted_at (partial)
```

### 19. **trabajador_pagos** (Worker Payments)
Payment records for workers.

```
id (UUID) - PRIMARY KEY
trabajador_id (UUID) - FK → trabajadores.id, NOT NULL
periodo (DATE) - Payment period (first day of month)
fecha_pago (DATE) - Payment date
cantidad_dias (DECIMAL 5,2) - Days worked
monto_bruto (DECIMAL 15,2) - Gross amount
descuentos (DECIMAL 15,2) - Deductions
monto_neto (DECIMAL 15,2) - Net amount
estado (ENUM) - PENDIENTE, PAGADO, ANULADO - DEFAULT: PENDIENTE
referencia (VARCHAR 100) - Payment reference/check number
created_at (TIMESTAMP)
updated_at (TIMESTAMP)

INDEXES:
  - trabajador_id
  - (trabajador_id, periodo)
  - estado
```

### 20. **audit_log** (Audit Log - PARTITIONED)
System audit trail for all changes. **PARTITIONED BY MONTH**.

```
id (UUID) - PRIMARY KEY
usuario_id (UUID) - FK → usuarios.id
tabla_afectada (VARCHAR 100) - Table name
operacion (VARCHAR 10) - INSERT, UPDATE, DELETE
registro_id (UUID) - ID of affected record
datos_anteriores (JSONB) - Previous values
datos_nuevos (JSONB) - New values
ip_address (INET)
user_agent (VARCHAR 500)
creado_en (TIMESTAMP) - PARTITION KEY
created_at (TIMESTAMP)

INDEXES:
  - usuario_id
  - tabla_afectada
  - (tabla_afectada, operacion)
  - (tabla_afectada, registro_id)
  - (usuario_id, creado_en)
```

### 21. **notificaciones** (Notifications)
User notifications and alerts.

```
id (UUID) - PRIMARY KEY
usuario_id (UUID) - FK → usuarios.id, NOT NULL
tipo (VARCHAR 50) - COTIZACION, CONTRATO, GASTO, SISTEMA
titulo (VARCHAR 255)
mensaje (TEXT) - NOT NULL
referencia_id (UUID) - ID of related record
referencia_tipo (VARCHAR 50) - Related record type
leida (BOOLEAN) - DEFAULT: FALSE
leida_en (TIMESTAMP)
created_at (TIMESTAMP)

INDEXES:
  - usuario_id
  - (usuario_id, leida)
  - created_at DESC
```

### 22. **parametros_sistema** (System Parameters)
Configuration parameters.

```
id (UUID) - PRIMARY KEY
clave (VARCHAR 100) - UNIQUE, NOT NULL
valor (VARCHAR 500)
tipo (VARCHAR 20) - STRING, INT, DECIMAL, BOOLEAN, JSON
descripcion (TEXT)
actualizado_en (TIMESTAMP)
actualizado_por_id (UUID) - FK → usuarios.id

INDEXES:
  - clave (UNIQUE)
```

### 23. **secuencias** (Document Sequences)
Manages sequence numbers for documents.

```
id (UUID) - PRIMARY KEY
tipo_documento (VARCHAR 50) - COTIZACION, CONTRATO, GASTO, etc. - UNIQUE
proximo_numero (INT) - NOT NULL
prefijo (VARCHAR 10)
sufijo (VARCHAR 10)
formato (VARCHAR 50) - Format pattern
anio_inicio (INT)
reiniciar_anualmente (BOOLEAN) - DEFAULT: FALSE
created_at (TIMESTAMP)
updated_at (TIMESTAMP)

INDEXES:
  - tipo_documento (UNIQUE)
```

---

## Relationships

### One-to-Many (1:N)
- `usuarios` → `cotizaciones` (user creates quotations)
- `usuarios` → `cotizaciones.aprobado_por` (user approves quotations)
- `clientes` → `cotizaciones` (customer has multiple quotes)
- `clientes` → `contratos` (customer has multiple contracts)
- `cotizaciones` → `cotizacion_items` (quote has multiple line items)
- `cotizaciones` → `cotizacion_calculos` (quote has calculation history)
- `cotizaciones` → `cotizacion_historial` (quote has full change history)
- `cotizaciones` → `contratos` (quote generates contract)
- `productos` → `cotizacion_items` (product appears in quotes)
- `apu` → `apu_materiales` (APU has material components)
- `apu` → `apu_mano_obra` (APU has labor components)
- `apu` → `apu_equipos` (APU has equipment components)
- `contratos` → `gastos` (contract has expenses)
- `trabajadores` → `trabajador_pagos` (worker has payment records)
- `usuarios` → `audit_log` (user performs system actions)

### Many-to-Many (M:N)
- `roles` ↔ `permisos` via `rol_permiso`
- `usuarios` ↔ `roles` via `usuario_rol`

---

## Constraints & Validation

### Foreign Key Constraints
- All FKs use CASCADE DELETE for hierarchical data (items, components)
- Use RESTRICT for reference data (roles, permissions) to prevent accidental deletion
- Use SET NULL for optional FKs (approver, responsible person)

### Unique Constraints
- `usuarios.email` - Unique across all users
- `clientes.codigo`, `clientes.rut` - Unique customer identifiers
- `productos.codigo` - Unique product code
- `cotizaciones.numero` - Unique quote number
- `contratos.numero` - Unique contract number
- `gastos.numero` - Unique expense number
- `trabajadores.codigo`, `trabajadores.rut` - Unique worker identifiers
- `apu.codigo` - Unique APU code
- `permisos.codigo` - Unique permission code
- `roles.nombre` - Unique role name
- `secuencias.tipo_documento` - One sequence per document type

### Check Constraints
- `cotizacion_items.cantidad > 0`
- `cotizacion_items.precio_unitario >= 0`
- `apu_materiales.cantidad > 0`
- `trabajador_pagos.cantidad_dias > 0`
- `trabajador_pagos.monto_neto <= monto_bruto`
- `gastos.monto >= 0`
- `usuarios.intentos_fallidos >= 0`

---

## Partitioning Strategy

### `cotizacion_historial` - Monthly Partition
```sql
PARTITION BY RANGE (DATE_TRUNC('month', creado_en))
- Improves query performance for time-based filtering
- Simplifies archival of old data
- Enables faster deletion of old records
```

### `audit_log` - Monthly Partition
```sql
PARTITION BY RANGE (DATE_TRUNC('month', creado_en))
- Same benefits as above
- Supports compliance and data retention policies
- Enables archive storage of old logs
```

---

## Performance Considerations

### Indexes
- Composite indexes on frequently joined columns
- Partial indexes for soft-deleted records:
  ```sql
  CREATE INDEX idx_usuarios_deleted_at 
  ON usuarios (deleted_at) 
  WHERE deleted_at IS NULL;
  ```
- Indexes on sort columns in common queries

### Query Optimization
- Use `deleted_at IS NULL` filter for active records
- Join on indexed foreign keys
- Use `EXPLAIN ANALYZE` for slow queries
- Consider materialized views for complex aggregations

### Maintenance
- Regular VACUUM and ANALYZE on partitioned tables
- Archive old partitions after retention period
- Monitor table bloat and plan cluster operations

---

## Security Considerations

### Audit Trail
- `audit_log` captures all changes with user context
- `cotizacion_historial` tracks quote-specific changes
- `audit_log.ip_address` and `user_agent` enable forensics

### Data Isolation
- Soft deletes prevent data loss but maintain audit trail
- Role-based access control via `usuario_rol` and `rol_permiso`

### Sensitive Data
- `usuarios.password_hash` stored as hash only (never plain text)
- No sensitive data in `audit_log.datos_anteriores/nuevos` by policy

---

## Initialization & Seeding

### Default Roles
1. **Administrador** - Full system access
2. **Gerencia** - Manage contracts, view all quotes
3. **Contabilidad** - Manage expenses and payments
4. **Comercial** - Create quotes, manage customers
5. **Ingeniero** - Create/edit APUs and products
6. **Consulta** - Read-only access to all data

### Default Admin User
```
email: admin@triplaa.com
password: changeme123 (must be changed on first login)
roles: Administrador
```

### Sample Data
- 3-5 sample customers
- 10-15 sample products with APU details
- 2-3 sample quotes
- 5-10 sample workers

---

## Migration Strategy

### Version Control
- All schema changes via Alembic migrations
- One migration per logical change
- `alembic/versions/` contains all migration files

### Workflow
1. Create model changes in `app/models/`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review and test migration
4. Apply migration: `alembic upgrade head`

### Rollback
- `alembic downgrade -1` - Roll back one migration
- `alembic downgrade <revision>` - Roll back to specific revision
