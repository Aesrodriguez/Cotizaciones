# Triplaa Backend API

FastAPI backend for the Triplaa Cotizaciones application.

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth/
│   │       ├── usuarios/
│   │       ├── clientes/
│   │       ├── cotizaciones/
│   │       ├── productos/
│   │       ├── apu/
│   │       ├── contratos/
│   │       ├── gastos/
│   │       ├── trabajadores/
│   │       ├── dashboard/
│   │       └── audit/
│   ├── config/
│   ├── exceptions/
│   ├── middleware/
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   ├── utils/
│   └── main.py
├── migrations/
├── tests/
├── Dockerfile
├── requirements.txt
├── pytest.ini
├── .env.example
└── README.md
```

## Setup Instructions

### Prerequisites
- Python 3.11+
- PostgreSQL 12+

### Installation

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Copy .env.example to .env and update values:
```bash
cp .env.example .env
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

### Running the Application

#### Development
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Production
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Running Tests

```bash
pytest
pytest -v  # Verbose
pytest --cov  # With coverage
```

### Docker

Build image:
```bash
docker build -t triplaa-backend .
```

Run container:
```bash
docker run -p 8000:8000 --env-file .env triplaa-backend
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Environment Variables

See `.env.example` for all available configuration options.

## Endpoints Structure

Endpoints are organized by domain:
- `/api/v1/auth/` - Authentication endpoints
- `/api/v1/usuarios/` - User management
- `/api/v1/clientes/` - Client management
- `/api/v1/cotizaciones/` - Quotations
- `/api/v1/productos/` - Products
- `/api/v1/apu/` - APU (Analysis of Unit Prices)
- `/api/v1/contratos/` - Contracts
- `/api/v1/gastos/` - Expenses
- `/api/v1/trabajadores/` - Workers
- `/api/v1/dashboard/` - Dashboard analytics
- `/api/v1/audit/` - Audit logs

## Development Guidelines

### Creating a New Endpoint Module

1. Create endpoint files in `app/api/v1/{module}/`
2. Create models in `app/models/{module}.py`
3. Create schemas in `app/schemas/{module}.py`
4. Create services in `app/services/{module}.py`
5. Create repositories in `app/repositories/{module}.py`
6. Create tests in `tests/{module}/`

## License

Proprietary
