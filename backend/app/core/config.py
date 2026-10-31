"""Core configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CIT Scheduler"
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Auth
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "sqlite:///./cit_scheduler.db"

    # LLM
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.0-flash"
    LLM_PROVIDER: str = "gemini"

    # Solver
    SOLVER_TIME_LIMIT_SECONDS: int = 120
    SOLVER_NUM_WORKERS: int = 8

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

