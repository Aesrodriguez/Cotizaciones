# Security Documentation

## Overview

This document outlines the security architecture, best practices, and considerations for the Cotizaciones application.

---

## Authentication

### JWT (JSON Web Tokens)

Authentication is implemented using JWT tokens for stateless, scalable authentication.

#### Token Structure

```
Header.Payload.Signature

Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiaWF0IjoxNjk5Njc5NzA3LCJleHAiOjE2OTk3NjYxMDd9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Header (Algorithm & Type):**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Claims):**
```json
{
  "sub": "user-id-uuid",
  "email": "user@example.com",
  "role": "user",
  "iat": 1699679707,
  "exp": 1699766107
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  SECRET_KEY
)
```

#### Token Lifecycle

```
User Login
    ↓
1. POST /api/v1/auth/login
   Body: { email, password }
    ↓
2. Server validates email & password
3. Server generates JWT tokens:
   - Access Token (short-lived, 24 hours)
   - Refresh Token (long-lived, 7 days)
    ↓
4. Return tokens in response:
   - Access token: Authorization header
   - Refresh token: HttpOnly cookie
    ↓
5. Client stores access token (in memory or secure storage)
    ↓
6. Subsequent requests include:
   Authorization: Bearer <access_token>
    ↓
7. Server validates token:
   - Signature verification
   - Expiration check
   - User still active
    ↓
8. If valid: Extract user context, execute request
   If invalid: Return 401 Unauthorized
    ↓
9. Token expiration:
   - Client receives 401 response
   - Client sends refresh token to POST /api/v1/auth/refresh
   - Server validates refresh token
   - Server issues new access token
   - Client retries original request
```

#### Configuration

```python
# backend/app/config.py
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24  # Access token
JWT_REFRESH_EXPIRATION_DAYS = 7  # Refresh token
JWT_SECRET_KEY = os.getenv("SECRET_KEY")  # Min 32 characters

# Generate secure secret:
# python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### Best Practices

1. **Secret Key Management**
   - Minimum 32 characters
   - Use cryptographically secure random generation
   - Store in environment variables (never in code)
   - Rotate periodically (weekly or monthly)
   - Different keys for dev/staging/production

2. **Token Storage**
   - **Access Token:** In-memory (JavaScript) or Authorization header
   - **Refresh Token:** HttpOnly, Secure cookies (immune to XSS)
   - **Never store tokens in localStorage** (vulnerable to XSS)

3. **Token Transmission**
   - Always use HTTPS/TLS
   - Include token in `Authorization: Bearer <token>` header
   - Never include token in URL query parameters

4. **Token Expiration**
   - Access tokens: Short-lived (1-24 hours)
   - Refresh tokens: Long-lived (7-30 days)
   - Force re-authentication on sensitive operations (password change, delete account)

---

## Password Security

### Hashing

Passwords are hashed using bcrypt with automatic salt generation.

```python
# backend/app/auth/password.py
import bcrypt

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)  # 12 rounds = ~0.3 seconds
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode(), password_hash.encode())
```

#### Bcrypt Details

- **Algorithm:** Blowfish cipher
- **Rounds:** 12 (good balance between security and performance)
- **Salt:** Automatically generated, included in hash
- **Output:** 60-character hash

#### Password Requirements

```python
# Minimum requirements for new passwords:
PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIRE_UPPERCASE = True
PASSWORD_REQUIRE_LOWERCASE = True
PASSWORD_REQUIRE_NUMBERS = True
PASSWORD_REQUIRE_SPECIAL = False

# Example: "MySecurePass123"
```

#### Password Reset Flow

```
1. User requests password reset: POST /api/v1/auth/forgot-password
2. Server checks if user exists
3. Server generates reset token (short-lived, 15 minutes)
4. Server sends reset link via email: https://app.com/reset?token=xyz
5. User clicks link and sets new password
6. Server validates reset token
7. Server hashes new password
8. Server invalidates all existing sessions
9. User logs in with new password
```

---

## CORS (Cross-Origin Resource Sharing)

### Configuration

```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Local dev
        "http://localhost:3000",      # Alternative dev port
        "https://app.cotizaciones.com",  # Production
    ],
    allow_credentials=True,           # Allow cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)
```

### CORS Flow

```
Browser Request (preflight)
    ↓
OPTIONS /api/v1/users
Origin: http://localhost:5173
    ↓
Server Response
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
    ↓
Browser allows request if origin matches
    ↓
Actual Request (GET, POST, etc.)
```

### CORS Best Practices

1. **Whitelist Origins:** Only allow trusted domains
   - Development: localhost:5173, localhost:3000
   - Production: app.cotizaciones.com
   - Never use `allow_origins=["*"]` for credentials

2. **Credentialed Requests**
   - `allow_credentials=True` when sending cookies/auth headers
   - Client must use `credentials: "include"` in fetch calls

3. **Preflight Caching**
   - Set `max_age` for preflight results (5-24 hours)
   - Reduces OPTIONS requests

---

## HTTPS/TLS

### Requirements

- **All Production Traffic:** HTTPS only
- **Certificate:** Let's Encrypt (free) or commercial CA
- **Protocol:** TLS 1.2 or higher

### Headers for Security

```python
# Configured in FastAPI/nginx
# Strict-Transport-Security: Forces HTTPS for 1 year
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Prevent MIME type sniffing
X-Content-Type-Options: nosniff

# Prevent clickjacking
X-Frame-Options: SAMEORIGIN

# Enable XSS protection
X-XSS-Protection: 1; mode=block

# Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

---

## Data Protection

### Encryption at Rest

- **Database:** Managed by hosting provider (Render)
- **Backups:** Encrypted by default
- **Sensitive Fields:** Consider application-level encryption for PII

### Encryption in Transit

- **Database Connections:** SSL/TLS (connection string: postgresql://user:pass@host/db?sslmode=require)
- **API Calls:** HTTPS only
- **Cookies:** Secure and HttpOnly flags

---

## Input Validation & Sanitization

### Request Validation

All incoming data is validated using Pydantic schemas:

```python
# backend/app/database/schemas.py
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr  # Validates email format
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)

    class Config:
        validate_assignment = True

# Usage in endpoint
@app.post("/users")
async def create_user(user: UserCreate):
    # Pydantic automatically validates input
    # Invalid data returns 422 Unprocessable Entity
    pass
```

### SQL Injection Prevention

- **SQLAlchemy ORM:** Parameterized queries (prevents SQL injection)
- **No string concatenation:** Always use ORM methods

```python
# ✅ Safe (using ORM)
user = db.query(User).filter(User.email == email).first()

# ❌ Unsafe (don't do this!)
user = db.query(f"SELECT * FROM users WHERE email = '{email}'")
```

### XSS Prevention

- **React:** Automatic escaping in JSX
- **API:** Return JSON (not HTML)
- **CSP Headers:** Restrict script sources

### CSRF Prevention

- **Tokens:** Generated for state-changing requests
- **SameSite Cookies:** Set SameSite=Strict for session cookies

---

## Error Handling

### Secure Error Messages

**Development (DEBUG=true):**
```json
{
  "detail": "UNIQUE constraint failed: users.email",
  "traceback": "... full stack trace ..."
}
```

**Production (DEBUG=false):**
```json
{
  "detail": "An error occurred. Please try again later."
}
```

### HTTP Status Codes

```python
# Don't leak information through status codes
# ❌ Return 404 for both "user not found" and "email already exists"
# ✅ Return 422 with generic message for all validation errors
```

---

## Rate Limiting

### Implementation

```python
# backend/app/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/users")
@limiter.limit("5/minute")  # 5 requests per minute
async def create_user(user: UserCreate):
    pass
```

### Protection Against

- **Brute Force Attacks:** Limit login attempts (5/minute)
- **API Abuse:** Limit general endpoints (100/minute)
- **DDoS:** IP-based rate limiting

---

## Dependency Security

### Vulnerability Scanning

```bash
# Check for vulnerable dependencies
pip-audit  # Python
npm audit  # JavaScript

# Update dependencies
pip install --upgrade pip
npm audit fix
```

### Best Practices

1. **Regular Updates:** Check for security updates weekly
2. **Automated Scanning:** Use Dependabot (GitHub)
3. **Lock Files:** Commit package-lock.json and requirements.txt
4. **Minimal Dependencies:** Only include necessary packages

---

## Access Control

### Role-Based Access Control (RBAC)

```python
# backend/app/auth/dependencies.py

async def require_role(required_role: str):
    async def check_role(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return check_role

# Usage
@app.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_role("admin"))
):
    # Only admins can delete users
    pass
```

### Resource Ownership

```python
# ✅ Good: Check user owns the resource
@app.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return project
```

---

## Audit Logging

### What to Log

- User login/logout events
- Failed authentication attempts
- Sensitive data modifications (quotations sent, accepted)
- Admin actions (user deletion, role changes)
- API errors (400+ status codes)

### What NOT to Log

- Passwords or password hashes
- Credit card numbers
- API tokens
- Personally identifiable information (PII)

### Implementation

```python
# backend/app/utils/logger.py
import logging
import json

logger = logging.getLogger(__name__)

def log_user_login(user_id: str, email: str):
    logger.info(json.dumps({
        "event": "user_login",
        "user_id": user_id,
        "email": email,
        "timestamp": datetime.now().isoformat()
    }))

def log_quotation_sent(quotation_id: str, sent_by: str):
    logger.info(json.dumps({
        "event": "quotation_sent",
        "quotation_id": quotation_id,
        "sent_by": sent_by,
        "timestamp": datetime.now().isoformat()
    }))
```

---

## Security Checklist

### Before Deployment

- [ ] Change SECRET_KEY from default value
- [ ] Set DEBUG=false
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS with specific origins
- [ ] Set up rate limiting
- [ ] Enable security headers (HSTS, CSP, etc.)
- [ ] Configure password policy
- [ ] Test authentication flows
- [ ] Audit logging enabled
- [ ] Database backups configured

### Regular Maintenance

- [ ] Review and rotate SECRET_KEY monthly
- [ ] Update dependencies (security patches)
- [ ] Review audit logs for suspicious activity
- [ ] Test backup and recovery procedures
- [ ] Penetration testing (quarterly)

---

## Common Vulnerabilities & Mitigations

| Vulnerability | Example | Mitigation |
|---|---|---|
| SQL Injection | `SELECT * FROM users WHERE id = '{id}'` | Use ORM, parameterized queries |
| XSS | `<script>alert('XSS')</script>` | React escaping, CSP headers |
| CSRF | Unauthorized form submission | CSRF tokens, SameSite cookies |
| Brute Force | Multiple failed login attempts | Rate limiting, account lockout |
| Weak Passwords | "password123" | Password policy, validation |
| Exposed Secrets | API keys in code | Environment variables |
| Unencrypted Transmission | HTTP without TLS | HTTPS only, TLS 1.2+ |
| Privilege Escalation | User becomes admin | RBAC, ownership checks |

---

## Incident Response

### Security Incident Steps

1. **Identify:** Detect and confirm the security issue
2. **Contain:** Stop the attack (disable accounts, etc.)
3. **Eradicate:** Remove the threat (patch vulnerability)
4. **Recover:** Restore normal operations
5. **Post-Mortem:** Document and prevent recurrence

### Contact Information

- **Security Team:** security@company.com
- **Incident Reporting:** Create confidential GitHub issue
- **Emergency:** Phone number (if applicable)

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system design
- [DATABASE.md](./DATABASE.md) - Database security considerations
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment security
