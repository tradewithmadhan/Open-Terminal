from .config import get_settings
from .services.openalgo_client import OpenAlgoClient

# Singleton client instance
_client: OpenAlgoClient | None = None


def get_client() -> OpenAlgoClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = OpenAlgoClient(
            api_key=settings.openalgo_api_key,
            host=settings.openalgo_host,
        )
    return _client


def reset_client(api_key: str | None = None, host: str | None = None):
    """Reset client with new credentials (used by settings update endpoint)."""
    global _client
    settings = get_settings()
    _client = OpenAlgoClient(
        api_key=api_key or settings.openalgo_api_key,
        host=host or settings.openalgo_host,
    )
    return _client
