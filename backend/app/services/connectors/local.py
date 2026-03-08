"""
Local folder connector — walks an absolute path on the VPS and ingests
any new or modified files into the knowledge base.
This is the simplest connector: no credentials, no network calls.
"""

import logging
import os
from datetime import datetime

from app.services.connectors.base import BaseConnector, ConnectionResult, FileInfo, SyncResult

logger = logging.getLogger(__name__)

# File extensions we can ingest (must match the document parser)
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".txt", ".md"}


class LocalConnector(BaseConnector):
    """Connector for a local directory path on the host VPS."""

    def __init__(self, source_id: str, config: dict):
        super().__init__(source_id, config)
        self.path: str = config.get("path", "")

    async def test_connection(self) -> ConnectionResult:
        """Check that the configured path exists and is readable."""
        if not self.path:
            return ConnectionResult(success=False, message="No path configured")
        if not os.path.isdir(self.path):
            return ConnectionResult(success=False, message=f"Directory not found: {self.path}")
        if not os.access(self.path, os.R_OK):
            return ConnectionResult(success=False, message=f"Directory not readable: {self.path}")

        files = await self.list_files()
        return ConnectionResult(
            success=True,
            message=f"Connected — {len(files)} supported files found",
            files_found=len(files),
        )

    async def list_files(self) -> list[FileInfo]:
        """Walk the directory tree and return metadata for supported files."""
        results: list[FileInfo] = []
        if not os.path.isdir(self.path):
            return results

        for root, _dirs, filenames in os.walk(self.path):
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in SUPPORTED_EXTENSIONS:
                    continue
                full_path = os.path.join(root, filename)
                try:
                    stat = os.stat(full_path)
                    results.append(
                        FileInfo(
                            file_id=full_path,  # Absolute path doubles as unique ID
                            name=filename,
                            size=stat.st_size,
                            modified_at=datetime.fromtimestamp(stat.st_mtime),
                        )
                    )
                except OSError as e:
                    logger.warning("Cannot stat %s: %s", full_path, e)
        return results

    async def download_file(self, file_id: str) -> bytes:
        """Read and return raw bytes from the local path."""
        with open(file_id, "rb") as fh:
            return fh.read()

    async def sync(self) -> SyncResult:
        """
        Walk the configured path and ingest all supported files.
        For full sync: ingest every file (the ingestion layer handles dedup via file hash).
        """
        from app.services.ingestion import ingest_bytes  # late import to avoid circular deps

        files = await self.list_files()
        processed = 0
        failed = 0

        for file_info in files:
            try:
                content = await self.download_file(file_info.file_id)
                await ingest_bytes(
                    content=content,
                    filename=file_info.name,
                    source_id=self.source_id,
                )
                processed += 1
                logger.debug("Ingested %s", file_info.name)
            except Exception as e:
                failed += 1
                logger.error("Failed to ingest %s: %s", file_info.name, e)

        return SyncResult(
            success=failed == 0,
            files_processed=processed,
            files_failed=failed,
            error=f"{failed} files failed to ingest" if failed else None,
        )
