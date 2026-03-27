from datetime import datetime
from fastapi import APIRouter, Depends
from ..dependencies import get_client, reset_client
from ..config import get_settings
from ..services.openalgo_client import OpenAlgoClient
from ..models.schemas import HealthResponse, ConfigResponse, UpdateConfigRequest

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(client: OpenAlgoClient = Depends(get_client)):
    result = await client.ping()
    is_online = result.get("status") == "success"
    return HealthResponse(
        status="connected" if is_online else "disconnected",
        openalgo="online" if is_online else "offline",
        timestamp=datetime.now().isoformat(),
        message=result.get("message", ""),
    )


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    settings = get_settings()
    return ConfigResponse(
        host=settings.openalgo_host,
        ws_url=settings.openalgo_ws_url,
        has_api_key=bool(settings.openalgo_api_key),
    )


@router.post("/config")
async def update_config(req: UpdateConfigRequest):
    """Update API key and/or host at runtime."""
    client = reset_client(api_key=req.api_key, host=req.host)
    # Verify new credentials
    result = await client.ping()
    is_online = result.get("status") == "success"
    return {
        "status": "success" if is_online else "error",
        "message": "Connected with new credentials" if is_online else "Failed to connect with new credentials",
        "openalgo": "online" if is_online else "offline",
    }


@router.get("/analyzer")
async def analyzer_status(client: OpenAlgoClient = Depends(get_client)):
    try:
        data = await client.analyzer_status()
        return data if isinstance(data, dict) else {"status": "error", "message": "Malformed response"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/analyzer")
async def analyzer_toggle(mode: bool, client: OpenAlgoClient = Depends(get_client)):
    try:
        return await client.analyzer_toggle(mode)
    except Exception as e:
        return {"status": "error", "message": str(e)}
