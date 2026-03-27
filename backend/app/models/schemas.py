from pydantic import BaseModel
from typing import Optional, Literal

# ─── Health ───────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    openalgo: str
    timestamp: str
    message: str = ""


class ConfigResponse(BaseModel):
    host: str
    ws_url: str
    has_api_key: bool


class UpdateConfigRequest(BaseModel):
    api_key: Optional[str] = None
    host: Optional[str] = None
    ws_url: Optional[str] = None

# ─── Market Data ─────────────────────────────────────


class QuoteRequest(BaseModel):
    symbol: str
    exchange: str


class MultiQuoteRequest(BaseModel):
    symbols: list[QuoteRequest]


class DepthRequest(BaseModel):
    symbol: str
    exchange: str


class HistoryRequest(BaseModel):
    symbol: str
    exchange: str
    interval: str  # 1m, 5m, 15m, 1h, D, W, M
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD

# ─── Orders ──────────────────────────────────────────


class PlaceOrderRequest(BaseModel):
    strategy: str = "TERMINAL"
    symbol: str
    action: Literal["BUY", "SELL"]
    exchange: str
    pricetype: Literal["MARKET", "LIMIT", "SL", "SL-M"]
    product: Literal["MIS", "CNC", "NRML"]
    quantity: str
    price: str = "0"
    trigger_price: str = "0"
    disclosed_quantity: str = "0"


class ModifyOrderRequest(BaseModel):
    orderid: str
    symbol: str
    action: Literal["BUY", "SELL"]
    exchange: str
    pricetype: Literal["MARKET", "LIMIT", "SL", "SL-M"]
    product: Literal["MIS", "CNC", "NRML"]
    quantity: str
    price: str
    trigger_price: str = "0"
    strategy: Optional[str] = None


class CancelOrderRequest(BaseModel):
    orderid: str
    strategy: Optional[str] = None


class StrategyFilter(BaseModel):
    strategy: Optional[str] = None


class OrderStatusRequest(BaseModel):
    orderid: str
    strategy: Optional[str] = None

# ─── Options ─────────────────────────────────────────


class OptionChainRequest(BaseModel):
    underlying: str
    exchange: str
    expiry_date: str  # DDMMMYY format e.g. "30JAN25"
    strike_count: Optional[int] = None


class OptionGreeksRequest(BaseModel):
    symbol: str
    exchange: str
    interest_rate: Optional[float] = None
    underlying_symbol: Optional[str] = None
    underlying_exchange: Optional[str] = None


class ExpiryRequest(BaseModel):
    symbol: str
    exchange: str
    instrument_type: Literal["futures", "options"]


class OptionSymbolRequest(BaseModel):
    underlying: str
    exchange: str
    expiry_date: str
    option_type: Literal["CE", "PE"]
    offset: str  # ATM, OTM1, OTM5, ITM3, etc.

# ─── Analyzer ────────────────────────────────────────


class AnalyzerToggleRequest(BaseModel):
    mode: bool  # True = paper, False = live
