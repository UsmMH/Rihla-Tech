from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://rihlatech:rihlatech@localhost:5433/rihlatech"
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    api_prefix: str = "/api"
    jwt_secret: str = "dev-only-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    llm_provider: str = "auto"  # auto | openrouter | gemini | openai
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_site_url: str = "http://localhost:5173"
    openrouter_app_name: str = "RihlaTech"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    openai_api_key: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
