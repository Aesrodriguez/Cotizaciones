"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config.settings import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    # Startup
    print(f"🚀 {settings.API_TITLE} v{settings.API_VERSION} starting...")
    yield
    # Shutdown
    print(f"🛑 {settings.API_TITLE} shutting down...")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title=settings.API_TITLE,
        version=settings.API_VERSION,
        description=settings.API_DESCRIPTION,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_CREDENTIALS,
        allow_methods=settings.CORS_METHODS,
        allow_headers=settings.CORS_HEADERS,
    )

    # Routers
    from app.api.v1.auth.router import router as auth_router
    from app.api.v1.clientes.router import router as clientes_router
    from app.api.v1.productos.router import router as productos_router
    from app.api.v1.cotizaciones.router import router as cotizaciones_router

    prefix = settings.API_PREFIX
    app.include_router(auth_router, prefix=prefix)
    app.include_router(clientes_router, prefix=prefix)
    app.include_router(productos_router, prefix=prefix)
    app.include_router(cotizaciones_router, prefix=prefix)

    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "healthy", "app": settings.API_TITLE, "version": settings.API_VERSION}

    @app.get("/", tags=["Root"])
    async def root():
        return {"message": f"Welcome to {settings.API_TITLE}", "docs": "/docs"}

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
