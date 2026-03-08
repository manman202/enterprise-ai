"""Pydantic schemas for document endpoints."""

from datetime import datetime

from pydantic import BaseModel


class DocumentOut(BaseModel):
    """Document metadata returned by the API."""
    id: str
    filename: str
    department: str | None = None
    size: int
    file_hash: str | None = None
    status: str                          # "pending" | "ingested" | "failed"
    chunks_count: int | None = None
    ingested_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
