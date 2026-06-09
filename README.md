# GDM — Sistema de Gestión de Cotizaciones

Aplicación web full-stack para la gestión integral de cotizaciones empresariales. Permite crear, editar, consultar y eliminar cotizaciones, administrar clientes y productos, y visualizar estadísticas en un dashboard.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + Recharts |
| Backend | Node.js + Express + Knex.js |
| Base de datos | PostgreSQL 16 |
| Autenticación | JWT (JSON Web Tokens) |
| Hosting | Render.com |
| CI/CD | GitHub Actions |

---

## Funcionalidades

- **Autenticación**: login con JWT, roles (admin / vendedor / viewer)
- **Dashboard**: estadísticas, gráficos de barras y dona por estado y mes
- **Cotizaciones**: CRUD completo, numeración automática (COT-YYYY-XXXX), cálculo automático de subtotales, IVA y descuentos
- **Clientes**: gestión completa con datos fiscales colombianos (NIT, CC, etc.)
- **Productos**: catálogo con precios, IVA y categorías
- **Usuarios**: administración de acceso (solo admin)
- **Filtros y paginación** en listados
- **Interfaz responsiva** para móvil, tablet y escritorio

---

## Estructura del proyecto

```
Cotizaciones/
├── backend/
│   ├── src/
│   │   ├── config/          # DB y logger
│   │   ├── controllers/     # Lógica de peticiones
│   │   ├── middleware/      # Auth, validación, errores
│   │   ├── routes/          # Endpoints Express
│   │   └── services/        # Lógica de negocio
│   ├── migrations/          # Esquema de base de datos
│   ├── seeds/               # Datos iniciales
│   ├── tests/
│   │   ├── unit/            # Tests unitarios
│   │   └── integration/     # Tests de integración
│   └── server.js
├── frontend/
│   └── src/
│       ├── components/      # Componentes reutilizables
│       ├── pages/           # Vistas principales
│       ├── services/        # Cliente API (Axios)
│       ├── store/           # Estado global (Zustand)
│       ├── tests/           # Tests con Vitest
│       └── utils/           # Helpers (formato, etc.)
├── .github/workflows/       # CI/CD con GitHub Actions
├── render.yaml              # Configuración de despliegue
└── README.md
```

---

## Instalación local

### Requisitos previos

- Node.js 20+
- PostgreSQL 14+
- npm o yarn

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/cotizaciones.git
cd cotizaciones
```

### 2. Configurar el backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
```

Variables necesarias en `backend/.env`:
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/cotizaciones_db
JWT_SECRET=tu_clave_secreta_muy_larga
FRONTEND_URL=http://localhost:5173
```

```bash
# Instalar dependencias
npm install

# Crear la base de datos (en psql)
createdb cotizaciones_db

# Ejecutar migraciones
npm run migrate

# Poblar con datos iniciales
npm run seed

# Iniciar servidor de desarrollo
npm run dev
```

El servidor estará disponible en: `http://localhost:4000`

### 3. Configurar el frontend

```bash
cd ../frontend
npm install
```

Crear `frontend/.env.local`:
```
VITE_API_URL=http://localhost:4000/api
```

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:5173`

---

## API REST

### Autenticación

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Iniciar sesión | No |
| GET | `/api/auth/me` | Usuario actual | Sí |
| PATCH | `/api/auth/change-password` | Cambiar contraseña | Sí |
| POST | `/api/auth/register` | Crear usuario | Admin |

### Cotizaciones

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/quotes` | Listar cotizaciones | Sí |
| POST | `/api/quotes` | Crear cotización | Sí |
| GET | `/api/quotes/stats` | Estadísticas | Sí |
| GET | `/api/quotes/:id` | Ver cotización | Sí |
| PUT | `/api/quotes/:id` | Actualizar | Sí |
| DELETE | `/api/quotes/:id` | Eliminar | Admin |

Parámetros de filtro para `GET /api/quotes`:
- `page`, `limit` — paginación
- `status` — filtrar por estado
- `search` — buscar en número o nombre de cliente
- `client_id` — filtrar por cliente

### Clientes, Productos y Usuarios

Todos con CRUD estándar: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`

---

## Pruebas

```bash
# Backend (Jest)
cd backend
npm test
npm run test:coverage

# Frontend (Vitest)
cd frontend
npm test
npm run test:coverage
```

---

## Despliegue en Render

### Configuración automática con render.yaml

El archivo `render.yaml` en la raíz define:
- **Web Service** para el backend Node.js
- **Static Site** para el frontend React
- **PostgreSQL** gestionado

### Pasos para desplegar

1. **Crear cuenta** en [render.com](https://render.com)
2. **Conectar tu repositorio de GitHub**
3. En el dashboard de Render: **New > Blueprint** y seleccionar el repositorio
4. Render detectará el `render.yaml` y creará automáticamente los 3 servicios
5. Agregar el **Deploy Hook URL** como secreto en GitHub (`RENDER_DEPLOY_HOOK_URL`) para despliegue continuo

### Variables de entorno en Render

El `render.yaml` configura automáticamente:
- `DATABASE_URL` — inyectada desde la base de datos PostgreSQL de Render
- `JWT_SECRET` — generada automáticamente por Render
- `FRONTEND_URL` — URL del servicio frontend
- `VITE_API_URL` — URL del API backend

### CI/CD con GitHub Actions

El pipeline en `.github/workflows/ci.yml` ejecuta automáticamente:
1. Tests del backend (con PostgreSQL efímero)
2. Tests del frontend + build de producción
3. Deploy a Render (solo en rama `main`)

---

## Credenciales de demo

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| Administrador | admin@empresa.com | Admin123! | admin |
| Vendedor Demo | vendedor@empresa.com | Vendedor1! | vendedor |

---

## Seguridad implementada

- **Helmet.js** — cabeceras HTTP seguras
- **Rate limiting** — máximo 200 peticiones / 15 min por IP
- **CORS** — solo el dominio del frontend autorizado
- **Bcrypt** — hash de contraseñas con salt rounds=10
- **JWT** — tokens con expiración configurable
- **Joi** — validación estricta de todos los inputs
- **Roles** — admin / vendedor / viewer con permisos diferenciados
- **SSL** — conexión PostgreSQL con SSL en producción

---

## Licencia

MIT © GDM 2024
