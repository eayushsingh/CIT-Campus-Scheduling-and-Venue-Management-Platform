"""CIT Scheduler - FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import get_settings
from backend.app.core.logging import setup_logging, get_logger
from backend.app.db.session import init_db
from backend.app.db.seed import seed_users

# Routers
from backend.app.api.auth import router as auth_router
from backend.app.api.admin import router as admin_router
from backend.app.api.timetable import router as timetable_router
from backend.app.api.exams import router as exams_router
from backend.app.api.bookings import router as bookings_router
from backend.app.api.disruptions import router as disruptions_router
from backend.app.api.assistant import router as assistant_router
from backend.app.api.export import router as export_router

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings = get_settings()
    setup_logging(settings.DEBUG)
    logger.info(f"Starting {settings.APP_NAME}")
    init_db()
    seed_users()
    logger.info("Database initialised, demo users seeded.")
    yield
    logger.info("Shutting down.")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.APP_NAME,
        description="Campus Scheduling and Venue Management Platform for Chilika Institute of Technology",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(timetable_router)
    app.include_router(exams_router)
    app.include_router(bookings_router)
    app.include_router(disruptions_router)
    app.include_router(assistant_router)
    app.include_router(export_router)

    # Health check (no auth)
    @app.get("/api/health", tags=["health"])
    async def health():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": "0.1.0",
        }

    # Global exception handler for consistent error format
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred.",
                "details": str(exc) if settings.DEBUG else None,
            },
        )

    return app


app = create_app()

