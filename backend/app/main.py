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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 {settings.API_TITLE} v{settings.API_VERSION} iniciando...")
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

    async def health():
        return {"status": "ok"}

    app.add_api_route("/health", health, tags=["Sistema"])
    app.add_api_route(f"{prefix}/health", health, tags=["Sistema"])

    @app.get("/", tags=["Sistema"])
    async def root():
        return {"app": settings.API_TITLE, "docs": "/docs"}

    return app


app = create_app()
