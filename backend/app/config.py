from pydantic_settings import BaseSettings
from functools import lru_cache
import json


class Settings(BaseSettings):
    openalgo_api_key: str = ""
    openalgo_host: str = "http://127.0.0.1:5000"
    openalgo_ws_url: str = "ws://127.0.0.1:5000/ws"
    terminal_port: int = 8000
    cors_origins: str = '["http://localhost:3000","http://127.0.0.1:3000"]'

    @property
    def cors_origins_list(self) -> list[str]:
        try:
            return json.loads(self.cors_origins)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000"]

    @property
    def openalgo_base_url(self) -> str:
        return f"{self.openalgo_host}/api/v1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
