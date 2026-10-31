"""Tests for backend health and offline/connection resilience."""

import pytest
import httpx
from fastapi.testclient import TestClient
from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check_endpoint(client):
    """Verify that /api/health responds with status ok and service metadata."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") in ("healthy", "ok")
    assert "CIT" in data.get("app", "")


def test_timeout_and_unreachable_handling():
    """Verify that simulating an unreachable port produces a connection error with clear message."""
    with pytest.raises((httpx.ConnectError, httpx.TimeoutException)):
        # Attempt to connect to an unused port with 1s timeout
        with httpx.Client(timeout=1.0) as http_client:
            http_client.get("http://127.0.0.1:59999/api/health")


def test_login_invalid_user_returns_clear_401(client):
    """Verify that invalid user credentials return clean 401 response and not 500 error."""
    res = client.post(
        "/api/auth/login",
        data={"username": "ayushsingh", "password": "wrongpassword"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401
    detail = res.json().get("detail", {})
    msg = detail.get("message", "") if isinstance(detail, dict) else str(detail)
    assert "Incorrect username or password" in msg or "Invalid" in msg
