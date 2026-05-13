"""
Unified ownCloud 10 client — OCS Provisioning, Sharing, and WebDAV APIs.

All methods accept explicit (username, password) so each request
can be made as the authenticated user (no global service account).
"""

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator
from urllib.parse import quote, unquote

import httpx

from app.core.config import get_settings


# ── Data classes ───────────────────────────────────────────────────────────


@dataclass
class OwnCloudUser:
    """Lightweight user representation from ownCloud OCS."""
    username: str
    display_name: str
    email: str
    groups: list[str] = field(default_factory=list)
    is_admin: bool = False


@dataclass
class OwnCloudGroup:
    group_id: str
    display_name: str
    members: list[str] = field(default_factory=list)


@dataclass
class OwnCloudShare:
    id: int
    share_type: int            # 0=user, 1=group, 3=public link
    share_with: str | None
    share_with_displayname: str | None
    path: str
    permissions: int
    uid_owner: str
    file_target: str | None = None
    token: str | None = None   # for public links


@dataclass
class OwnCloudFile:
    name: str
    path: str
    is_directory: bool
    size: int = 0
    content_type: str = ""
    last_modified: str = ""


# ── Client ─────────────────────────────────────────────────────────────────


class OwnCloudClient:
    """
    Stateless client — every call requires explicit credentials.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._base = settings.OWNCLOUD_URL.rstrip("/")

    # ── helpers ──────────────────────────────────────────────────────────

    def _auth(self, username: str, password: str) -> httpx.BasicAuth:
        return httpx.BasicAuth(username, password)

    def _ocs_url(self, path: str) -> str:
        return f"{self._base}/ocs/v1.php{path}"

    def _dav_url(self, username: str, path: str = "/") -> str:
        base = f"{self._base}/remote.php/dav/files/{quote(username)}"
        if not path or path == "/":
            return base + "/"
        clean = path.lstrip("/")
        url = f"{base}/{quote(clean, safe='/')}"
        if path.endswith("/") and not url.endswith("/"):
            url += "/"
        return url

    @staticmethod
    def _parse_ocs_xml(text: str) -> ET.Element:
        """Return the <data> element from an OCS XML response."""
        root = ET.fromstring(text)
        ns = {"ocs": ""}  # OCS uses default namespace
        # OCS responses are <ocs><meta>...</meta><data>...</data></ocs>
        data = root.find("data")
        if data is None:
            data = root
        return data

    # ══════════════════════════════════════════════════════════════════════
    # AUTH
    # ══════════════════════════════════════════════════════════════════════

    async def validate_credentials(self, username: str, password: str) -> bool:
        """Return True if the credentials are valid ownCloud credentials."""
        url = self._ocs_url("/cloud/user?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            try:
                r = await c.get(url, auth=self._auth(username, password))
                return r.status_code == 200
            except httpx.RequestError:
                return False

    # ══════════════════════════════════════════════════════════════════════
    # USERS (OCS Provisioning)
    # ══════════════════════════════════════════════════════════════════════

    async def get_current_user(self, username: str, password: str) -> OwnCloudUser | None:
        """Get full profile of the authenticated user."""
        url = self._ocs_url(f"/cloud/users/{quote(username)}?format=json")
        groups_url = self._ocs_url(f"/cloud/users/{quote(username)}/groups?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(url, auth=self._auth(username, password))
            if r.status_code != 200:
                return None
            data = r.json().get("ocs", {}).get("data", {})
            
            groups_r = await c.get(groups_url, auth=self._auth(username, password))
            groups = groups_r.json().get("ocs", {}).get("data", {}).get("groups", []) if groups_r.status_code == 200 else []
            
            return OwnCloudUser(
                username=data.get("id", username),
                display_name=data.get("displayname", username),
                email=data.get("email", ""),
                groups=groups,
                is_admin="admin" in groups,
            )

    async def list_users(self, admin_user: str, admin_pass: str) -> list[str]:
        """List all usernames (requires admin)."""
        url = self._ocs_url("/cloud/users?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(url, auth=self._auth(admin_user, admin_pass))
            r.raise_for_status()
            data = r.json().get("ocs", {}).get("data", {})
            return data.get("users", [])

    async def get_user(self, admin_user: str, admin_pass: str, target: str) -> OwnCloudUser | None:
        """Get a specific user's profile (requires admin)."""
        url = self._ocs_url(f"/cloud/users/{quote(target)}?format=json")
        groups_url = self._ocs_url(f"/cloud/users/{quote(target)}/groups?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(url, auth=self._auth(admin_user, admin_pass))
            if r.status_code != 200:
                return None
            data = r.json().get("ocs", {}).get("data", {})
            
            groups_r = await c.get(groups_url, auth=self._auth(admin_user, admin_pass))
            groups = groups_r.json().get("ocs", {}).get("data", {}).get("groups", []) if groups_r.status_code == 200 else []
            
            return OwnCloudUser(
                username=data.get("id", target),
                display_name=data.get("displayname", target),
                email=data.get("email", ""),
                groups=groups,
                is_admin="admin" in groups,
            )

    # ══════════════════════════════════════════════════════════════════════
    # GROUPS (OCS Provisioning)
    # ══════════════════════════════════════════════════════════════════════

    async def list_groups(self, username: str, password: str) -> list[str]:
        url = self._ocs_url("/cloud/groups?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(url, auth=self._auth(username, password))
            r.raise_for_status()
            data = r.json().get("ocs", {}).get("data", {})
            return data.get("groups", [])

    async def get_group_members(self, username: str, password: str, group_id: str) -> list[str]:
        url = self._ocs_url(f"/cloud/groups/{quote(group_id)}?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(url, auth=self._auth(username, password))
            r.raise_for_status()
            data = r.json().get("ocs", {}).get("data", {})
            return data.get("users", [])

    async def create_group(self, admin_user: str, admin_pass: str, group_id: str) -> bool:
        url = self._ocs_url("/cloud/groups?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.post(
                url,
                data={"groupid": group_id},
                auth=self._auth(admin_user, admin_pass),
            )
            return r.status_code == 200

    async def delete_group(self, admin_user: str, admin_pass: str, group_id: str) -> bool:
        url = self._ocs_url(f"/cloud/groups/{quote(group_id)}?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.delete(url, auth=self._auth(admin_user, admin_pass))
            return r.status_code == 200

    async def add_user_to_group(
        self, admin_user: str, admin_pass: str, target_user: str, group_id: str
    ) -> bool:
        url = self._ocs_url(f"/cloud/users/{quote(target_user)}/groups?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.post(
                url,
                data={"groupid": group_id},
                auth=self._auth(admin_user, admin_pass),
            )
            return r.status_code == 200

    async def remove_user_from_group(
        self, admin_user: str, admin_pass: str, target_user: str, group_id: str
    ) -> bool:
        url = self._ocs_url(f"/cloud/users/{quote(target_user)}/groups?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.delete(
                url,
                params={"groupid": group_id},
                auth=self._auth(admin_user, admin_pass),
            )
            return r.status_code == 200

    # ══════════════════════════════════════════════════════════════════════
    # SHARING (OCS Share API)
    # ══════════════════════════════════════════════════════════════════════

    async def create_share(
        self,
        username: str,
        password: str,
        path: str,
        share_type: int,  # 0=user, 1=group, 3=public
        share_with: str = "",
        permissions: int = 1,  # 1=read
    ) -> OwnCloudShare | None:
        url = self._ocs_url("/apps/files_sharing/api/v1/shares?format=json")
        data: dict[str, Any] = {
            "path": path,
            "shareType": share_type,
            "permissions": permissions,
        }
        if share_with:
            data["shareWith"] = share_with

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.post(url, data=data, auth=self._auth(username, password))
            if r.status_code != 200:
                return None
            d = r.json().get("ocs", {}).get("data", {})
            return OwnCloudShare(
                id=d.get("id", 0),
                share_type=d.get("share_type", share_type),
                share_with=d.get("share_with"),
                share_with_displayname=d.get("share_with_displayname"),
                path=d.get("path", path),
                permissions=d.get("permissions", permissions),
                uid_owner=d.get("uid_owner", username),
                file_target=d.get("file_target"),
                token=d.get("token"),
            )

    async def get_shares(
        self, username: str, password: str, path: str = ""
    ) -> list[OwnCloudShare]:
        url = self._ocs_url("/apps/files_sharing/api/v1/shares?format=json")
        params: dict[str, str] = {}
        if path:
            params["path"] = path
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(url, params=params, auth=self._auth(username, password))
            if r.status_code != 200:
                return []
            items = r.json().get("ocs", {}).get("data", [])
            return [
                OwnCloudShare(
                    id=s.get("id", 0),
                    share_type=s.get("share_type", 0),
                    share_with=s.get("share_with"),
                    share_with_displayname=s.get("share_with_displayname"),
                    path=s.get("path", ""),
                    permissions=s.get("permissions", 1),
                    uid_owner=s.get("uid_owner", ""),
                    file_target=s.get("file_target"),
                    token=s.get("token"),
                )
                for s in items
            ]

    async def delete_share(self, username: str, password: str, share_id: int) -> bool:
        url = self._ocs_url(f"/apps/files_sharing/api/v1/shares/{share_id}?format=json")
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.delete(url, auth=self._auth(username, password))
            return r.status_code == 200

    # ══════════════════════════════════════════════════════════════════════
    # FILES (WebDAV)
    # ══════════════════════════════════════════════════════════════════════

    async def list_files(
        self, username: str, password: str, path: str = "/"
    ) -> list[OwnCloudFile]:
        """List directory contents via PROPFIND."""
        url = self._dav_url(username, path)
        headers = {"Depth": "1", "Content-Type": "application/xml"}
        body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<d:propfind xmlns:d="DAV:">'
            "<d:prop>"
            "<d:displayname/>"
            "<d:getcontentlength/>"
            "<d:getcontenttype/>"
            "<d:resourcetype/>"
            "<d:getlastmodified/>"
            "</d:prop>"
            "</d:propfind>"
        )
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
            r = await c.request(
                "PROPFIND", url, content=body, headers=headers,
                auth=self._auth(username, password),
            )
            r.raise_for_status()

        ns = {"d": "DAV:"}
        root = ET.fromstring(r.text)
        results: list[OwnCloudFile] = []
        clean_path = path.strip("/")

        for resp_el in root.findall("d:response", ns):
            href = resp_el.findtext("d:href", "", ns)
            propstat = resp_el.find("d:propstat", ns)
            if propstat is None:
                continue
            prop = propstat.find("d:prop", ns)
            if prop is None:
                continue

            name = prop.findtext("d:displayname", "", ns)
            size_text = prop.findtext("d:getcontentlength", "0", ns)
            content_type = prop.findtext("d:getcontenttype", "", ns)
            last_modified = prop.findtext("d:getlastmodified", "", ns)
            resource_type = prop.find("d:resourcetype", ns)
            is_dir = (
                resource_type is not None
                and resource_type.find("d:collection", ns) is not None
            )

            # Skip the directory itself (first entry)
            decoded_href = href.rstrip("/")
            if decoded_href.endswith(f"/files/{quote(username)}" + (f"/{quote(clean_path, safe='/')}" if clean_path else "")) or decoded_href.endswith(f"/files/{quote(username)}" + (f"/{quote(clean_path, safe='/')}/" if clean_path else "/")):
                continue
            # Alternative: skip if name matches the current folder
            if not name:
                name = unquote(href.rstrip("/").rsplit("/", 1)[-1])

            item_path = f"/{clean_path}/{name}".replace("//", "/") if clean_path else f"/{name}"

            results.append(OwnCloudFile(
                name=name,
                path=item_path,
                is_directory=is_dir,
                size=int(size_text) if size_text else 0,
                content_type=content_type,
                last_modified=last_modified,
            ))

        return results

    async def upload_file(
        self, username: str, password: str, path: str, content: bytes
    ) -> bool:
        """Upload file via PUT."""
        url = self._dav_url(username, path)
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as c:
            r = await c.put(url, content=content, auth=self._auth(username, password))
            return r.status_code in (200, 201, 204)

    async def create_folder(
        self, username: str, password: str, path: str
    ) -> bool:
        """Create folder via MKCOL."""
        url = self._dav_url(username, path)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.request("MKCOL", url, auth=self._auth(username, password))
            return r.status_code in (201, 405)  # 405 = already exists

    async def delete_file(
        self, username: str, password: str, path: str
    ) -> bool:
        """Delete file or folder via DELETE."""
        url = self._dav_url(username, path)
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
            r = await c.delete(url, auth=self._auth(username, password))
            return r.status_code in (200, 204)

    async def download_file(
        self, username: str, password: str, path: str
    ) -> AsyncGenerator[bytes, None]:
        """Stream file content via GET."""
        url = self._dav_url(username, path)
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as c:
            async with c.stream(
                "GET", url, auth=self._auth(username, password)
            ) as r:
                r.raise_for_status()
                async for chunk in r.aiter_bytes(chunk_size=8192):
                    yield chunk


# ── Singleton ──────────────────────────────────────────────────────────────

_client: OwnCloudClient | None = None


def get_owncloud_client() -> OwnCloudClient:
    global _client
    if _client is None:
        _client = OwnCloudClient()
    return _client
