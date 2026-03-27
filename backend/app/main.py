from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import httpx

from .config import get_settings
from .routers import health, market_data, orders, portfolio, options, command
from .services.ws_bridge import ws_bridge_endpoint

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("terminal")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("=" * 60)
    logger.info(" OPEN-TERMINAL — Starting")
    logger.info(f" OpenAlgo Host: {settings.openalgo_host}")
    logger.info(f" WebSocket: {settings.openalgo_ws_url}")
    logger.info(f" API Key: {'***' + settings.openalgo_api_key[-4:] if len(settings.openalgo_api_key) > 4 else '(not set)'}")
    logger.info("=" * 60)
    yield
    logger.info("Open-Terminal — Shutting down")


app = FastAPI(
    title="Open-Terminal API",
    description="Bloomberg-style terminal backend for OpenAlgo",
    version="1.0.0",
    lifespan=lifespan,
)

# Global Exception Handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception in {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": f"Internal Server Error: {str(exc)}"}
    )

@app.exception_handler(httpx.HTTPError)
async def httpx_exception_handler(request: Request, exc: httpx.HTTPError):
    logger.warning(f"Upstream API error: {str(exc)}")
    return JSONResponse(
        status_code=502,
        content={"status": "error", "message": "Upstream OpenAlgo API error"}
    )

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(market_data.router, prefix="/api/market", tags=["Market Data"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(options.router, prefix="/api/options", tags=["Options"])
app.include_router(command.router, prefix="/api/command", tags=["Command"])

# WebSocket endpoint for live market data bridge
app.add_api_websocket_route("/ws/market", ws_bridge_endpoint)
