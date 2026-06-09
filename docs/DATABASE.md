# Database Documentation

## Overview

The Cotizaciones application uses PostgreSQL as its primary data store. This document describes the database schema, relationships, and key design decisions.

## Database Connection

**Environment Variables:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/cotizaciones
```

**Connection Details:**
- Host: PostgreSQL server (localhost in dev, managed service in production)
- Port: 5432 (default PostgreSQL port)
- Database: `cotizaciones`
- SSL: Required in production, optional in development

## Core Tables

### Users

Stores user account information and authentication credentials.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

---

### Projects

Represents client projects for which quotations are created.

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
```

---

### Quotations

Main entity storing quote/quotation documents.

```sql
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,
    tax_amount DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'draft',
    valid_until DATE,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotations_project_id ON quotations(project_id);
CREATE INDEX idx_quotations_created_by ON quotations(created_by);
CREATE INDEX idx_quotations_status ON quotations(status);
```

---

### Quotation Items

Detailed line items within each quotation.

```sql
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);
```

---

## Schema Relationships

```
users (owns)
  ├── projects (user_id FK)
  │   └── quotations (project_id FK)
  │       └── quotation_items (quotation_id FK, cascade delete)
  └── quotations (created_by FK)
```

---

## Data Types & Considerations

### UUIDs vs Sequential IDs
- **Choice:** UUID (gen_random_uuid())
- **Reason:** Better for distributed systems, privacy, merge-friendly
- **Trade-off:** Larger storage

### Numeric Types for Money
- **Choice:** DECIMAL(12, 2)
- **Reason:** Exact decimal representation, no floating-point errors

### Timestamps with Time Zone
- **Choice:** `TIMESTAMP WITH TIME ZONE`
- **Reason:** Always store in UTC, handle timezone conversions in application
- **Default:** CURRENT_TIMESTAMP (server time in UTC)

---

## Migrations

Managed with Alembic (SQLAlchemy migration tool).

### Creating a Migration

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add new field to users"

# Review and edit the generated migration
vim backend/alembic/versions/001_add_new_field.py

# Test migration locally
alembic upgrade head
```

### Rollback

```bash
# Downgrade to previous version
alembic downgrade -1
```

---

## Backup & Recovery

### Development
```bash
# Backup local database
pg_dump postgresql://user:password@localhost:5432/cotizaciones > backup.sql

# Restore from backup
psql postgresql://user:password@localhost:5432/cotizaciones < backup.sql
```

### Production (Render)
- Automated daily backups
- 14-day retention
- Point-in-time recovery available

---

## Performance Tuning

### Query Optimization

```sql
-- Efficient: Use index on user_id
SELECT * FROM projects WHERE user_id = 'uuid' LIMIT 10;

-- Inefficient: Sorting on non-indexed column with large dataset
SELECT * FROM quotations WHERE status = 'sent' 
ORDER BY notes LIMIT 10; -- Add index if this is common
```

### Connection Pooling

Production PostgreSQL connections are pooled (limited resource).

```python
# SQLAlchemy pool configuration
engine = create_async_engine(
    DATABASE_URL,
    poolclass=NullPool,
    pool_recycle=3600,
)
```

---

## Security

### Data Protection

1. **Encryption at Rest:** Database host encryption (Render-managed)
2. **Encryption in Transit:** SSL/TLS connections
3. **Access Control:** Database user with minimal required privileges

### Sensitive Data

**Passwords:**
- Never stored in plain text
- Bcrypt hashing with salt
- Never logged or displayed

---

## Maintenance

### Regular Tasks

```sql
-- Update table statistics (run weekly)
ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('cotizaciones'));

-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan = 0; -- Unused indexes
```

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system design
- [SECURITY.md](./SECURITY.md) - Security considerations
