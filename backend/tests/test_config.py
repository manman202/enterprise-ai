import pytest
from app.core.config import Settings


def test_database_url():
    s = Settings(
        postgres_user="user",
        postgres_password="pass",
        postgres_host="db",
        postgres_port=5432,
        postgres_db="mydb",
    )
    assert s.database_url == "postgresql+asyncpg://user:pass@db:5432/mydb"


def test_chroma_url():
    s = Settings(chroma_host="chromahost", chroma_port=9000)
    assert s.chroma_url == "http://chromahost:9000"


def test_ollama_url():
    s = Settings(ollama_host="ollamahost", ollama_port=11434)
    assert s.ollama_url == "http://ollamahost:11434"
