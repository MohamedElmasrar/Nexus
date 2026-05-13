"""
Tests for file management endpoints.
"""

from unittest.mock import patch, AsyncMock


class TestFileUpload:
    """POST /api/v1/files/upload"""

    def test_upload_requires_admin(self, client, user_token, test_group, admin_user):
        """Standard users cannot upload files."""
        response = client.post(
            "/api/v1/files/upload",
            data={"group_id": str(test_group.id)},
            files={"file": ("test.txt", b"hello world", "text/plain")},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    @patch("app.services.file_service._resolve_provider")
    def test_admin_can_upload(
        self, mock_resolve, client, admin_token, test_group, db
    ):
        """Admin can upload a file — mock the storage provider."""
        mock_provider = AsyncMock()
        mock_provider.upload.return_value = "nexus/group_1/test.txt"
        mock_resolve.return_value = (mock_provider, "owncloud")

        response = client.post(
            "/api/v1/files/upload",
            data={"group_id": str(test_group.id)},
            files={"file": ("test.txt", b"hello world", "text/plain")},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["file"]["filename"] == "test.txt"
        assert body["file"]["storage_provider"] == "owncloud"
        assert body["message"] == "File uploaded successfully"

    def test_upload_nonexistent_group(self, client, admin_token):
        """Upload to a non-existent group should return 404."""
        response = client.post(
            "/api/v1/files/upload",
            data={"group_id": "99999"},
            files={"file": ("test.txt", b"data", "text/plain")},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404


class TestFileDownload:
    """GET /api/v1/users/me/files/{file_id}/download"""

    def test_download_requires_group_membership(
        self, client, user_token, test_file_record, admin_user
    ):
        """User not in the file's group should get 403."""
        response = client.get(
            f"/api/v1/users/me/files/{test_file_record.id}/download",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    def test_download_nonexistent_file(self, client, admin_token):
        """Downloading a non-existent file should return 404."""
        response = client.get(
            "/api/v1/users/me/files/99999/download",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404
