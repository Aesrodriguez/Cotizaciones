# API Documentation

This document provides an overview of the API structure and key endpoints. Detailed, auto-generated documentation is available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when the backend is running.

## Base URL

```
Development:  http://localhost:8000/api/v1
Production:   https://api.cotizaciones.com/api/v1
```

## Authentication

All endpoints (except login/signup) require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

## Response Format

All API responses follow a consistent JSON format:

### Success Response (2xx)
```json
{
  "data": { /* ... */ },
  "status": "success"
}
```

### Error Response (4xx, 5xx)
```json
{
  "detail": "Error message",
  "status": "error",
  "status_code": 400
}
```

## Core Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  },
  "tokens": {
    "access_token": "eyJ...",
    "token_type": "bearer"
  }
}
```

---

#### POST /auth/login
Authenticate user and receive JWT tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  }
}
```

---

#### POST /auth/refresh
Get a new access token using refresh token.

**Request:** (Token in cookie)

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

---

#### POST /auth/logout
Logout current user and invalidate tokens.

**Response:** HTTP 200 OK

---

### Users

#### GET /users/me
Get current user profile.

**Headers:** Authorization: Bearer token

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "created_at": "2024-01-01T12:00:00Z"
}
```

---

#### PUT /users/me
Update current user profile.

**Request:**
```json
{
  "full_name": "Jane Doe",
  "email": "newemail@example.com"
}
```

**Response:** Updated user object

---

#### POST /users/me/change-password
Change current user password.

**Request:**
```json
{
  "current_password": "OldPass123",
  "new_password": "NewPass456"
}
```

**Response:** HTTP 200 OK

---

### Projects

#### GET /projects
List user's projects with pagination.

**Query Parameters:**
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 10)
- `status`: Filter by status (active, completed, archived)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Website Redesign",
      "client_name": "Acme Corp",
      "status": "active",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 42,
  "skip": 0,
  "limit": 10
}
```

---

#### POST /projects
Create new project.

**Request:**
```json
{
  "name": "Website Redesign",
  "description": "Complete redesign of company website",
  "client_name": "Acme Corp",
  "client_email": "contact@acme.com",
  "start_date": "2024-01-15",
  "end_date": "2024-03-15"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Website Redesign",
  "client_name": "Acme Corp",
  "status": "active",
  "created_at": "2024-01-01T12:00:00Z"
}
```

---

#### GET /projects/{project_id}
Get project details.

**Response:**
```json
{
  "id": "uuid",
  "name": "Website Redesign",
  "description": "...",
  "client_name": "Acme Corp",
  "client_email": "contact@acme.com",
  "status": "active",
  "quotations_count": 5,
  "created_at": "2024-01-01T12:00:00Z"
}
```

---

#### PUT /projects/{project_id}
Update project.

**Request:**
```json
{
  "name": "Website Redesign - Phase 2",
  "status": "completed"
}
```

**Response:** Updated project object

---

#### DELETE /projects/{project_id}
Delete project (soft delete).

**Response:** HTTP 204 No Content

---

### Quotations

#### GET /quotations
List quotations with filters.

**Query Parameters:**
- `project_id`: Filter by project
- `status`: Filter by status (draft, sent, accepted, rejected)
- `skip`, `limit`: Pagination

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "quote_number": "QUOTE-2024-001",
      "title": "Website Redesign Quote",
      "total_amount": 5000.00,
      "status": "sent",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 10
}
```

---

#### POST /quotations
Create new quotation.

**Request:**
```json
{
  "project_id": "uuid",
  "title": "Website Redesign Quote",
  "description": "Professional website redesign services",
  "total_amount": 5000.00,
  "currency": "USD",
  "tax_rate": 21.00,
  "valid_until": "2024-02-01",
  "items": [
    {
      "description": "Design Services",
      "quantity": 1,
      "unit_price": 2500.00
    },
    {
      "description": "Development",
      "quantity": 1,
      "unit_price": 2500.00
    }
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "quote_number": "QUOTE-2024-001",
  "status": "draft",
  "total_amount": 5000.00,
  "tax_amount": 1050.00,
  "items": [ /* ... */ ],
  "created_at": "2024-01-01T12:00:00Z"
}
```

---

#### GET /quotations/{quotation_id}
Get quotation details.

**Response:**
```json
{
  "id": "uuid",
  "quote_number": "QUOTE-2024-001",
  "title": "Website Redesign Quote",
  "total_amount": 5000.00,
  "tax_amount": 1050.00,
  "currency": "USD",
  "status": "sent",
  "valid_until": "2024-02-01",
  "items": [
    {
      "id": "uuid",
      "description": "Design Services",
      "quantity": 1,
      "unit_price": 2500.00,
      "line_total": 2500.00
    },
    {
      "id": "uuid",
      "description": "Development",
      "quantity": 1,
      "unit_price": 2500.00,
      "line_total": 2500.00
    }
  ],
  "created_at": "2024-01-01T12:00:00Z"
}
```

---

#### PUT /quotations/{quotation_id}
Update quotation (draft only).

**Request:**
```json
{
  "title": "Updated Title",
  "total_amount": 5500.00,
  "items": [ /* ... */ ]
}
```

**Response:** Updated quotation object

---

#### POST /quotations/{quotation_id}/send
Send quotation to client (changes status to "sent").

**Request:**
```json
{
  "client_email": "client@example.com",
  "message": "Please review the attached quotation."
}
```

**Response:** HTTP 200 OK with updated quotation

---

#### POST /quotations/{quotation_id}/accept
Mark quotation as accepted.

**Response:** Updated quotation with status="accepted"

---

#### POST /quotations/{quotation_id}/reject
Mark quotation as rejected.

**Request:**
```json
{
  "reason": "Budget exceeded"
}
```

**Response:** Updated quotation with status="rejected"

---

#### DELETE /quotations/{quotation_id}
Delete quotation (draft only).

**Response:** HTTP 204 No Content

---

### Health Check

#### GET /health
Service health check (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET or PUT |
| 201 | Created | Successful POST creating new resource |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid parameters or format |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry (e.g., email already exists) |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server error (contact support) |

---

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication endpoints:** 5 requests per minute
- **General endpoints:** 100 requests per minute
- **Admin endpoints:** 1000 requests per minute

Rate limit headers included in response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704110400
```

---

## Pagination

List endpoints support cursor-based or offset-based pagination:

**Query Parameters:**
- `skip` or `page`: Starting position
- `limit` or `per_page`: Number of results per page

**Response:**
```json
{
  "data": [ /* items */ ],
  "total": 42,
  "skip": 0,
  "limit": 10
}
```

---

## Filtering

Endpoints support query parameter filtering:

```
GET /quotations?status=sent&project_id=uuid&skip=0&limit=10
```

---

## Sorting

Most list endpoints support sorting:

```
GET /projects?sort_by=created_at&sort_order=desc
```

---

## Interactive Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

These provide:
- All endpoints with full documentation
- Request/response examples
- Try-it-out functionality
- Schema definitions

---

## SDKs & Client Libraries

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1'
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Usage
const quotations = await api.get('/quotations?status=sent');
```

---

## Webhook Support (Future)

Planned: Event-driven webhooks for:
- Quotation status changes
- New projects created
- User account events

---

## Related Documentation

- [SECURITY.md](./SECURITY.md) - Authentication and security details
- [DATABASE.md](./DATABASE.md) - Data schema and relationships
