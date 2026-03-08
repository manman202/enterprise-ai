"""
SharePoint connector — uses Microsoft Graph API with client_credentials flow (MSAL).
Recursively lists and downloads files from a configured SharePoint folder.
Only PDF, DOCX, XLSX, and TXT files are ingested.
"""

import logging
from datetime import datetime
from typing import Optional

from app.services.connectors.base import BaseConnector, ConnectionResult, FileInfo, SyncResult

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".txt", ".md"}


class SharePointConnector(BaseConnector):
    """
    Connector for Microsoft SharePoint via Microsoft Graph API.
    Requires msal and httpx — install via requirements.txt.
    """

    def __init__(self, source_id: str, config: dict):
        super().__init__(source_id, config)
        self.tenant_id: str = config.get("tenant_id", "")
        self.client_id: str = config.get("client_id", "")
        self.client_secret: str = config.get("client_secret", "")
        self.site_url: str = config.get("site_url", "")
        self.folder_path: str = config.get("folder_path", "/")
        self.drive_id: Optional[str] = config.get("drive_id")
        self._token: Optional[str] = None

    async def _get_token(self) -> str:
        """Acquire an access token using client_credentials flow via MSAL."""
        try:
            import msal  # type: ignore[import]
        except ImportError:
            raise RuntimeError("msal is not installed. Add 'msal' to requirements.txt.")

        authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        app = msal.ConfidentialClientApplication(
            self.client_id,
            authority=authority,
            client_credential=self.client_secret,
        )
        scope = ["https://graph.microsoft.com/.default"]
        result = app.acquire_token_for_client(scopes=scope)
        if "access_token" not in result:
            raise RuntimeError(f"MSAL token acquisition failed: {result.get('error_description', result)}")
        return result["access_token"]

    async def _get_site_id(self, token: str) -> str:
        """Resolve the site URL to a Graph API site ID."""
        import httpx  # type: ignore

        # Extract hostname and site path from site_url
        # e.g. https://company.sharepoint.com/sites/HR → company.sharepoint.com + /sites/HR
        url = self.site_url.rstrip("/")
        parts = url.replace("https://", "").split("/", 1)
        hostname = parts[0]
        site_path = "/" + parts[1] if len(parts) > 1 else "/"

        graph_url = f"https://graph.microsoft.com/v1.0/sites/{hostname}:{site_path}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(graph_url, headers={"Authorization": f"Bearer {token}"})
            r.raise_for_status()
            return r.json()["id"]

    async def _list_folder_files(self, token: str, site_id: str, folder_path: str) -> list[FileInfo]:
        """Recursively list files in a SharePoint folder via Graph API."""
        import httpx  # type: ignore

        files: list[FileInfo] = []
        headers = {"Authorization": f"Bearer {token}"}

        # Build the drive item URL
        if self.drive_id:
            base = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{self.drive_id}"
        else:
            base = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drive"

        path = folder_path.strip("/")
        if path:
            item_url = f"{base}/root:/{path}:/children"
        else:
            item_url = f"{base}/root/children"

        async with httpx.AsyncClient(timeout=15.0) as client:
            while item_url:
                r = await client.get(item_url, headers=headers)
                r.raise_for_status()
                data = r.json()

                for item in data.get("value", []):
                    if "folder" in item:
                        # Recurse into sub-folder
                        child_path = f"{folder_path}/{item['name']}"
                        sub_files = await self._list_folder_files(token, site_id, child_path)
                        files.extend(sub_files)
                    elif "file" in item:
                        name = item["name"]
                        ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
                        if ext in SUPPORTED_EXTENSIONS:
                            modified_str = item.get("lastModifiedDateTime")
                            modified = datetime.fromisoformat(modified_str.rstrip("Z")) if modified_str else None
                            files.append(
                                FileInfo(
                                    file_id=item["id"],
                                    name=name,
                                    size=item.get("size", 0),
                                    modified_at=modified,
                                    extra={"download_url": item.get("@microsoft.graph.downloadUrl", "")},
                                )
                            )

                # Pagination
                item_url = data.get("@odata.nextLink")

        return files

    async def test_connection(self) -> ConnectionResult:
        """Verify SharePoint credentials and return file count."""
        try:
            token = await self._get_token()
            site_id = await self._get_site_id(token)
            files = await self._list_folder_files(token, site_id, self.folder_path)
            return ConnectionResult(
                success=True,
                message=f"Connected to SharePoint — {len(files)} files found",
                files_found=len(files),
            )
        except Exception as e:
            logger.error("SharePoint test_connection failed: %s", e)
            return ConnectionResult(success=False, message=str(e))

    async def list_files(self) -> list[FileInfo]:
        """Return all supported files from the configured SharePoint folder."""
        token = await self._get_token()
        site_id = await self._get_site_id(token)
        return await self._list_folder_files(token, site_id, self.folder_path)

    async def download_file(self, file_id: str) -> bytes:
        """Download a file by its Graph API item ID."""
        import httpx  # type: ignore

        token = await self._get_token()
        site_id = await self._get_site_id(token)

        if self.drive_id:
            base = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{self.drive_id}"
        else:
            base = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drive"

        url = f"{base}/items/{file_id}/content"
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.get(url, headers={"Authorization": f"Bearer {token}"}, follow_redirects=True)
            r.raise_for_status()
            return r.content

    async def sync(self) -> SyncResult:
        """Download and ingest all files from SharePoint."""
        from app.services.ingestion import ingest_bytes  # late import

        try:
            files = await self.list_files()
        except Exception as e:
            return SyncResult(success=False, error=str(e))

        processed = 0
        failed = 0

        for file_info in files:
            try:
                content = await self.download_file(file_info.file_id)
                await ingest_bytes(content=content, filename=file_info.name, source_id=self.source_id)
                processed += 1
            except Exception as e:
                failed += 1
                logger.error("Failed to ingest SharePoint file %s: %s", file_info.name, e)

        return SyncResult(
            success=failed == 0,
            files_processed=processed,
            files_failed=failed,
            error=f"{failed} files failed" if failed else None,
        )
