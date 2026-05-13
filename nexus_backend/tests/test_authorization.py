"""
Tests for the core authorization logic.

Verifies:
- Standard users cannot access admin endpoints.
- Users can only see files in their assigned groups.
- Users cannot access files from groups they're not in.
- Admins bypass group restrictions.
"""


class TestAdminOnlyEndpoints:
    """Standard users must be blocked from /admin/* routes."""

    def test_user_cannot_list_users(self, client, user_token, admin_user):
        """A standard user should receive 403 on admin user listing."""
        response = client.get(
            "/api/v1/admin/users/",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    def test_user_cannot_create_group(self, client, user_token, admin_user):
        """A standard user should receive 403 on group creation."""
        response = client.post(
            "/api/v1/admin/groups/",
            json={"name": "Hacking", "description": "nope"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    def test_user_cannot_add_drive(self, client, user_token, admin_user):
        """A standard user should receive 403 on drive config creation."""
        response = client.post(
            "/api/v1/admin/drives/",
            json={
                "drive_type": "owncloud",
                "config_json": {"url": "http://x"},
                "is_active": True,
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    def test_admin_can_list_users(self, client, admin_token):
        """An admin should be able to list users."""
        response = client.get(
            "/api/v1/admin/users/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200


class TestGroupBasedFileAccess:
    """Users should only see files in groups they belong to."""

    def test_user_can_see_files_in_assigned_group(
        self, client, user_token, assigned_group, test_file_record
    ):
        """User in a group should see the group's files."""
        response = client.get(
            f"/api/v1/users/me/groups/{assigned_group.id}/files",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        files = response.json()
        assert len(files) == 1
        assert files[0]["filename"] == "report.pdf"

    def test_user_cannot_see_files_in_unassigned_group(
        self, client, user_token, test_group, test_file_record, admin_user
    ):
        """User NOT in a group should get 403."""
        response = client.get(
            f"/api/v1/users/me/groups/{test_group.id}/files",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403

    def test_admin_can_see_any_group_files(
        self, client, admin_token, test_group, test_file_record
    ):
        """Admins bypass group membership checks."""
        response = client.get(
            f"/api/v1/users/me/groups/{test_group.id}/files",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        files = response.json()
        assert len(files) == 1

    def test_user_groups_endpoint(self, client, user_token, assigned_group):
        """GET /users/me/groups should return the user's assigned groups."""
        response = client.get(
            "/api/v1/users/me/groups",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        groups = response.json()
        assert len(groups) == 1
        assert groups[0]["name"] == "Engineering"

    def test_user_no_groups(self, client, user_token, admin_user):
        """User with no group assignments should get an empty list."""
        response = client.get(
            "/api/v1/users/me/groups",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 200
        assert response.json() == []
