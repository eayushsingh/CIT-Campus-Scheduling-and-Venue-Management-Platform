"""Tests for authentication and role-based access control."""


def test_health_no_auth(client):
    """Health endpoint requires no authentication."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_login_valid_admin(client):
    """Admin can log in with correct credentials."""
    response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert data["token_type"] == "bearer"
    assert "access_token" in data


def test_login_valid_all_roles(client):
    """All 4 demo accounts can log in."""
    accounts = [
        ("admin", "admin123", "admin"),
        ("coordinator", "coord123", "coordinator"),
        ("faculty", "faculty123", "faculty"),
        ("clubrep", "clubrep123", "club_rep"),
    ]
    for username, password, expected_role in accounts:
        response = client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        assert response.status_code == 200, f"Login failed for {username}"
        assert response.json()["role"] == expected_role


def test_login_invalid_credentials(client):
    """Wrong password returns 401."""
    response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    """Non-existent user returns 401."""
    response = client.post(
        "/api/auth/login",
        data={"username": "nobody", "password": "x"},
    )
    assert response.status_code == 401


def test_me_authenticated(client, admin_token):
    """Authenticated user can access /me."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"


def test_me_unauthenticated(client):
    """/me without token returns 401."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_demo_accounts_endpoint(client):
    """Demo accounts endpoint returns all 4 accounts."""
    response = client.get("/api/auth/demo-accounts")
    assert response.status_code == 200
    accounts = response.json()
    assert len(accounts) == 4
    roles = {a["role"] for a in accounts}
    assert roles == {"admin", "coordinator", "faculty", "club_rep"}


def test_admin_reset_requires_admin(client, faculty_token):
    """Non-admin cannot reset demo data."""
    response = client.post(
        "/api/admin/reset",
        headers={"Authorization": f"Bearer {faculty_token}"},
    )
    assert response.status_code == 403


def test_admin_reset_works_for_admin(client, admin_token):
    """Admin can reset demo data."""
    response = client.post(
        "/api/admin/reset",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert "reset" in response.json()["message"].lower()


def test_role_check_clubrep_cannot_admin(client, clubrep_token):
    """Club rep cannot access admin endpoints."""
    response = client.post(
        "/api/admin/reset",
        headers={"Authorization": f"Bearer {clubrep_token}"},
    )
    assert response.status_code == 403

