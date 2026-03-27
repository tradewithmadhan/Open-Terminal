import re
from typing import Any


class CommandParser:
    """Parse Bloomberg-style terminal commands into executable actions."""

    @staticmethod
    def parse(command: str) -> dict[str, Any]:
        """Parse a command string into an action dictionary."""
        raw = command.strip()
        if not raw:
            return {"action": "none", "error": "Empty command"}

        # Remove leading /
        if raw.startswith("/"):
            raw = raw[1:]

        parts = raw.split()
        cmd = parts[0].lower()
        args = parts[1:]

        # Extract keyword arguments (key=value)
        kwargs: dict[str, str] = {}
        positional: list[str] = []
        for arg in args:
            if "=" in arg:
                key, value = arg.split("=", 1)
                kwargs[key.lower()] = value.upper() if key.lower() in ("exchange", "product", "pricetype") else value
            else:
                positional.append(arg)

        # Route to specific parser
        parsers = {
            "buy": CommandParser._parse_order,
            "sell": CommandParser._parse_order,
            "cancel": CommandParser._parse_cancel,
            "exit": CommandParser._parse_exit,
            "modify": CommandParser._parse_modify,
            "quote": CommandParser._parse_quote,
            "q": CommandParser._parse_quote,
            "depth": CommandParser._parse_depth,
            "watch": CommandParser._parse_watch,
            "w": CommandParser._parse_watch,
            "unwatch": CommandParser._parse_unwatch,
            "positions": CommandParser._parse_simple,
            "pos": CommandParser._parse_simple,
            "orders": CommandParser._parse_simple,
            "trades": CommandParser._parse_simple,
            "funds": CommandParser._parse_simple,
            "holdings": CommandParser._parse_simple,
            "chain": CommandParser._parse_chain,
            "greeks": CommandParser._parse_greeks,
            "expiry": CommandParser._parse_expiry,
            "ping": CommandParser._parse_simple,
            "help": CommandParser._parse_help,
            "mode": CommandParser._parse_mode,
            "alert": CommandParser._parse_alert,
            "export": CommandParser._parse_export,
            "clear": CommandParser._parse_simple,
        }

        parser_fn = parsers.get(cmd)
        if not parser_fn:
            return {
                "action": "unknown",
                "raw": command,
                "error": f"Unknown command: /{cmd}. Type /help for available commands.",
            }

        result = parser_fn(cmd, positional, kwargs)
        result["raw"] = command
        return result

    @staticmethod
    def _parse_order(cmd: str, args: list[str], kwargs: dict) -> dict:
        """Parse /buy or /sell command."""
        action = cmd.upper()  # BUY or SELL

        if len(args) < 2:
            return {
                "action": "error",
                "error": f"Usage: /{cmd} SYMBOL QTY [PRICE] [exchange=NSE] [product=MIS]",
            }

        symbol = args[0].upper()
        quantity = args[1]

        # Validate quantity is a number
        try:
            int(quantity)
        except ValueError:
            return {"action": "error", "error": f"Invalid quantity: {quantity}"}

        # Optional price (if provided, use LIMIT; else MARKET)
        price = "0"
        pricetype = "MARKET"
        if len(args) >= 3:
            try:
                price = args[2]
                float(price)
                pricetype = "LIMIT"
            except ValueError:
                return {"action": "error", "error": f"Invalid price: {args[2]}"}

        # Determine exchange and product
        exchange = kwargs.get("exchange", "NSE")
        product = kwargs.get("product", "MIS")

        # Auto-detect F&O
        if any(symbol.endswith(x) for x in ["CE", "PE", "FUT"]):
            if exchange == "NSE":
                exchange = "NFO"
            if product == "MIS":
                product = "NRML"

        return {
            "action": "place_order",
            "data": {
                "strategy": "TERMINAL",
                "symbol": symbol,
                "action": action,
                "exchange": exchange,
                "pricetype": pricetype,
                "product": product,
                "quantity": quantity,
                "price": price,
                "trigger_price": "0",
                "disclosed_quantity": "0",
            },
        }

    @staticmethod
    def _parse_cancel(cmd: str, args: list[str], kwargs: dict) -> dict:
        """Parse /cancel command."""
        if not args:
            return {"action": "error", "error": "Usage: /cancel ORDERID  or  /cancel all"}

        if args[0].lower() == "all":
            strategy = kwargs.get("strategy")
            return {"action": "cancel_all", "data": {"strategy": strategy}}

        return {"action": "cancel_order", "data": {"orderid": args[0]}}

    @staticmethod
    def _parse_exit(cmd: str, args: list[str], kwargs: dict) -> dict:
        """Parse /exit command."""
        if not args:
            return {"action": "error", "error": "Usage: /exit SYMBOL  or  /exit all"}

        if args[0].lower() == "all":
            strategy = kwargs.get("strategy")
            return {"action": "close_all", "data": {"strategy": strategy}}

        symbol = args[0].upper()
        exchange = kwargs.get("exchange", "NSE")
        product = kwargs.get("product", "MIS")

        if any(symbol.endswith(x) for x in ["CE", "PE", "FUT"]):
            if exchange == "NSE":
                exchange = "NFO"
            if product == "MIS":
                product = "NRML"

        return {
            "action": "exit_position",
            "data": {
                "symbol": symbol,
                "exchange": exchange,
                "product": product,
            },
        }

    @staticmethod
    def _parse_modify(cmd: str, args: list[str], kwargs: dict) -> dict:
        """Parse /modify command."""
        if len(args) < 3:
            return {"action": "error", "error": "Usage: /modify ORDERID QTY PRICE"}
        return {
            "action": "modify_order",
            "data": {
                "orderid": args[0],
                "quantity": args[1],
                "price": args[2],
            },
        }

    @staticmethod
    def _parse_quote(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /quote SYMBOL [exchange=NSE]"}
        symbol = args[0].upper()
        exchange = kwargs.get("exchange", "NSE")
        if any(symbol.endswith(x) for x in ["CE", "PE", "FUT"]):
            exchange = kwargs.get("exchange", "NFO")
        return {"action": "quote", "data": {"symbol": symbol, "exchange": exchange}}

    @staticmethod
    def _parse_depth(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /depth SYMBOL [exchange=NSE]"}
        symbol = args[0].upper()
        exchange = kwargs.get("exchange", "NSE")
        return {"action": "depth", "data": {"symbol": symbol, "exchange": exchange}}

    @staticmethod
    def _parse_watch(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /watch SYMBOL [exchange=NSE]"}
        symbol = args[0].upper()
        exchange = kwargs.get("exchange", "NSE")
        if symbol in ("NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY"):
            exchange = "BSE_INDEX" if symbol == "SENSEX" else "NSE_INDEX"
        return {"action": "watch", "data": {"symbol": symbol, "exchange": exchange}}

    @staticmethod
    def _parse_unwatch(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /unwatch SYMBOL"}
        return {"action": "unwatch", "data": {"symbol": args[0].upper()}}

    @staticmethod
    def _parse_simple(cmd: str, args: list[str], kwargs: dict) -> dict:
        # Map aliases
        action_map = {
            "positions": "positions", "pos": "positions",
            "orders": "orders", "trades": "trades",
            "funds": "funds", "holdings": "holdings",
            "ping": "ping", "clear": "clear",
        }
        return {"action": action_map.get(cmd, cmd)}

    @staticmethod
    def _parse_chain(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /chain UNDERLYING [expiry=30JAN25] [strikes=10]"}
        underlying = args[0].upper()
        exchange = "BSE_INDEX" if underlying == "SENSEX" else "NSE_INDEX"
        return {
            "action": "chain",
            "data": {
                "underlying": underlying,
                "exchange": exchange,
                "expiry": kwargs.get("expiry", ""),
                "strikes": int(kwargs.get("strikes", "10")),
            },
        }

    @staticmethod
    def _parse_greeks(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /greeks OPTION_SYMBOL [exchange=NFO]"}
        return {
            "action": "greeks",
            "data": {
                "symbol": args[0].upper(),
                "exchange": kwargs.get("exchange", "NFO"),
            },
        }

    @staticmethod
    def _parse_expiry(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "error", "error": "Usage: /expiry SYMBOL"}
        return {
            "action": "expiry",
            "data": {"symbol": args[0].upper(), "exchange": "NFO"},
        }

    @staticmethod
    def _parse_alert(cmd: str, args: list[str], kwargs: dict) -> dict:
        """Parse /alert SYMBOL ABOVE/BELOW PRICE"""
        if len(args) < 3:
            return {"action": "error", "error": "Usage: /alert SYMBOL above|below PRICE"}
        symbol = args[0].upper()
        condition = args[1].lower()
        if condition not in ('above', 'below', 'cross_above', 'cross_below'):
            return {"action": "error", "error": "Condition must be: above, below, cross_above, cross_below"}
        try:
            price = float(args[2])
        except ValueError:
            return {"action": "error", "error": f"Invalid price: {args[2]}"}
        exchange = kwargs.get("exchange", "NSE")
        return {
            "action": "alert",
            "data": {"symbol": symbol, "exchange": exchange, "condition": condition, "price": price},
        }

    @staticmethod
    def _parse_help(cmd: str, args: list[str], kwargs: dict) -> dict:
        topic = args[0].lower() if args else ""
        return {"action": "help", "data": {"topic": topic}}

    @staticmethod
    def _parse_mode(cmd: str, args: list[str], kwargs: dict) -> dict:
        if not args:
            return {"action": "mode_status"}
        mode = args[0].lower()
        if mode not in ("live", "paper"):
            return {"action": "error", "error": "Usage: /mode [live|paper]"}
        return {"action": "mode_toggle", "data": {"mode": mode == "paper"}}

    @staticmethod
    def _parse_export(cmd: str, args: list[str], kwargs: dict) -> dict:
        """Parse /export [orders|trades|positions|holdings] command."""
        target = args[0].lower() if args else "all"
        if target not in ("orders", "trades", "positions", "holdings", "all"):
            return {
                "action": "error",
                "error": "Usage: /export [orders|trades|positions|holdings|all]",
            }
        return {"action": "export", "data": {"target": target}}
