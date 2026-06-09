# Deployment Guide

This guide covers deploying the Cotizaciones application to production using Render.com.

## Prerequisites

1. **Render Account:** [Sign up at Render.com](https://render.com)
2. **GitHub Repository:** Code must be pushed to GitHub
3. **Environment Variables:** Prepared list of secrets
4. **Docker Images:** Built and ready

---

## Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Code reviewed and merged to main branch
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Security checklist completed
- [ ] Backup/recovery plan in place

---

## Deployment Architecture

### Production Stack

```
┌─────────────────────────────────────────────────┐
│         Render.com (Hosting Platform)            │
├─────────────────────────────────────────────────┤
│                                                  │
│  PostgreSQL Database (Managed)                  │
│    - Automated backups (14 days)                │
│    - SSL/TLS encryption                         │
│    - Connection pooling                         │
│                                                  │
│  Backend Service (Docker Container)            │
│    - Python FastAPI application                │
│    - Auto-scaling enabled                       │
│    - Health checks: /health                     │
│    - Logs: Render dashboard                     │
│                                                  │
│  Frontend Service (Static Site)                │
│    - React SPA build (npm run build)           │
│    - CDN with caching                          │
│    - Automatic deployments                      │
│    - Custom domain support                      │
│                                                  │
└─────────────────────────────────────────────────┘
        ↓ (HTTPS)           ↓ (HTTPS)
   ┌────────────┐       ┌─────────────┐
   │  Frontend  │       │   Backend   │
   │  (Client)  │       │   (API)     │
   └────────────┘       └─────────────┘
        ↓ (REST API)
   ┌─────────────────────────────────┐
   │   PostgreSQL Database            │
   └─────────────────────────────────┘
```

---

## Step 1: Prepare Render Configuration

### Create render.yaml

Located at project root: `/render.yaml`

```yaml
services:
  - type: pserv
    name: cotizaciones-db
    plan: standard
    ipAllowList: []
    postgresDatabaseName: cotizaciones
    postgresDatabaseUser: postgres
    postgresDatabaseVersion: 14

  - type: web
    name: cotizaciones-backend
    plan: standard
    runtime: python
    buildCommand: pip install -r backend/requirements.txt && alembic upgrade head
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port 8000
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: PYTHONUNBUFFERED
        value: "1"
      - key: DATABASE_URL
        fromDatabase:
          name: cotizaciones-db
          property: connectionString
      - key: SECRET_KEY
        sync: false
      - key: CORS_ORIGINS
        value: https://app.cotizaciones.com
    routes:
      - path: /api
        destination: /api

  - type: static_site
    name: cotizaciones-frontend
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    envVars:
      - key: VITE_API_URL
        value: https://api.cotizaciones.com
    routes:
      - path: /
        destination: /index.html
      - path: /{path}
        destination: /index.html
```

---

## Step 2: Environment Variables

### Set Production Secrets

Create environment variables in Render dashboard:

**Backend Secrets:**
```
DATABASE_URL=postgresql://postgres:PASSWORD@postgres.example.com/cotizaciones
SECRET_KEY=generate-secure-key-with-python-secrets-token_urlsafe-32
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
DEBUG=false
ENVIRONMENT=production
CORS_ORIGINS=https://app.cotizaciones.com,https://www.cotizaciones.com
PYTHONUNBUFFERED=1
```

**Frontend Environment:**
```
VITE_API_URL=https://api.cotizaciones.com
VITE_ENV=production
```

### Generate Secure Secret Key

```bash
# Run locally to generate
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Output: "E-mL_nJ9vK-pQ_rXsT_uVwXyZaBcDeF" (example)
# Copy to Render dashboard as SECRET_KEY
```

---

## Step 3: Deploy Database

### Create PostgreSQL Database Service

1. Go to Render dashboard → New → PostgreSQL Database
2. Configure:
   - **Name:** `cotizaciones-db`
   - **Database:** `cotizaciones`
   - **Region:** Select closest to users
   - **Backup:** Enable (14-day retention)
   - **SSL:** Enable (default)

3. Note the connection string:
   ```
   postgresql://postgres:PASSWORD@dpg-abc123def456.postgres.render.com:5432/cotizaciones
   ```

### Run Initial Migrations

```bash
# After database is created, run:
DATABASE_URL="postgresql://..." alembic upgrade head
```

### Verify Database

```bash
# Connect to verify:
psql postgresql://postgres:PASSWORD@dpg-abc123def456.postgres.render.com:5432/cotizaciones

# List tables
\dt

# Exit
\q
```

---

## Step 4: Deploy Backend

### Connect GitHub Repository

1. Go to Render dashboard → New → Web Service
2. Configure:
   - **Name:** `cotizaciones-backend`
   - **Repository:** Select your GitHub repo
   - **Branch:** `main`
   - **Runtime:** Python 3.11
   - **Build Command:** `pip install -r backend/requirements.txt && alembic upgrade head`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - **Region:** Same as database
   - **Plan:** Standard (or higher for more traffic)

### Set Environment Variables

Add all backend environment variables in the Render dashboard:
- `DATABASE_URL` (link to PostgreSQL service)
- `SECRET_KEY`
- `DEBUG=false`
- `CORS_ORIGINS=https://app.cotizaciones.com`
- etc.

### Deploy

1. Click "Deploy"
2. View logs in real-time
3. Wait for "Service is live" message

### Verify Deployment

```bash
# Check health endpoint
curl https://api.cotizaciones.com/health

# Expected response:
# {"status": "healthy", "timestamp": "2024-01-01T12:00:00Z"}

# Check API docs
https://api.cotizaciones.com/docs
```

---

## Step 5: Deploy Frontend

### Connect GitHub Repository

1. Go to Render dashboard → New → Static Site
2. Configure:
   - **Name:** `cotizaciones-frontend`
   - **Repository:** Select your GitHub repo
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

### Set Environment Variables

- `VITE_API_URL=https://api.cotizaciones.com`

### Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Access frontend at assigned domain

### Custom Domain

1. Go to Settings → Domains
2. Add custom domain: `app.cotizaciones.com`
3. Follow DNS configuration instructions

---

## Step 6: Setup CI/CD Pipeline

### GitHub Actions Workflows

See `.github/workflows/` for automated:
- Testing on pull requests
- Building Docker images
- Deploying to Render on main branch merge

### Trigger Automatic Deployment

Push to main branch:
```bash
git push origin main
```

Render automatically:
1. Builds the application
2. Runs migrations
3. Deploys to production
4. Health checks new deployment

---

## Monitoring & Logs

### View Logs

**Render Dashboard:**
1. Service → Logs tab
2. Filter by service (backend/frontend/database)
3. Real-time streaming or historical

**Command Line (if using Render CLI):**
```bash
render logs --service=cotizaciones-backend
```

### Key Metrics

Monitor in Render dashboard:
- **CPU Usage:** Should stay <80%
- **Memory:** Should stay <80% of allocated
- **Disk:** Database should have >20% free space
- **HTTP Errors:** 4xx and 5xx rates
- **Response Times:** API latency

### Set Up Alerts (Optional)

Configure in Render:
- High CPU usage
- High error rate
- Service restart frequency

---

## Database Backup & Recovery

### Automated Backups

Render automatically backs up PostgreSQL:
- **Frequency:** Daily
- **Retention:** 14 days
- **Location:** Encrypted in secure storage

### Manual Backup

```bash
# Backup database to file
pg_dump postgresql://postgres:PASSWORD@host/cotizaciones > backup.sql

# Restore from backup
psql postgresql://postgres:PASSWORD@host/cotizaciones < backup.sql
```

### Restore from Backup

1. Go to PostgreSQL service → Backups tab
2. Select backup date
3. Click "Restore"
4. Render creates new database from backup

---

## Scaling

### Vertical Scaling (More Resources)

1. Go to Service → Instance Type
2. Upgrade plan (Standard → Pro, etc.)
3. Changes take effect after redeploy

### Horizontal Scaling

Not directly supported by Render. Alternatives:
- Upgrade to larger instance
- Use load balancer (manual setup)
- Consider Kubernetes hosting (AWS ECS, etc.)

### Database Connection Pooling

Already configured in FastAPI for optimal resource usage:
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_recycle=3600,
)
```

---

## Troubleshooting

### Application Won't Deploy

1. **Check logs:** Render dashboard → Logs tab
2. **Common issues:**
   - Missing environment variable
   - Build command fails
   - Database migration error
   - Port not listening on 0.0.0.0

### Database Connection Error

```bash
# Verify connection string
psql postgresql://user:password@host/db

# Check DATABASE_URL in Render dashboard
# Ensure database service is running
```

### CORS Issues

Check `CORS_ORIGINS` environment variable:
```
CORS_ORIGINS=https://app.cotizaciones.com,https://www.cotizaciones.com
```

### Health Check Failing

Backend health check must pass:
```bash
curl https://api.cotizaciones.com/health

# Should return 200 with: {"status": "healthy"}
```

### Rollback Deployment

1. Go to Service → Deployments tab
2. Select previous deployment
3. Click "Redeploy"

---

## Performance Optimization

### Frontend Optimization

- **CDN Caching:** Render provides global CDN
- **Gzip Compression:** Enabled by default
- **Code Splitting:** Vite automatically chunks code
- **Image Optimization:** Use WebP format

### Backend Optimization

- **Database Indexes:** Already configured
- **Query Caching:** Implement Redis layer (future)
- **API Response Caching:** Set Cache-Control headers
- **Connection Pooling:** Already configured

### Monitor Performance

```bash
# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.cotizaciones.com/health

# curl-format.txt:
# time_namelookup:  %{time_namelookup}s
# time_connect:     %{time_connect}s
# time_appconnect:  %{time_appconnect}s
# time_pretransfer: %{time_pretransfer}s
# time_redirect:    %{time_redirect}s
# time_starttransfer: %{time_starttransfer}s
# time_total:       %{time_total}s
```

---

## Security Checklist for Production

- [ ] HTTPS enabled and enforced (SSL/TLS)
- [ ] All environment variables set (no defaults)
- [ ] DEBUG=false
- [ ] SECRET_KEY is strong and unique
- [ ] Database backups enabled
- [ ] Rate limiting configured
- [ ] CORS origins whitelisted
- [ ] Security headers configured
- [ ] Logging and monitoring enabled
- [ ] Incident response plan documented

---

## Post-Deployment

### Verify Everything Works

1. **Frontend:** https://app.cotizaciones.com
2. **API Docs:** https://api.cotizaciones.com/docs
3. **Health Check:** https://api.cotizaciones.com/health
4. **Create Test User:** Sign up and verify login
5. **Create Test Quote:** Ensure database operations work

### Set Up Monitoring

- Configure alerting for errors and downtime
- Monitor error logs daily
- Review API performance metrics weekly

### Schedule Maintenance

- Weekly database analysis
- Monthly dependency updates
- Quarterly security audit
- Yearly disaster recovery drill

---

## Disaster Recovery

### Recovery Time Objective (RTO)
- Target: 1 hour to restore from backup

### Recovery Point Objective (RPO)
- Target: 1 day of data loss acceptable

### Procedures

1. **Database Failure:**
   - Restore from latest backup (Render → Backups tab)
   - Verify data integrity
   - Redeploy backend

2. **Backend Failure:**
   - Automatic redeploy from previous working commit
   - Manual: Git revert, push to main, redeploy

3. **Frontend Failure:**
   - Redeploy from backup commit
   - Render automatically rebuilds

4. **Complete Outage:**
   - Create new services
   - Restore database from backup
   - Redeploy backend and frontend
   - Update DNS to point to new services

---

## Related Documentation

- [SETUP.md](./SETUP.md) - Local development setup
- [SECURITY.md](./SECURITY.md) - Security considerations
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
