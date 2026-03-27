import uvicorn
from app.config import get_settings

VERSION = "1.0.0"


def main():
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.terminal_port,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
