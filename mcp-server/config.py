import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    base_url: str = Field(
        default_factory=lambda: os.getenv("EASYEA_BASE_URL", "http://localhost:8000/api").rstrip("/")
    )
    api_key: str = Field(
        default_factory=lambda: os.getenv("EASYEA_API_KEY", "")
    )
    default_model_id: str = Field(
        default_factory=lambda: os.getenv("EASYEA_DEFAULT_MODEL_ID", "sample-easybank-ea")
    )
    timeout: float = Field(
        default_factory=lambda: float(os.getenv("EASYEA_TIMEOUT_SECONDS", "20.0"))
    )


settings = Settings()
