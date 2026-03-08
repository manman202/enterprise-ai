"""
SMB/CIFS file server connector — connects to a Windows file share or Samba server
using the smbprotocol library. Walks a directory path and ingests supported files.
"""

import logging
from datetime import datetime

from app.services.connectors.base import BaseConnector, ConnectionResult, FileInfo, SyncResult

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".txt", ".md"}


class SMBConnector(BaseConnector):
    """
    Connector for SMB/CIFS file shares.
    Requires smbprotocol — install via requirements.txt.
    """

    def __init__(self, source_id: str, config: dict):
        super().__init__(source_id, config)
        self.server: str = config.get("server", "")
        self.share: str = config.get("share", "")
        self.username: str = config.get("username", "")
        self.password: str = config.get("password", "")
        self.domain: str = config.get("domain", "")
        self.path: str = config.get("path", "/")

    def _connect(self):
        """Establish an SMB connection and return an open tree (share handle)."""
        try:
            import smbclient  # type: ignore[import]
        except ImportError:
            raise RuntimeError("smbprotocol is not installed. Add 'smbprotocol' to requirements.txt.")

        smbclient.register_session(
            self.server,
            username=self.username,
            password=self.password,
            domain=self.domain or "",
        )
        return smbclient

    async def test_connection(self) -> ConnectionResult:
        """Verify SMB credentials and return file count."""
        try:
            client = self._connect()
            share_path = f"\\\\{self.server}\\{self.share}{self.path.replace('/', '\\')}"
            count = 0
            for entry in client.scandir(share_path):
                if entry.is_file():
                    ext = "." + entry.name.rsplit(".", 1)[-1].lower() if "." in entry.name else ""
                    if ext in SUPPORTED_EXTENSIONS:
                        count += 1
            return ConnectionResult(success=True, message=f"Connected — {count} files found", files_found=count)
        except Exception as e:
            logger.error("SMB test_connection failed: %s", e)
            return ConnectionResult(success=False, message=str(e))

    async def list_files(self) -> list[FileInfo]:
        """Walk the SMB share and return metadata for supported files."""
        client = self._connect()
        files: list[FileInfo] = []
        root = f"\\\\{self.server}\\{self.share}{self.path.replace('/', '\\')}"

        def _walk(dir_path: str) -> None:
            try:
                for entry in client.scandir(dir_path):
                    full = f"{dir_path}\\{entry.name}"
                    if entry.is_dir():
                        _walk(full)
                    elif entry.is_file():
                        ext = "." + entry.name.rsplit(".", 1)[-1].lower() if "." in entry.name else ""
                        if ext in SUPPORTED_EXTENSIONS:
                            stat = entry.stat()
                            files.append(
                                FileInfo(
                                    file_id=full,
                                    name=entry.name,
                                    size=stat.st_size,
                                    modified_at=datetime.fromtimestamp(stat.st_mtime),
                                )
                            )
            except Exception as e:
                logger.warning("SMB scandir error at %s: %s", dir_path, e)

        _walk(root)
        return files

    async def download_file(self, file_id: str) -> bytes:
        """Download raw bytes from an SMB path."""
        client = self._connect()
        with client.open_file(file_id, mode="rb") as fh:
            return fh.read()

    async def sync(self) -> SyncResult:
        """Walk the SMB share and ingest all supported files."""
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
                logger.error("Failed to ingest SMB file %s: %s", file_info.name, e)

        return SyncResult(
            success=failed == 0,
            files_processed=processed,
            files_failed=failed,
            error=f"{failed} files failed" if failed else None,
        )
