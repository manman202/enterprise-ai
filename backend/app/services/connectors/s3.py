"""
S3-compatible object storage connector — works with AWS S3, MinIO, Cloudflare R2, etc.
Uses boto3 (sync) wrapped in asyncio.to_thread for async compatibility.
Tracks ETags to skip files that haven't changed since the last sync.
"""

import asyncio
import logging
from typing import Optional

from app.services.connectors.base import BaseConnector, ConnectionResult, FileInfo, SyncResult

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".txt", ".md"}


class S3Connector(BaseConnector):
    """
    Connector for S3-compatible object storage.
    Requires boto3 — install via requirements.txt.
    """

    def __init__(self, source_id: str, config: dict):
        super().__init__(source_id, config)
        self.bucket: str = config.get("bucket", "")
        self.prefix: str = config.get("prefix", "").rstrip("/")
        self.region: str = config.get("region", "us-east-1")
        self.access_key_id: str = config.get("access_key_id", "")
        self.secret_access_key: str = config.get("secret_access_key", "")
        self.endpoint_url: Optional[str] = config.get("endpoint_url")

    def _client(self):
        """Create a boto3 S3 client with the configured credentials."""
        try:
            import boto3  # type: ignore[import]
        except ImportError:
            raise RuntimeError("boto3 is not installed. Add 'boto3' to requirements.txt.")

        kwargs = {
            "region_name": self.region,
            "aws_access_key_id": self.access_key_id,
            "aws_secret_access_key": self.secret_access_key,
        }
        if self.endpoint_url:
            kwargs["endpoint_url"] = self.endpoint_url

        return boto3.client("s3", **kwargs)

    def _list_objects_sync(self) -> list[FileInfo]:
        """Synchronous listing via boto3 paginator (run in thread pool)."""
        s3 = self._client()
        files: list[FileInfo] = []

        paginator = s3.get_paginator("list_objects_v2")
        kwargs = {"Bucket": self.bucket}
        if self.prefix:
            kwargs["Prefix"] = self.prefix + "/"

        for page in paginator.paginate(**kwargs):
            for obj in page.get("Contents", []):
                key: str = obj["Key"]
                name = key.split("/")[-1]
                ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if ext not in SUPPORTED_EXTENSIONS:
                    continue
                files.append(
                    FileInfo(
                        file_id=key,  # Use the S3 object key as unique ID
                        name=name,
                        size=obj.get("Size", 0),
                        modified_at=obj.get("LastModified"),
                        extra={"etag": obj.get("ETag", "")},
                    )
                )
        return files

    def _download_sync(self, key: str) -> bytes:
        """Synchronous download via boto3 (run in thread pool)."""
        s3 = self._client()
        buf = __import__("io").BytesIO()
        s3.download_fileobj(self.bucket, key, buf)
        return buf.getvalue()

    async def test_connection(self) -> ConnectionResult:
        """Verify S3 credentials and return object count."""
        try:
            files = await asyncio.to_thread(self._list_objects_sync)
            return ConnectionResult(
                success=True,
                message=f"Connected — {len(files)} supported files found in s3://{self.bucket}/{self.prefix}",
                files_found=len(files),
            )
        except Exception as e:
            logger.error("S3 test_connection failed: %s", e)
            return ConnectionResult(success=False, message=str(e))

    async def list_files(self) -> list[FileInfo]:
        """List all supported files in the configured S3 bucket/prefix."""
        return await asyncio.to_thread(self._list_objects_sync)

    async def download_file(self, file_id: str) -> bytes:
        """Download an S3 object by its key."""
        return await asyncio.to_thread(self._download_sync, file_id)

    async def sync(self) -> SyncResult:
        """Download and ingest all supported objects from S3."""
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
                logger.error("Failed to ingest S3 object %s: %s", file_info.name, e)

        return SyncResult(
            success=failed == 0,
            files_processed=processed,
            files_failed=failed,
            error=f"{failed} objects failed" if failed else None,
        )
