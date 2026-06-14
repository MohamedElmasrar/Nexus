import pytest
from unittest.mock import AsyncMock, patch
from app.services.owncloud_client import OwnCloudUser

def test_login_success(client):
    # Mock validate_credentials and get_current_user
    with patch("app.services.owncloud_client.OwnCloudClient.validate_credentials", new_callable=AsyncMock) as mock_val, \
         patch("app.services.owncloud_client.OwnCloudClient.get_current_user", new_callable=AsyncMock) as mock_user:
        
        mock_val.return_value = True
        mock_user.return_value = OwnCloudUser(
            username="testuser",
            display_name="Test User",
            email="test@test.local",
            groups=["user"],
            is_admin=False
        )
        
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser", "password": "testpassword"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

def test_login_invalid_credentials(client):
    with patch("app.services.owncloud_client.OwnCloudClient.validate_credentials", new_callable=AsyncMock) as mock_val:
        mock_val.return_value = False
        
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect username or password"
