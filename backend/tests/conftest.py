"""Test configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.session import init_db, get_engine
from backend.app.db.models import Base
from backend.app.db.seed import seed_users


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create tables and seed before any tests run."""
    # Use in-memory SQLite for tests
    import os
    os.environ["DATABASE_URL"] = "sqlite:///./test_cit.db"

    # Reset engine cache
    import backend.app.db.session as sess
    sess._engine = None
    sess._SessionLocal = None

    # Clear settings cache
    from backend.app.core.config import get_settings
    get_settings.cache_clear()

    init_db()
    seed_users()
    yield
    # Cleanup
    engine = get_engine()
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_cit.db"):
        os.remove("./test_cit.db")


@pytest.fixture
def client():
    """Test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def admin_token(client):
    """Get an auth token for the admin user."""
    response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def coordinator_token(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "coordinator", "password": "coord123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def faculty_token(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "faculty", "password": "faculty123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def clubrep_token(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "clubrep", "password": "clubrep123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]

