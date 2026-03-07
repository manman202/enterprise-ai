from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    secret_key: str = "changeme"

    # PostgreSQL
    postgres_host: str = "aiyedun-postgres"
    postgres_port: int = 5432
    postgres_db: str = "aiyedun"
    postgres_user: str = "aiyedun_user"
    postgres_password: str = ""

    # ChromaDB
    chroma_host: str = "aiyedun-chromadb"
    chroma_port: int = 8000

    # Ollama
    ollama_host: str = "aiyedun-ollama"
    ollama_port: int = 11434
    ollama_model: str = "mistral"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def chroma_url(self) -> str:
        return f"http://{self.chroma_host}:{self.chroma_port}"

    @property
    def ollama_url(self) -> str:
        return f"http://{self.ollama_host}:{self.ollama_port}"


settings = Settings()
