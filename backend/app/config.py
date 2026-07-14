"""Environment-driven application settings."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite mode (default=True for local dev — no Postgres install needed)
    use_sqlite: bool = True

    # PostgreSQL (only used when use_sqlite=False)
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "kavach"
    postgres_password: str = "kavach_dev_password"
    postgres_db: str = "kavach"

    # Neo4j (optional — graph features disabled when unavailable)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "kavach_dev_password"

    # Classifier LLM (blank → deterministic mock classifier)
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # OTP SMS delivery — not used in demo mode
    sms_provider: str = ""
    msg91_auth_key: str = ""
    msg91_template_id: str = ""
    msg91_otp_expiry_minutes: int = 5
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    twilio_whatsapp_number: str = ""  # e.g. whatsapp:+14155238886 (Twilio sandbox)

    # ── Intelligence Pipeline ──────────────────────────────────────────────

    # GNews API key (https://gnews.io)
    gnews_api_key: str = ""

    # NewsAPI.org key (optional, paid plan for production)
    news_api_key: str = ""

    # Google Geocoding API key (optional, falls back to Nominatim if absent)
    google_geocoding_api_key: str = ""

    # Gemini API key for AI extraction
    gemini_api_key: str = ""
    
    # Groq API key for LLM Bot
    groq_api_key: str = ""

    # Pipeline scheduler interval in minutes (default: 30)
    pipeline_interval_minutes: int = 30

    # Nominatim rate-limit delay in seconds (must be >= 1.0 per their ToS)
    geocode_delay_seconds: float = 1.1

    # Whether to run the pipeline immediately on startup (vs waiting for first interval)
    run_pipeline_on_startup: bool = False

    @property
    def database_url(self) -> str:
        if self.use_sqlite:
            return "sqlite:///./kavach.db"
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def use_mock_classifier(self) -> bool:
        return not self.llm_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
