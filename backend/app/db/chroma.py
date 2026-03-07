import chromadb
from chromadb import AsyncHttpClient

from app.core.config import settings

_client: AsyncHttpClient | None = None


async def get_chroma() -> AsyncHttpClient:
    global _client
    if _client is None:
        _client = await chromadb.AsyncHttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
    return _client
