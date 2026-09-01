import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("cotizaciones")


def _ensure_columns():
    """Agrega columnas/tablas nuevas de forma segura si no existen (safety net post-migration)."""
    try:
        from app.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text(
                "ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS unidad VARCHAR(20)"
            ))
            db.execute(text(
                "ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS token_publico VARCHAR(64)"
            ))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS cotizacion_vistas (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
                    fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ip            VARCHAR(64),
                    user_agent    VARCHAR(512)
                )
            """))
            db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_cot_vistas_cotizacion_id ON cotizacion_vistas(cotizacion_id)"
            ))
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"_ensure_columns: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 {settings.API_TITLE} v{settings.API_VERSION} iniciando...")
    _ensure_columns()
    yield
    logger.info(f"🛑 {settings.API_TITLE} deteniendo...")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.API_TITLE,
        version=settings.API_VERSION,
        description=settings.API_DESCRIPTION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Always include the production frontend; merge with anything in CORS_ORIGINS
    _cors_origins = list({
        "https://cotizaciones-web.onrender.com",
        "http://localhost:5173",
        *settings.CORS_ORIGINS,
    })
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_logging(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(f"[{request_id}] {request.method} {request.url.path} → 500 ({exc!r})")
            raise
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"→ {response.status_code} ({elapsed:.1f}ms)"
        )
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = [
            {"campo": ".".join(str(l) for l in e["loc"][1:]), "mensaje": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Datos inválidos", "errores": errors},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Error no manejado en {request.method} {request.url.path}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Error interno del servidor"},
        )

    from app.api.v1.auth.router import router as auth_router
    from app.api.v1.clientes.router import router as clientes_router
    from app.api.v1.cotizaciones.router import router as cotizaciones_router
    from app.api.v1.productos.router import router as productos_router
    from app.api.v1.usuarios.router import router as usuarios_router
    from app.api.v1.contratos.router import router as contratos_router
    from app.api.v1.trabajadores.router import router as trabajadores_router
    from app.api.v1.apu.router import router as apu_router
    from app.api.v1.facturas.router import router as facturas_router
    from app.api.v1.extractos.router import router as extractos_router
    from app.api.v1.materiales.router import router as materiales_router
    from app.api.v1.obras.router import router as obras_router
    from app.api.v1.pagos.router import router as pagos_router
    from app.api.v1.equipos.router import router as equipos_router
    from app.api.v1.reportes.router import router as reportes_router
    from app.api.v1.planillas.router import router as planillas_router
    from app.api.v1.acps.router import router as acps_router
    from app.api.v1.configuracion.router import router as configuracion_router
    from app.api.v1.public.router import router as public_router

    prefix = settings.API_PREFIX
    app.include_router(auth_router, prefix=prefix)
    app.include_router(clientes_router, prefix=prefix)
    app.include_router(productos_router, prefix=prefix)
    app.include_router(cotizaciones_router, prefix=prefix)
    app.include_router(usuarios_router, prefix=prefix)
    app.include_router(contratos_router, prefix=prefix)
    app.include_router(trabajadores_router, prefix=prefix)
    app.include_router(apu_router, prefix=prefix)
    app.include_router(facturas_router, prefix=prefix)
    app.include_router(extractos_router, prefix=prefix)
    app.include_router(materiales_router, prefix=prefix)
    app.include_router(obras_router, prefix=prefix)
    app.include_router(pagos_router, prefix=prefix)
    app.include_router(equipos_router, prefix=prefix)
    app.include_router(reportes_router, prefix=prefix)
    app.include_router(planillas_router, prefix=prefix)
    app.include_router(acps_router, prefix=prefix)
    app.include_router(configuracion_router, prefix=prefix)
    app.include_router(public_router, prefix=prefix)

    async def health():
        return {"status": "ok"}

    app.add_api_route("/health", health, tags=["Sistema"])
    app.add_api_route(f"{prefix}/health", health, tags=["Sistema"])

    @app.get("/", tags=["Sistema"])
    async def root():
        return {"app": settings.API_TITLE, "docs": "/docs"}

    return app


app = create_app()
