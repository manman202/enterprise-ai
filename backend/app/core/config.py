"""
Central configuration — all settings loaded from environment variables / .env file.
Every setting has a description comment explaining what it controls.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Application ────────────────────────────────────────────────────────────
    app_env: str = "development"  # "development" | "production"
    app_port: int = 8000  # Port uvicorn listens on
    allowed_origins: str = (  # Comma-separated CORS origins
        "https://aiyedun.online," "https://admin.aiyedun.online," "http://localhost:3000," "http://localhost:4000"
    )

    # ── Security / JWT ─────────────────────────────────────────────────────────
    secret_key: str = "changeme"  # Min 32-char random string in production
    jwt_algorithm: str = "HS256"  # JWT signing algorithm
    jwt_expire_hours: int = 8  # Session duration (8 hours = work day)

    # ── PostgreSQL ─────────────────────────────────────────────────────────────
    postgres_host: str = "aiyedun-postgres"  # Container name or hostname
    postgres_port: int = 5432
    postgres_db: str = "aiyedun"
    postgres_user: str = "aiyedun_user"
    postgres_password: str = ""

    # ── ChromaDB (vector store) ────────────────────────────────────────────────
    chroma_host: str = "aiyedun-chromadb"  # Container name or hostname
    chroma_port: int = 8000

    # ── Ollama (local LLM) ─────────────────────────────────────────────────────
    ollama_host: str = "aiyedun-ollama"  # Container name or hostname
    ollama_port: int = 11434
    ollama_model: str = "mistral"  # Model name pulled into Ollama

    # ── Active Directory / LDAP ────────────────────────────────────────────────
    # Leave AD_SERVER empty to disable LDAP and use local DB auth (dev mode)
    ad_server: str = ""  # e.g. ldap://192.168.1.10
    ad_domain: str = ""  # e.g. yourcompany.local
    ad_base_dn: str = ""  # e.g. DC=yourcompany,DC=local
    ad_service_account: str = ""  # Read-only service account username
    ad_service_password: str = ""  # Service account password

    # ── Embeddings ─────────────────────────────────────────────────────────────
    embedding_model: str = "all-MiniLM-L6-v2"  # Local sentence-transformers model

    # ── File Watching (Phase 8) ────────────────────────────────────────────────
    watched_paths: str = "[]"  # JSON array of {path, department}
    passerelle_path: str = "/mnt/shares/Passerelle"  # Drop zone for manual ingestion

    # ── Teams Integration (Phase 8, optional) ─────────────────────────────────
    teams_app_id: str = ""
    teams_app_password: str = ""
    teams_tenant_id: str = ""

    # ── Computed properties ────────────────────────────────────────────────────

    @property
    def database_url(self) -> str:
        """Async PostgreSQL connection string for SQLAlchemy."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def chroma_url(self) -> str:
        """HTTP URL for ChromaDB REST API."""
        return f"http://{self.chroma_host}:{self.chroma_port}"

    @property
    def ollama_url(self) -> str:
        """HTTP URL for Ollama REST API."""
        return f"http://{self.ollama_host}:{self.ollama_port}"

    @property
    def cors_origins(self) -> list[str]:
        """Parsed list of allowed CORS origins."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def ldap_enabled(self) -> bool:
        """True when AD_SERVER is configured — enables LDAP authentication."""
        return bool(self.ad_server)


settings = Settings()
