# Local Setup Guide

This guide will help you set up the Cotizaciones project locally using Docker Compose.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker:** [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Docker Compose:** Included with Docker Desktop
- **Git:** [Download Git](https://git-scm.com/)
- **Node.js 18+:** (Optional, for running frontend without Docker)
- **Python 3.11+:** (Optional, for running backend without Docker)

### Verify Installation

```bash
# Check Docker
docker --version
# Docker version 24.0.0 or higher

# Check Docker Compose
docker compose version
# Docker Compose version v2.20.0 or higher

# Check Git
git --version
# git version 2.40.0 or higher
```

---

## Quick Start with Docker Compose

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Cotizaciones
```

### 2. Set Up Environment Variables

Create `.env` file in the project root with necessary configuration:

```bash
# Backend
BACKEND_PORT=8000
DATABASE_URL=postgresql://user:password@db:5432/cotizaciones
SECRET_KEY=your-secret-key-change-in-production
DEBUG=false
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:8000
```

See `.env.example` files in `backend/` and `frontend/` directories for more options.

### 3. Start All Services

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Verify all services are running
docker compose ps
```

Expected output:
```
NAME                COMMAND             STATUS            PORTS
cotizaciones-db     postgres...         Up 2 minutes      5432/tcp
cotizaciones-backend  python app/main... Up 1 minute      0.0.0.0:8000->8000/tcp
cotizaciones-frontend  node -r vite...   Up 30 seconds    0.0.0.0:5173->5173/tcp
```

### 4. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs (Swagger UI)
- **Database:** localhost:5432 (PostgreSQL)

### 5. Run Database Migrations

```bash
# Connect to backend container
docker compose exec backend bash

# Run migrations
alembic upgrade head

# Exit container
exit
```

### 6. Seed Sample Data (Optional)

```bash
# Inside backend container
python -c "
from app.database.session import get_session
from app.database.models import User, Project
# Add seeding logic here
"
```

---

## Manual Setup (Without Docker)

### Backend Setup

#### 1. Python Environment

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### 2. Database Setup

```bash
# Start PostgreSQL (using Homebrew on macOS)
brew services start postgresql@14

# Create database and user
createuser -P cotizaciones_user  # Set password when prompted
createdb -U cotizaciones_user cotizaciones

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://cotizaciones_user:password@localhost:5432/cotizaciones
```

#### 3. Run Migrations

```bash
# From backend directory
alembic upgrade head
```

#### 4. Start Backend Server

```bash
# From backend directory
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend running at: http://localhost:8000

### Frontend Setup

#### 1. Install Dependencies

```bash
cd frontend
npm install
```

#### 2. Environment Variables

Create `.env.local`:
```
VITE_API_URL=http://localhost:8000
```

#### 3. Start Development Server

```bash
npm run dev
```

Frontend running at: http://localhost:5173

---

## Development Workflow

### Working with the Backend

```bash
# Enter backend container
docker compose exec backend bash

# Run tests
pytest tests/ -v

# Run linting
flake8 app/

# Format code
black app/

# Exit container
exit
```

### Working with the Frontend

```bash
# Enter frontend container
docker compose exec frontend bash

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format

# Exit container
exit
```

### Database Management

```bash
# Connect to database
docker compose exec db psql -U user -d cotizaciones

# Common SQL commands:
# List tables: \dt
# Show schema: \d <table_name>
# List databases: \l
# Exit: \q
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Last 100 lines
docker compose logs --tail=100 backend
```

---

## Troubleshooting

### Docker Compose Won't Start

```bash
# Check for port conflicts
lsof -i :8000  # Backend port
lsof -i :5173  # Frontend port
lsof -i :5432  # Database port

# If ports are in use, either:
# 1. Stop the conflicting service
# 2. Change ports in docker-compose.yml
```

### Database Connection Error

```bash
# Check database is running
docker compose ps db

# Check database logs
docker compose logs db

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Test connection manually
docker compose exec backend python -c "
from sqlalchemy import create_engine
engine = create_engine('$DATABASE_URL')
conn = engine.connect()
print('Connected!')
"
```

### Frontend Can't Connect to Backend

```bash
# Check VITE_API_URL in .env.local or .env
cat frontend/.env.local

# Check backend is running
docker compose logs backend

# Test API connectivity
curl http://localhost:8000/health
```

### Clear Everything and Start Fresh

```bash
# Stop all containers
docker compose down

# Remove volumes (warning: deletes database data)
docker compose down -v

# Rebuild images
docker compose build --no-cache

# Start fresh
docker compose up -d
```

---

## Environment Variables Reference

### Backend (backend/.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cotizaciones

# FastAPI
SECRET_KEY=your-secret-key-min-32-chars-recommended
DEBUG=true  # false in production
ENVIRONMENT=development  # development, staging, production

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# JWT
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Server
HOST=0.0.0.0
PORT=8000
```

### Frontend (frontend/.env.local)

```bash
# API
VITE_API_URL=http://localhost:8000

# Environment
VITE_ENV=development
```

---

## Next Steps

1. **Read the Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Understand Database:** [DATABASE.md](./DATABASE.md)
3. **Review API Documentation:** [API.md](./API.md)
4. **Learn About Security:** [SECURITY.md](./SECURITY.md)
5. **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Common Commands Quick Reference

```bash
# Start/Stop Services
docker compose up -d        # Start all services
docker compose down         # Stop all services
docker compose restart      # Restart services

# Logs
docker compose logs -f backend

# Database
docker compose exec db psql -U user -d cotizaciones

# Tests
docker compose exec backend pytest tests/ -v
docker compose exec frontend npm test

# Cleanup
docker compose down -v      # Remove everything including data
docker volume ls            # List volumes
docker volume rm <volume>   # Remove specific volume
```

---

## Getting Help

- **API Documentation:** http://localhost:8000/docs
- **Backend README:** [backend/README.md](../backend/README.md)
- **Frontend README:** [frontend/README.md](../frontend/README.md)
- **Issues:** Check GitHub Issues or create a new issue
