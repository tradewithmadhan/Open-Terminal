import httpx
import logging
from typing import Any, Optional

logger = logging.getLogger("terminal.client")


class OpenAlgoClient:
    """Async HTTP client that proxies all calls to OpenAlgo REST API.

    All OpenAlgo endpoints are POST and require {"apikey": "..."} in body.
    """

    def __init__(self, api_key: str, host: str):
        self.api_key = api_key
        self.base_url = f"{host}/api/v1"
        self._cache_pc = {}  # Cache for previous close prices: {(symbol, exchange): price}
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    async def get_prev_close(self, symbol: str, exchange: str) -> float:
        """Fetch previous close from history if not in cache."""
        key = (symbol, exchange)
        if key in self._cache_pc:
            return self._cache_pc[key]
            
        import datetime
        today = datetime.date.today()
        # Fetch last 7 days to cover weekends/holidays
        start = today - datetime.timedelta(days=7)
        
        try:
            res = await self.history(symbol, exchange, "D", start.isoformat(), today.isoformat())
            if res.get("status") == "success" and res.get("data"):
                candles = res["data"]
                if not candles:
                    return 0.0
                
                # Identify the last completed day's candle
                last_candle = candles[-1]
                
                # Parse date from timestamp or date string
                ts = last_candle.get("timestamp")
                if ts:
                    # Handle both seconds and milliseconds (OpenAlgo sometimes uses ms)
                    if ts > 1e11: ts /= 1000
                    last_date = datetime.date.fromtimestamp(ts)
                else:
                    date_str = last_candle.get("date", last_candle.get("timestamp_str", ""))
                    if not date_str: return 0.0
                    last_date = datetime.date.fromisoformat(date_str[:10])
                
                # If the last candle is from today (live bar), use the one before it
                if last_date >= today:
                    if len(candles) >= 2:
                        pc = float(candles[-2].get("close", 0))
                    else:
                        return 0.0 # Only one candle and it's today
                else:
                    # Last candle is already from a previous day
                    pc = float(last_candle.get("close", 0))
                
                if pc > 0:
                    self._cache_pc[key] = pc
                    return pc
        except Exception as e:
            logger.error(f"Error fetching prev_close for {symbol}: {e}")
        return 0.0

    async def close(self):
        await self._client.aclose()

    async def _post(self, endpoint: str, data: dict[str, Any] | None = None) -> dict:
        """Core POST method. Injects API key into every request."""
        payload: dict[str, Any] = {"apikey": self.api_key}
        if data:
            payload.update(data)

        url = f"{self.base_url}/{endpoint}"
        logger.debug(f"POST {url}")

        try:
            response = await self._client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()

            if result.get("status") == "error":
                logger.warning(f"API error from {endpoint}: {result.get('message', 'Unknown')}")

            return result
        except httpx.ConnectError:
            return {"status": "error", "message": "Cannot connect to OpenAlgo. Is it running?"}
        except httpx.TimeoutException:
            return {"status": "error", "message": "Request timed out"}
        except httpx.HTTPStatusError as e:
            return {"status": "error", "message": f"HTTP {e.response.status_code}"}
        except Exception as e:
            logger.exception(f"Unexpected error calling {endpoint}")
            return {"status": "error", "message": str(e)}

    # ─── Health ────────────────────────────────────────────────

    async def ping(self) -> dict:
        return await self._post("ping")

    # ─── Market Data ──────────────────────────────────────────

    def _normalize_quote(self, data: Any) -> Any:
        """Ensure quote data has consistent field names and number types."""
        if not isinstance(data, dict):
            return data
            
        # Common LTP fields
        ltp = data.get("ltp") or data.get("last_price") or data.get("lp") or 0
        try:
            data["ltp"] = float(ltp)
        except (ValueError, TypeError):
            data["ltp"] = 0.0

        # Common Previous Close fields
        pc = data.get("prev_close") or data.get("close_price") or data.get("close") or data.get("pc") or 0
        try:
            data["prev_close"] = float(pc)
        except (ValueError, TypeError):
            data["prev_close"] = 0.0
            
        # Other fields (Volume, Bid, Ask, OI)
        for key, aliases in {
            "volume": ["v", "vol"],
            "bid": ["b", "best_bid"],
            "ask": ["a", "best_ask"],
            "oi": ["open_interest"]
        }.items():
            val = data.get(key)
            if val is None:
                for alias in aliases:
                    if alias in data:
                        val = data[alias]
                        break
            try:
                data[key] = float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                data[key] = 0.0
                
        return data

    async def quotes(self, symbol: str, exchange: str) -> dict:
        result = await self._post("quotes", {"symbol": symbol, "exchange": exchange})
        if result.get("status") == "success" and "data" in result:
            data = self._normalize_quote(result["data"])
            if not data.get("prev_close"):
                data["prev_close"] = await self.get_prev_close(symbol, exchange)
            result["data"] = data
        return result

    async def multi_quotes(self, symbols: list[dict]) -> dict:
        result = await self._post("multiquotes", {"symbols": symbols})
        if result.get("status") == "success" and "results" in result:
            # First, normalize all existing fields
            for item in result["results"]:
                if "data" in item:
                    item["data"] = self._normalize_quote(item["data"])
            
            # Second, identify missing prev_close and fetch them
            missing = []
            for item in result["results"]:
                if "data" in item and not item["data"].get("prev_close"):
                    missing.append(item)
            
            if missing:
                tasks = [self.get_prev_close(m["symbol"], m.get("exchange", "NSE")) for m in missing]
                import asyncio
                pcs = await asyncio.gather(*tasks)
                for item, pc in zip(missing, pcs):
                    item["data"]["prev_close"] = pc
                    
        return result

    async def depth(self, symbol: str, exchange: str) -> dict:
        return await self._post("depth", {"symbol": symbol, "exchange": exchange})

    async def history(
        self, symbol: str, exchange: str,
        interval: str, start_date: str, end_date: str
    ) -> dict:
        return await self._post("history", {
            "symbol": symbol, "exchange": exchange,
            "interval": interval,
            "start_date": start_date, "end_date": end_date,
        })

    # ─── Orders ───────────────────────────────────────────────

    async def place_order(
        self, strategy: str, symbol: str, action: str,
        exchange: str, pricetype: str, product: str,
        quantity: str, price: str = "0",
        trigger_price: str = "0", disclosed_quantity: str = "0"
    ) -> dict:
        return await self._post("placeorder", {
            "strategy": strategy, "symbol": symbol, "action": action,
            "exchange": exchange, "pricetype": pricetype, "product": product,
            "quantity": quantity, "price": price,
            "trigger_price": trigger_price,
            "disclosed_quantity": disclosed_quantity,
        })

    async def modify_order(
        self, orderid: str, symbol: str, action: str,
        exchange: str, pricetype: str, product: str,
        quantity: str, price: str,
        trigger_price: str = "0", strategy: Optional[str] = None
    ) -> dict:
        data: dict[str, Any] = {
            "orderid": orderid, "symbol": symbol, "action": action,
            "exchange": exchange, "pricetype": pricetype, "product": product,
            "quantity": quantity, "price": price,
            "trigger_price": trigger_price,
        }
        if strategy:
            data["strategy"] = strategy
        return await self._post("modifyorder", data)

    async def cancel_order(self, orderid: str, strategy: Optional[str] = None) -> dict:
        data: dict[str, Any] = {"orderid": orderid}
        if strategy:
            data["strategy"] = strategy
        return await self._post("cancelorder", data)

    async def cancel_all_orders(self, strategy: Optional[str] = None) -> dict:
        data: dict[str, Any] = {}
        if strategy:
            data["strategy"] = strategy
        return await self._post("cancelallorder", data)

    async def close_all_positions(self, strategy: Optional[str] = None) -> dict:
        data: dict[str, Any] = {}
        if strategy:
            data["strategy"] = strategy
        return await self._post("closeposition", data)

    async def order_status(self, orderid: str, strategy: Optional[str] = None) -> dict:
        data: dict[str, Any] = {"orderid": orderid}
        if strategy:
            data["strategy"] = strategy
        return await self._post("orderstatus", data)

    async def open_position(
        self, symbol: str, exchange: str, product: str,
        strategy: Optional[str] = None
    ) -> dict:
        data: dict[str, Any] = {"symbol": symbol, "exchange": exchange, "product": product}
        if strategy:
            data["strategy"] = strategy
        return await self._post("openposition", data)

    # ─── Account ──────────────────────────────────────────────

    async def funds(self) -> dict:
        result = await self._post("funds")
        # CRITICAL: OpenAlgo returns fund values as STRINGS
        if result.get("status") == "success" and "data" in result:
            d = result["data"]
            for key in ["availablecash", "collateral", "m2mrealized", "m2munrealized", "utiliseddebits"]:
                if key in d and isinstance(d[key], str):
                    try:
                        d[key] = float(d[key])
                    except ValueError:
                        d[key] = 0.0
        return result

    async def position_book(self) -> dict:
        return await self._post("positionbook")

    async def order_book(self) -> dict:
        return await self._post("orderbook")

    async def trade_book(self) -> dict:
        return await self._post("tradebook")

    async def holdings(self) -> dict:
        return await self._post("holdings")

    async def margin_required(self, positions: list[dict]) -> dict:
        return await self._post("margin", {"positions": positions})

    # ─── Options ──────────────────────────────────────────────

    async def option_chain(
        self, underlying: str, exchange: str,
        expiry_date: str, strike_count: Optional[int] = None
    ) -> dict:
        data: dict[str, Any] = {
            "underlying": underlying, "exchange": exchange,
            "expiry_date": expiry_date,
        }
        if strike_count is not None:
            data["strike_count"] = strike_count
        return await self._post("optionchain", data)

    async def option_greeks(self, symbol: str, exchange: str, **kwargs) -> dict:
        data: dict[str, Any] = {"symbol": symbol, "exchange": exchange}
        data.update(kwargs)
        return await self._post("optiongreeks", data)

    async def expiry(self, symbol: str, exchange: str, instrument_type: str) -> dict:
        return await self._post("expiry", {
            "symbol": symbol, "exchange": exchange,
            "instrumenttype": instrument_type,
        })

    async def option_symbol(
        self, underlying: str, exchange: str,
        expiry_date: str, option_type: str, offset: str
    ) -> dict:
        return await self._post("optionsymbol", {
            "underlying": underlying, "exchange": exchange,
            "expiry_date": expiry_date,
            "option_type": option_type, "offset": offset,
        })

    # ─── Analyzer ─────────────────────────────────────────────

    async def analyzer_status(self) -> dict:
        return await self._post("analyzer")

    async def analyzer_toggle(self, mode: bool) -> dict:
        return await self._post("analyzer", {"mode": mode})

    # ─── Calendar ─────────────────────────────────────────────

    async def holidays(self, year: str) -> dict:
        return await self._post("holidays", {"year": year})

    async def timings(self, date: str) -> dict:
        return await self._post("timings", {"date": date})
