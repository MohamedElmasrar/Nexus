import pytest
from unittest.mock import AsyncMock, patch
import httpx
from app.services.owncloud_client import get_owncloud_client

@pytest.mark.anyio
async def test_validate_credentials_success():
    client = get_owncloud_client()
    
    mock_response = httpx.Response(200, json={"ocs": {"meta": {"statuscode": 100}}})
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
         patch.object(client, "_auth", wraps=client._auth) as mock_auth_helper:
        mock_get.return_value = mock_response
        
        res = await client.validate_credentials("testuser", "testpass")
        assert res is True
        
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert kwargs["headers"]["OCS-APIRequest"] == "true"
        assert kwargs["headers"]["Accept"] == "application/json"
        
        # Verify the auth helper was called with correct username and password
        mock_auth_helper.assert_called_once_with("testuser", "testpass")

@pytest.mark.anyio
async def test_validate_credentials_failure():
    client = get_owncloud_client()
    mock_response = httpx.Response(400)
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        res = await client.validate_credentials("testuser", "testpass")
        assert res is False

@pytest.mark.anyio
async def test_validate_credentials_exception():
    client = get_owncloud_client()
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.RequestError("Network error")
        res = await client.validate_credentials("testuser", "testpass")
        assert res is False

@pytest.mark.anyio
async def test_validate_credentials_fallback_to_settings():
    client = get_owncloud_client()
    mock_response = httpx.Response(200)
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
         patch.object(client, "_auth", wraps=client._auth) as mock_auth_helper:
        mock_get.return_value = mock_response
        
        res = await client.validate_credentials()
        assert res is True
        
        mock_get.assert_called_once()
        # Verify it fell back to settings.OWNCLOUD_USERNAME/PASSWORD
        mock_auth_helper.assert_called_once_with("admin", "admin")
