# Sistema de Cotizaciones — TRIPLE A CONSTRUCCIONES SAS

**NIT:** 901650581-4  
**Frontend:** https://cotizaciones-web.onrender.com  
**API:** https://cotizaciones-api-3uuy.onrender.com

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend API | Python 3.11 · FastAPI · SQLAlchemy 2.0 · Alembic |
| Base de datos | PostgreSQL 16 (Render managed) |
| Autenticación | JWT (access + refresh tokens) · bcrypt |
| Frontend | React 18 · TypeScript · Vite · TailwindCSS |
| Deploy | Render.com (render.yaml) |

---

## Usuarios del sistema

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@tripleaconstrucciones.com.co | TripleA2024 | ADMIN |
| gerencia@tripleaconstrucciones.com.co | Gerencia2024 | GERENCIA |
| comercial@tripleaconstrucciones.com.co | Comercial2024 | VENDEDOR |

---

## Estructura del proyecto

```
Cotizaciones/
├── backend/                # API FastAPI
│   ├── app/
│   │   ├── api/v1/         # Routers (auth, clientes, productos, cotizaciones)
│   │   ├── config/         # Settings con pydantic-settings
│   │   ├── models/         # SQLAlchemy ORM
│   │   ├── repositories/   # Capa de acceso a datos
│   │   ├── schemas/        # Validación Pydantic
│   │   └── services/       # Lógica de negocio
│   ├── alembic/            # Migraciones de base de datos
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── requirements.txt
├── frontend/               # React + TypeScript
│   └── src/
│       ├── pages/          # Páginas de la aplicación
│       ├── components/     # Componentes reutilizables
│       ├── services/       # Cliente Axios con refresh token automático
│       ├── stores/         # Estado global (Zustand)
│       └── types/          # Tipos TypeScript
└── render.yaml             # Configuración de despliegue
```

---

## Variables de entorno (backend)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (Render la provee automáticamente) |
| `SECRET_KEY` | Clave secreta JWT (Render genera automáticamente) |
| `ENVIRONMENT` | `production` o `development` |
| `CORS_ORIGINS` | Orígenes permitidos (JSON array) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración access token (default: 30) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Expiración refresh token (default: 7) |

---

## Endpoints principales

```
POST   /api/v1/auth/login           Iniciar sesión
POST   /api/v1/auth/refresh         Renovar access token
GET    /api/v1/auth/me              Usuario actual
POST   /api/v1/auth/register        Crear usuario (requiere ADMIN)
PATCH  /api/v1/auth/change-password Cambiar contraseña

GET    /api/v1/clientes             Listar clientes
POST   /api/v1/clientes             Crear cliente

GET    /api/v1/productos            Listar productos
POST   /api/v1/productos            Crear producto

GET    /api/v1/cotizaciones         Listar cotizaciones
POST   /api/v1/cotizaciones         Crear cotización
GET    /api/v1/cotizaciones/stats   Estadísticas del dashboard

GET    /health                      Estado del servidor
```

---

## Deploy en Render

El deploy es automático al hacer push a `main`:
1. Docker build del backend (capas cacheadas)
2. `alembic upgrade head` — migraciones automáticas
3. uvicorn inicia en el puerto asignado por Render
4. Vite compila el frontend como sitio estático
