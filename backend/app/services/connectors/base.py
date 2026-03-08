"""
Abstract base class for all knowledge source connectors.
Every connector must implement test_connection(), list_files(), and sync().
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class FileInfo:
    """Metadata about a file discovered by a connector."""

    file_id: str  # Unique ID within the source (path, object key, item ID, etc.)
    name: str  # Display filename
    size: int  # Bytes
    modified_at: Optional[datetime] = None
    content_type: Optional[str] = None  # MIME type if known
    extra: dict = field(default_factory=dict)  # Source-specific extras


@dataclass
class ConnectionResult:
    """Result of a test_connection() call."""

    success: bool
    message: str
    files_found: Optional[int] = None


@dataclass
class SyncResult:
    """Aggregated result of a full sync() run."""

    success: bool
    files_processed: int = 0
    files_skipped: int = 0  # Already up-to-date
    files_failed: int = 0
    error: Optional[str] = None


class BaseConnector(ABC):
    """
    Abstract base for all knowledge source connectors.
    Subclasses must implement the three abstract methods below.
    """

    def __init__(self, source_id: str, config: dict):
        """
        Args:
            source_id: UUID string of the KnowledgeSource row
            config: Parsed connector config dict (e.g. SharePointConfig fields)
        """
        self.source_id = source_id
        self.config = config

    @abstractmethod
    async def test_connection(self) -> ConnectionResult:
        """
        Verify credentials and connectivity without modifying any state.
        Returns a ConnectionResult with success=True and an approx files_found count.
        """

    @abstractmethod
    async def list_files(self) -> list[FileInfo]:
        """
        Return metadata for all files this connector can see.
        Does NOT download file content — used to detect what needs ingesting.
        """

    @abstractmethod
    async def download_file(self, file_id: str) -> bytes:
        """
        Download raw bytes for a single file identified by file_id.
        """

    @abstractmethod
    async def sync(self) -> SyncResult:
        """
        Full sync pass: discover files, download new/changed ones, ingest.
        Should be idempotent — skip files that are already up-to-date.
        """
