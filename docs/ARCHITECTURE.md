# Architecture Documentation

## Overview

The Cotizaciones application is built using a modern three-tier architecture with clear separation of concerns between frontend, backend, and data layers.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Layer                                │
│              React + TypeScript + Tailwind CSS                   │
│         (Vite for bundling, SWR for data fetching)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (HTTP/REST)
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Backend)                            │
│              FastAPI + Python (async/await)                      │
│         (JWT authentication, role-based access control)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (SQL)
┌─────────────────────────────────────────────────────────────────┐
│                   Data Layer (Database)                           │
│              PostgreSQL with Alembic migrations                   │
│         (Relational schema with proper normalization)            │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### 1. Presentation Layer (Frontend)

**Technology Stack:**
- **Framework:** React 18 with TypeScript
- **Bundler:** Vite (fast build tool)
- **Styling:** Tailwind CSS with PostCSS
- **Data Fetching:** SWR (stale-while-revalidate)
- **Build Output:** Static assets deployed to CDN/static host

**Key Components:**
- `src/pages/` - Page components for routing
- `src/components/` - Reusable UI components
- `src/hooks/` - Custom React hooks
- `src/services/` - API client functions
- `src/types/` - TypeScript type definitions
- `src/styles/` - Global styles and Tailwind configuration

**Design Patterns:**
- **Component Composition:** Small, single-responsibility components
- **Hooks Pattern:** Custom hooks for logic reusability
- **Service Layer:** Centralized API calls
- **Type Safety:** Full TypeScript coverage

---

### 2. Application Layer (Backend)

**Technology Stack:**
- **Framework:** FastAPI (Python 3.11+)
- **Async:** Built-in async/await support
- **ORM:** SQLAlchemy 2.0 with async support
- **Migrations:** Alembic
- **Validation:** Pydantic v2
- **Authentication:** JWT tokens
- **Password Hashing:** bcrypt

**Design Patterns:**

**1. Service Layer Pattern:**
- Separation between API endpoints and business logic
- Services contain domain logic, validation, and transformations
- Easier to test and reuse logic

**2. Dependency Injection:**
- FastAPI's dependency system for database sessions, auth, etc.
- Loose coupling between components
- Easier testing with mocks

**3. Async/Await Pattern:**
- Non-blocking I/O for database and external API calls
- Better scalability and resource utilization

---

### 3. Data Layer (Database)

**Technology Stack:**
- **Database:** PostgreSQL 14+
- **ORM:** SQLAlchemy 2.0
- **Migrations:** Alembic
- **Connection Pooling:** asyncpg

**Key Features:**
- Foreign key constraints for referential integrity
- Indexes on frequently queried columns
- Timestamp columns for audit trails
- JSONB for flexible data storage

---

## Design Decisions

### 1. **REST API over GraphQL**
- **Why:** Simpler caching, better HTTP semantics, easier monitoring
- **Trade-off:** More endpoints for complex queries
- **Mitigation:** Proper pagination and filtering

### 2. **JWT Authentication**
- **Why:** Stateless, scalable, works with distributed systems
- **Trade-off:** No immediate token revocation
- **Security:** Tokens include expiration; HttpOnly cookies

### 3. **Async FastAPI**
- **Why:** Better concurrent connection handling, non-blocking I/O
- **Trade-off:** Requires async-compatible libraries
- **Benefit:** Handle 10K+ concurrent connections

### 4. **PostgreSQL**
- **Why:** ACID compliance, strong data integrity, extensions
- **Trade-off:** Operational overhead
- **Scaling:** Works well up to millions of rows

### 5. **Alembic for Migrations**
- **Why:** Version control for schema, reversible migrations
- **Process:** Generate, review, test, deploy
- **Safety:** Test migrations in staging first

---

## Security Architecture

### Authentication Flow

```
User Login
    ↓
Validate credentials (email + password)
    ↓
Generate JWT token (access + refresh)
    ↓
Return tokens (HttpOnly cookie + Authorization header)
    ↓
Subsequent requests include token
    ↓
Middleware validates token signature & expiration
    ↓
Extract user context from token claims
    ↓
Execute endpoint with authenticated user
```

### Authorization

- **Role-based Access Control (RBAC):** User, Admin roles
- **Dependency injection:** `@require_role("admin")`
- **Field-level:** Endpoints validate user ownership of resources

---

## Deployment Architecture

### Development
```
Docker Compose (3 services: db, backend, frontend)
```

### Production
```
Render.com deployment:
- PostgreSQL managed database
- Backend: Python FastAPI container
- Frontend: Static React build + CDN
- Environment: Separate configurations
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment steps.

---

## Testing Strategy

### Unit Tests
- Service layer logic
- Utility functions
- Validation schemas

### Integration Tests
- API endpoints with real database
- Authentication and authorization
- Cross-layer workflows

**Running Tests:**
```bash
# Backend
pytest backend/tests/ -v

# Frontend
npm run test
```

---

## Technologies at a Glance

| Layer | Component | Technology | Version |
|-------|-----------|-----------|---------|
| Frontend | Runtime | Node.js | 18+ |
| Frontend | Framework | React | 18 |
| Frontend | Language | TypeScript | 5+ |
| Frontend | Bundler | Vite | 5+ |
| Frontend | Styling | Tailwind CSS | 3+ |
| Backend | Runtime | Python | 3.11+ |
| Backend | Framework | FastAPI | 0.104+ |
| Backend | ORM | SQLAlchemy | 2.0+ |
| Backend | Migrations | Alembic | 1.13+ |
| Database | Engine | PostgreSQL | 14+ |
| Infrastructure | Containerization | Docker | 24+ |
| Infrastructure | Deployment | Render.com | - |
| CI/CD | Automation | GitHub Actions | - |

---

## Related Documentation

- [DATABASE.md](./DATABASE.md) - Database schema and design
- [SECURITY.md](./SECURITY.md) - Security considerations and best practices
- [API.md](./API.md) - API documentation
