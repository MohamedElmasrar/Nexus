"""
Tests for the authentication endpoints.
"""


class TestLogin:
    """POST /api/v1/auth/login"""

    def test_login_valid_credentials(self, client, admin_user):
        """A valid username + password should return a JWT token."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "adminpass"},
        )
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_login_wrong_password(self, client, admin_user):
        """An incorrect password should return 401."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "wrong"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """A non-existent username should return 401."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "ghost", "password": "nope"},
        )
        assert response.status_code == 401

    def test_protected_endpoint_no_token(self, client):
        """Accessing a protected endpoint without a token should return 401."""
        response = client.get("/api/v1/users/me/")
        assert response.status_code == 401

    def test_protected_endpoint_invalid_token(self, client):
        """An invalid JWT should return 401."""
        response = client.get(
            "/api/v1/users/me/",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    def test_protected_endpoint_valid_token(self, client, admin_user, admin_token):
        """A valid JWT should grant access to /users/me/."""
        response = client.get(
            "/api/v1/users/me/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["username"] == "admin"
