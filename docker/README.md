# Docker Configuration for Cotizaciones

This directory contains Docker Compose configurations for running the Cotizaciones application in development and production environments.

## Directory Structure

```
docker/
├── docker-compose.yml          # Development configuration
├── docker-compose.prod.yml     # Production configuration
├── nginx.conf                  # Nginx reverse proxy configuration (production)
├── init-db.sql                 # Database initialization script
├── .dockerignore                # Files to exclude from Docker builds
├── .env.example                 # Environment variables template
└── README.md                    # This file
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Ports 5432, 8000, 5173 available (development)
- Ports 80, 443, 5432 available (production)

## Development Environment

### Quick Start

1. **Navigate to the docker directory:**
   ```bash
   cd docker
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Check service status:**
   ```bash
   docker-compose ps
   ```

5. **View logs:**
   ```bash
   docker-compose logs -f
   ```

### Services

| Service    | Port | URL | Purpose |
|------------|------|-----|---------|
| PostgreSQL | 5432 | - | Database |
| Backend    | 8000 | http://localhost:8000 | FastAPI application |
| Frontend   | 5173 | http://localhost:5173 | Vite dev server |

### Useful Commands

**Stop services:**
```bash
docker-compose down
```

**Remove volumes (reset database):**
```bash
docker-compose down -v
```

**View database:**
```bash
docker-compose exec postgres psql -U cotizaciones -d cotizaciones_db
```

**Run backend tests:**
```bash
docker-compose exec backend pytest
```

**Install new backend dependencies:**
```bash
docker-compose exec backend pip install <package_name>
```

**Install new frontend dependencies:**
```bash
docker-compose exec frontend npm install <package_name>
```

**Rebuild images:**
```bash
docker-compose build --no-cache
```

**Check service health:**
```bash
docker-compose exec postgres pg_isready
docker-compose exec backend curl http://localhost:8000/health
docker-compose exec frontend wget -q -O- http://localhost:5173/
```

## Production Environment

### Prerequisites for Production

1. **SSL Certificates:** Place your SSL certificates in:
   - `./ssl/cert.pem` - Certificate file
   - `./ssl/key.pem` - Private key file

2. **Environment Variables:** Create a `.env` file with production values:
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

### Deployment

1. **Build production images:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Verify deployment:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

### Production Features

- **Gunicorn** for backend with 4 workers
- **Nginx** reverse proxy with SSL/TLS
- **Resource limits** for all services
- **Health checks** for auto-recovery
- **Logging** with rotation (10MB max, 3 files)
- **Database persistence** with backup directory
- **No code volumes** for security

### Backup & Recovery

#### Automatic Backups

Create a backup script at `docker/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

docker-compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U cotizaciones cotizaciones_db \
    > "$BACKUP_FILE"

gzip "$BACKUP_FILE"
echo "Backup completed: $BACKUP_FILE.gz"
```

#### Manual Backup

```bash
cd docker
docker-compose -f docker-compose.prod.yml exec postgres \
    pg_dump -U cotizaciones cotizaciones_db > backup_manual.sql
```

#### Restore from Backup

```bash
cd docker
docker-compose -f docker-compose.prod.yml exec -T postgres \
    psql -U cotizaciones cotizaciones_db < backup_manual.sql
```

#### Schedule with Cron

Add to crontab for daily backups at 2 AM:
```bash
0 2 * * * cd /path/to/docker && bash backup.sh
```

### Monitoring

**View logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

**View specific service logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
```

**Monitor resource usage:**
```bash
docker stats
```

### Common Tasks

**Update backend code:**
```bash
docker-compose -f docker-compose.prod.yml build backend
docker-compose -f docker-compose.prod.yml up -d backend
```

**Update frontend code:**
```bash
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
docker-compose -f docker-compose.prod.yml restart nginx
```

**Access database:**
```bash
docker-compose -f docker-compose.prod.yml exec postgres \
    psql -U cotizaciones -d cotizaciones_db
```

**Restart all services:**
```bash
docker-compose -f docker-compose.prod.yml restart
```

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

### PostgreSQL
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password (CHANGE IN PRODUCTION!)
- `POSTGRES_DB` - Database name

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `ENVIRONMENT` - development or production
- `DEBUG` - Enable debug mode
- `LOG_LEVEL` - Logging level (debug, info, warning, error)
- `JWT_SECRET` - JWT signing secret (CHANGE IN PRODUCTION!)
- `CORS_ORIGINS` - Comma-separated allowed origins

### Frontend
- `VITE_API_URL` - Backend API URL

## Troubleshooting

### Containers won't start

```bash
# Check logs
docker-compose logs

# Verify ports are not in use
lsof -i :5432
lsof -i :8000
lsof -i :5173
```

### Database connection errors

```bash
# Test database connection
docker-compose exec backend python -c \
    "import psycopg2; psycopg2.connect('postgresql://cotizaciones:dev_password@postgres:5432/cotizaciones_db')"
```

### Frontend can't reach backend

```bash
# Check backend is running
docker-compose exec frontend curl http://backend:8000/health

# Verify CORS settings
docker-compose logs backend | grep -i cors
```

### Out of disk space

```bash
# Clean up volumes
docker volume prune

# Remove dangling images
docker image prune -a
```

## Security Considerations

### Development
- Uses development defaults for quick setup
- Debug mode enabled
- Default passwords (CHANGE if exposed)
- CORS allows localhost

### Production
- Debug mode disabled
- Resource limits enforced
- Non-root user in containers
- Health checks for auto-recovery
- SSL/TLS required
- Logging with rotation
- No code volumes mounted

### Best Practices

1. **Always change default passwords** in production
2. **Use strong JWT secrets** - minimum 32 characters
3. **Keep SSL certificates updated**
4. **Regular database backups** (automated recommended)
5. **Monitor resource usage** and adjust limits as needed
6. **Update base images regularly** for security patches
7. **Use environment variables** for sensitive data
8. **Never commit .env files** to version control

## Performance Tuning

### PostgreSQL
- Adjust `shared_buffers` in production (typically 25% of RAM)
- Monitor slow queries with `log_statement = 'all'`
- Use connection pooling for high-traffic scenarios

### Backend
- Increase workers with `--workers` flag in gunicorn command
- Adjust timeout values based on workload
- Monitor response times in logs

### Frontend
- Enable gzip compression (configured in nginx)
- Use production build for deployment
- Implement caching strategies

## Support & Documentation

- Backend: See `../backend/README.md`
- Frontend: See `../frontend/README.md`
- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL: https://www.postgresql.org/docs/
- FastAPI: https://fastapi.tiangolo.com/
- Vite: https://vitejs.dev/
