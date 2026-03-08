"""
Pydantic schemas for KnowledgeSource — request/response models for the
/api/v1/knowledge-sources endpoints.
Credentials in config blobs are accepted on write but masked on read.
"""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# ── Connector config schemas (one per source_type) ────────────────────────────


class SharePointConfig(BaseModel):
    """Microsoft SharePoint via Graph API (client_credentials flow)."""

    tenant_id: str = Field(..., description="Azure tenant GUID")
    client_id: str = Field(..., description="App registration client ID")
    client_secret: str = Field(..., description="App registration client secret")
    site_url: str = Field(..., description="e.g. https://company.sharepoint.com/sites/HR")
    folder_path: str = Field(default="/", description="Path within the site (e.g. /Shared Documents/HR)")
    drive_id: Optional[str] = Field(default=None, description="Drive ID if not default document library")


class SMBConfig(BaseModel):
    """SMB/CIFS file server (e.g. Windows file share, Samba)."""

    server: str = Field(..., description="Hostname or IP of the file server")
    share: str = Field(..., description="Share name (e.g. HR_Documents)")
    username: str = Field(..., description="SMB username")
    password: str = Field(..., description="SMB password")
    domain: Optional[str] = Field(default=None, description="Windows domain (optional)")
    path: str = Field(default="/", description="Path within the share to walk")


class ExchangeConfig(BaseModel):
    """Exchange / Outlook email connector (EWS or IMAP)."""

    server: str = Field(..., description="Mail server hostname (e.g. mail.company.com)")
    username: str = Field(..., description="Email account username")
    password: str = Field(..., description="Email account password")
    folder_path: str = Field(default="Inbox", description="Mail folder to ingest (e.g. Inbox/HR Archive)")
    protocol: Literal["imap", "ews"] = Field(default="ews", description="Connection protocol")


class LocalConfig(BaseModel):
    """Local folder on the VPS — simplest connector, no auth needed."""

    path: str = Field(..., description="Absolute path on the VPS (e.g. /mnt/shares/HR)")


class S3Config(BaseModel):
    """S3-compatible object storage (AWS S3, MinIO, Cloudflare R2, etc.)."""

    bucket: str = Field(..., description="S3 bucket name")
    prefix: str = Field(default="", description="Key prefix / folder within the bucket")
    region: str = Field(default="us-east-1", description="AWS region")
    access_key_id: str = Field(..., description="AWS access key ID")
    secret_access_key: str = Field(..., description="AWS secret access key")
    endpoint_url: Optional[str] = Field(default=None, description="Custom endpoint for MinIO / R2 / etc.")


# ── CRUD schemas ──────────────────────────────────────────────────────────────


class KnowledgeSourceCreate(BaseModel):
    """Body for POST /knowledge-sources."""

    name: str = Field(..., min_length=1, max_length=200)
    department: Optional[str] = None
    source_type: Literal["sharepoint", "smb", "exchange", "local", "s3"]
    config: dict[str, Any] = Field(..., description="Connector configuration (type-specific)")
    is_active: bool = True


class KnowledgeSourceUpdate(BaseModel):
    """Body for PATCH /knowledge-sources/{id} — all fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    department: Optional[str] = None
    status: Optional[Literal["active", "inactive", "error", "syncing"]] = None
    config: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class KnowledgeSourceResponse(BaseModel):
    """Serialised knowledge source returned to the client (raw credentials masked)."""

    id: str
    name: str
    department: Optional[str]
    source_type: str
    config: Optional[dict[str, Any]]  # credentials replaced with "***"
    status: str
    is_active: bool
    last_sync_at: Optional[datetime]
    last_sync_status: Optional[str]
    last_sync_count: Optional[int]
    last_error: Optional[str]
    created_at: datetime
    created_by: Optional[str]

    model_config = {"from_attributes": True}


# ── Test-connection request ───────────────────────────────────────────────────


class TestConnectionRequest(BaseModel):
    """Body for POST /knowledge-sources/test-connection."""

    source_type: Literal["sharepoint", "smb", "exchange", "local", "s3"]
    config: dict[str, Any]


class TestConnectionResponse(BaseModel):
    """Result of a connection test."""

    success: bool
    message: str
    files_found: Optional[int] = None


# ── Sync history entry ────────────────────────────────────────────────────────


class SyncHistoryEntry(BaseModel):
    """Single entry returned from GET /knowledge-sources/{id}/sync-history."""

    id: str
    source_id: str
    started_at: datetime
    finished_at: Optional[datetime]
    duration_seconds: Optional[float]
    files_processed: Optional[int]
    status: str  # "success" | "failed" | "partial"
    error: Optional[str]
