from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..dependencies import get_client
from ..services.openalgo_client import OpenAlgoClient
from ..services.command_parser import CommandParser

router = APIRouter()


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    status: str
    command: str
    action: str
    output: str
    data: dict | None = None


HELP_TEXT = """
╔══════════════════════════════════════════════════════╗
║              OPEN-TERMINAL COMMANDS                  ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  TRADING                                             ║
║  /buy SYMBOL QTY [PRICE] [exchange=X] [product=X]   ║
║  /sell SYMBOL QTY [PRICE] [exchange=X] [product=X]  ║
║  /cancel ORDERID                                     ║
║  /cancel all                                         ║
║  /exit SYMBOL                                        ║
║  /exit all                    ⚠ CLOSES ALL POSITIONS ║
║  /modify ORDERID QTY PRICE                           ║
║                                                      ║
║  MARKET DATA                                         ║
║  /quote SYMBOL    (/q SYMBOL)                        ║
║  /depth SYMBOL                                       ║
║  /watch SYMBOL    (/w SYMBOL)                        ║
║  /unwatch SYMBOL                                     ║
║                                                      ║
║  PORTFOLIO                                           ║
║  /positions  (/pos)                                  ║
║  /orders                                             ║
║  /trades                                             ║
║  /funds                                              ║
║  /holdings                                           ║
║                                                      ║
║  OPTIONS                                             ║
║  /chain UNDERLYING [expiry=30JAN25] [strikes=10]    ║
║  /greeks OPTION_SYMBOL                               ║
║  /expiry SYMBOL                                      ║
║                                                      ║
║  SYSTEM                                              ║
║  /ping         — Check connection                    ║
║  /mode         — Show current mode                   ║
║  /mode live    — Switch to live trading               ║
║  /mode paper   — Switch to paper trading              ║
║  /alert SYMBOL cond PRICE                             ║
║  /clear        — Clear command history                ║
║  /help         — Show this help                      ║
║                                                      ║
║  EXAMPLES                                            ║
║  /buy RELIANCE 100                   (Market order)  ║
║  /sell SBIN 50 845.50                (Limit @ 845.5) ║
║  /buy NIFTY30JAN2525000CE 65         (F&O auto-NFO)  ║
║  /quote INFY                         (Quick quote)   ║
║  /chain NIFTY expiry=30JAN25 strikes=5               ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
""".strip()

HELP_TOPICS = {
    "buy": "Usage: /buy SYMBOL QTY [PRICE] [exchange=NSE] [product=MIS]\n\nExamples:\n  /buy RELIANCE 100           → Market order, NSE, MIS\n  /buy SBIN 200 845.50        → Limit order @ 845.50\n  /buy NIFTY25JAN25CE 65      → Auto-detects NFO, NRML\n  /buy TCS 50 exchange=BSE    → On BSE exchange\n  /buy RELIANCE 100 product=CNC → Delivery order",
    "sell": "Usage: /sell SYMBOL QTY [PRICE] [exchange=NSE] [product=MIS]\n(Same options as /buy)",
    "cancel": "Usage: /cancel ORDERID\n       /cancel all [strategy=X]\n\nExamples:\n  /cancel 250701234           → Cancel specific order\n  /cancel all                 → Cancel ALL open orders\n  /cancel all strategy=TERMINAL → Cancel only TERMINAL orders",
    "exit": "Usage: /exit SYMBOL [exchange=NSE] [product=MIS]\n       /exit all\n\n⚠ /exit all CLOSES ALL POSITIONS with MARKET orders!\n\nExamples:\n  /exit RELIANCE              → Exit RELIANCE position\n  /exit NIFTY25JAN2525000CE   → Exit option position\n  /exit all                   → Exit EVERYTHING",
    "quote": "Usage: /quote SYMBOL [exchange=NSE]\nAlias: /q SYMBOL\n\nShows LTP, bid, ask, volume, OI",
    "chain": "Usage: /chain UNDERLYING [expiry=DDMMMYY] [strikes=N]\n\nExamples:\n  /chain NIFTY                → Nearest expiry, ±10 strikes\n  /chain BANKNIFTY expiry=30JAN25 strikes=5",
    "mode": "Usage: /mode [live|paper]\n\n  /mode        → Show current mode\n  /mode live   → Switch to live trading\n  /mode paper  → Switch to paper trading (₹1Cr virtual)",
    "alert": "Usage: /alert SYMBOL above|below PRICE\n\nExample:\n  /alert RELIANCE above 2850.50",
}


@router.post("/execute", response_model=CommandResponse)
async def execute_command(
    req: CommandRequest,
    client: OpenAlgoClient = Depends(get_client),
):
    parsed = CommandParser.parse(req.command)
    action = parsed.get("action", "unknown")

    try:
        # ─── Help ──────────────────────────────
        if action == "help":
            topic = parsed.get("data", {}).get("topic", "")
            if topic and topic in HELP_TOPICS:
                output = HELP_TOPICS[topic]
            else:
                output = HELP_TEXT
            return CommandResponse(
                status="success", command=req.command,
                action="help", output=output,
            )

        # ─── Clear ─────────────────────────────
        if action == "clear":
            return CommandResponse(
                status="success", command=req.command,
                action="clear", output="Command history cleared.",
            )

        # ─── Ping ──────────────────────────────
        if action == "ping":
            result = await client.ping()
            online = result.get("status") == "success"
            return CommandResponse(
                status="success", command=req.command,
                action="ping",
                output=f"OpenAlgo: {'🟢 ONLINE' if online else '🔴 OFFLINE'} — {result.get('message', '')}",
            )

        # ─── Mode ──────────────────────────────
        if action == "mode_status":
            result = await client.analyzer_status()
            enabled = result.get("analyzer_enabled", False)
            return CommandResponse(
                status="success", command=req.command,
                action="mode",
                output=f"Current mode: {'📋 PAPER TRADING' if enabled else '🔴 LIVE TRADING'}",
            )

        if action == "mode_toggle":
            mode = parsed["data"]["mode"]
            result = await client.analyzer_toggle(mode)
            label = "PAPER TRADING" if mode else "LIVE TRADING"
            return CommandResponse(
                status="success", command=req.command,
                action="mode",
                output=f"Switched to: {label}",
            )

        # ─── Place Order ───────────────────────
        if action == "place_order":
            d = parsed["data"]
            result = await client.place_order(
                strategy=d["strategy"], symbol=d["symbol"],
                action=d["action"], exchange=d["exchange"],
                pricetype=d["pricetype"], product=d["product"],
                quantity=d["quantity"], price=d["price"],
                trigger_price=d.get("trigger_price", "0"),
                disclosed_quantity=d.get("disclosed_quantity", "0"),
            )
            if result.get("status") == "success":
                oid = result.get("orderid", "?")
                mode = result.get("mode", "live")
                price_info = f"@ {d['pricetype']}" if d["pricetype"] == "MARKET" else f"@ ₹{d['price']}"
                output = f"✓ Order placed: {d['action']} {d['quantity']} × {d['symbol']} {price_info} ({mode}) — #{oid}"
            else:
                output = f"✗ Order failed: {result.get('message', 'Unknown error')}"
            return CommandResponse(
                status=result.get("status", "error"),
                command=req.command, action="place_order",
                output=output, data=result,
            )

        # ─── Cancel Order ──────────────────────
        if action == "cancel_order":
            oid = parsed["data"]["orderid"]
            result = await client.cancel_order(oid)
            if result.get("status") == "success":
                output = f"✓ Order cancelled: #{oid}"
            else:
                output = f"✗ Cancel failed: {result.get('message', 'Unknown error')}"
            return CommandResponse(
                status=result.get("status", "error"),
                command=req.command, action="cancel_order",
                output=output, data=result,
            )

        # ─── Cancel All ───────────────────────
        if action == "cancel_all":
            strategy = parsed["data"].get("strategy")
            result = await client.cancel_all_orders(strategy)
            output = f"✓ All orders cancelled" if result.get("status") == "success" else f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status=result.get("status", "error"),
                command=req.command, action="cancel_all",
                output=output, data=result,
            )

        # ─── Exit Position ─────────────────────
        if action == "exit_position":
            d = parsed["data"]
            # First check position
            pos_result = await client.open_position(d["symbol"], d["exchange"], d["product"])
            qty = int(pos_result.get("quantity", "0"))
            if qty == 0:
                output = f"✗ No open position for {d['symbol']}"
            else:
                exit_action = "SELL" if qty > 0 else "BUY"
                result = await client.place_order(
                    strategy="TERMINAL", symbol=d["symbol"],
                    action=exit_action, exchange=d["exchange"],
                    pricetype="MARKET", product=d["product"],
                    quantity=str(abs(qty)),
                )
                if result.get("status") == "success":
                    output = f"✓ Exit order: {exit_action} {abs(qty)} × {d['symbol']} @ MARKET — #{result.get('orderid', '?')}"
                else:
                    output = f"✗ Exit failed: {result.get('message', 'Unknown error')}"
            return CommandResponse(
                status="success", command=req.command,
                action="exit_position", output=output,
            )

        # ─── Close All ────────────────────────
        if action == "close_all":
            strategy = parsed["data"].get("strategy")
            result = await client.close_all_positions(strategy)
            output = f"⚠ ALL POSITIONS CLOSED" if result.get("status") == "success" else f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status=result.get("status", "error"),
                command=req.command, action="close_all",
                output=output, data=result,
            )

        # ─── Quote ─────────────────────────────
        if action == "quote":
            d = parsed["data"]
            result = await client.quotes(d["symbol"], d["exchange"])
            if result.get("status") == "success":
                ltp = result.get("ltp", 0)
                bid = result.get("bid", 0)
                ask = result.get("ask", 0)
                vol = result.get("volume", 0)
                oi = result.get("oi", 0)
                output = (
                    f"{d['symbol']} ({d['exchange']})\n"
                    f"  LTP: ₹{ltp:,.2f}    Bid: ₹{bid:,.2f}    Ask: ₹{ask:,.2f}\n"
                    f"  Volume: {vol:,}    OI: {oi:,}"
                )
            else:
                output = f"✗ Quote failed: {result.get('message', 'Unknown error')}"
            return CommandResponse(
                status=result.get("status", "error"),
                command=req.command, action="quote",
                output=output, data=result,
            )

        # ─── Positions ────────────────────────
        if action == "positions":
            result = await client.position_book()
            if result.get("status") == "success":
                positions = result.get("data", [])
                if not positions:
                    output = "No open positions"
                else:
                    lines = [f"{'Symbol':<20} {'Qty':>6} {'Avg':>10} {'LTP':>10} {'P&L':>12}"]
                    lines.append("─" * 62)
                    for p in positions:
                        qty = int(p.get("quantity", p.get("netqty", 0)))
                        if qty == 0:
                            continue
                        sym = p.get("symbol", p.get("tradingsymbol", "?"))[:20]
                        avg = float(p.get("averageprice", p.get("average_price", 0)))
                        ltp = float(p.get("lastprice", p.get("lastprice", 0)))
                        pnl = (ltp - avg) * qty
                        lines.append(f"{sym:<20} {qty:>6} {avg:>10.2f} {ltp:>10.2f} {'+'if pnl>=0 else ''}{pnl:>11.2f}")
                    output = "\n".join(lines)
            else:
                output = f"✗ {result.get('message', 'Failed to fetch positions')}"
            return CommandResponse(
                status="success", command=req.command,
                action="positions", output=output,
            )

        # ─── Orders ───────────────────────────
        if action == "orders":
            result = await client.order_book()
            if result.get("status") == "success":
                orders = result.get("data", [])
                if not orders:
                    output = "No orders today"
                else:
                    lines = [f"{'OrderID':<16} {'Symbol':<16} {'Side':<5} {'Qty':>5} {'Price':>10} {'Status':<10}"]
                    lines.append("─" * 66)
                    for o in orders:
                        oid = str(o.get("orderid", "?"))[:16]
                        sym = (o.get("symbol", "?"))[:16]
                        side = o.get("action", "?")
                        qty = o.get("quantity", "?")
                        price = o.get("price", 0)
                        status = o.get("order_status", "?")
                        price_str = "MARKET" if o.get("pricetype") == "MARKET" else f"₹{float(price):,.2f}"
                        lines.append(f"{oid:<16} {sym:<16} {side:<5} {qty:>5} {price_str:>10} {status:<10}")
                    output = "\n".join(lines)
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="orders", output=output,
            )

        # ─── Trades ───────────────────────────
        if action == "trades":
            result = await client.trade_book()
            if result.get("status") == "success":
                trades = result.get("data", [])
                if not trades:
                    output = "No trades today"
                else:
                    output = f"{len(trades)} trades executed today"
                    for t in trades[:10]:
                        sym = t.get("symbol", "?")
                        side = t.get("action", "?")
                        qty = t.get("quantity", "?")
                        price = float(t.get("price", t.get("average_price", 0)))
                        output += f"\n  {side} {qty} × {sym} @ ₹{price:,.2f}"
                    if len(trades) > 10:
                        output += f"\n  ... and {len(trades) - 10} more"
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="trades", output=output,
            )

        # ─── Funds ────────────────────────────
        if action == "funds":
            result = await client.funds()
            if result.get("status") == "success":
                d = result.get("data", result)
                cash = float(d.get("availablecash", 0))
                collateral = float(d.get("collateral", 0))
                realized = float(d.get("m2mrealized", 0))
                unrealized = float(d.get("m2munrealized", 0))
                used = float(d.get("utiliseddebits", 0))
                total = cash + collateral
                output = (
                    f"Available Cash:  ₹{cash:>14,.2f}\n"
                    f"Collateral:      ₹{collateral:>14,.2f}\n"
                    f"Total Margin:    ₹{total:>14,.2f}\n"
                    f"Used Margin:     ₹{used:>14,.2f} ({used/total*100:.1f}%)\n"
                    f"────────────────────────────\n"
                    f"Realized P&L:    ₹{realized:>14,.2f}\n"
                    f"Unrealized P&L:  ₹{unrealized:>14,.2f}\n"
                    f"Day P&L:         ₹{realized+unrealized:>14,.2f}"
                )
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="funds", output=output,
            )

        # ─── Holdings ─────────────────────────
        if action == "holdings":
            result = await client.holdings()
            if result.get("status") == "success":
                holdings = result.get("data", [])
                if not holdings:
                    output = "No holdings"
                else:
                    output = f"{len(holdings)} holdings in portfolio"
                    for h in holdings:
                        sym = h.get("symbol", h.get("tradingsymbol", "?"))
                        qty = h.get("quantity", 0)
                        avg = float(h.get("averageprice", h.get("average_price", 0)))
                        output += f"\n  {sym}: {qty} @ ₹{avg:,.2f}"
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="holdings", output=output,
            )

        # ─── Watch / Unwatch ──────────────────
        if action == "watch":
            d = parsed["data"]
            output = f"✓ {d['symbol']} ({d['exchange']}) — add to watchlist"
            return CommandResponse(
                status="success", command=req.command,
                action="watch", output=output, data=d,
            )

        if action == "unwatch":
            d = parsed["data"]
            output = f"✓ {d['symbol']} — remove from watchlist"
            return CommandResponse(
                status="success", command=req.command,
                action="unwatch", output=output, data=d,
            )

        # ─── Alert ─────────────────────────────
        if action == "alert":
            d = parsed["data"]
            cond = "≥" if "above" in d["condition"] else "≤"
            output = f"✓ Alert set: {d['symbol']} {cond} ₹{d['price']:,.2f}"
            return CommandResponse(
                status="success", command=req.command,
                action="alert", output=output, data=d,
            )

        # ─── Depth ────────────────────────────
        if action == "depth":
            d = parsed["data"]
            result = await client.depth(d["symbol"], d["exchange"])
            if result.get("status") == "success":
                data = result.get("data", result)
                bids = data.get("bids", [])[:3]
                asks = data.get("asks", [])[:3]
                output = f"{d['symbol']} Market Depth\n"
                output += f"  {'Bid Qty':>8}  {'Bid':>10}  │  {'Ask':>10}  {'Ask Qty':>8}\n"
                for i in range(min(3, max(len(bids), len(asks)))):
                    bq = bids[i]["quantity"] if i < len(bids) else ""
                    bp = f"₹{bids[i]['price']:,.2f}" if i < len(bids) else ""
                    aq = asks[i]["quantity"] if i < len(asks) else ""
                    ap = f"₹{asks[i]['price']:,.2f}" if i < len(asks) else ""
                    output += f"  {bq:>8}  {bp:>10}  │  {ap:>10}  {aq:>8}\n"
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="depth", output=output,
            )

        # ─── Chain ────────────────────────────
        if action == "chain":
            d = parsed["data"]
            output = f"→ Opening Option Chain for {d['underlying']}"
            return CommandResponse(
                status="success", command=req.command,
                action="chain", output=output, data=d,
            )

        # ─── Greeks ───────────────────────────
        if action == "greeks":
            d = parsed["data"]
            result = await client.option_greeks(d["symbol"], d["exchange"])
            if result.get("status") == "success":
                g = result.get("greeks", {})
                iv = result.get("implied_volatility", 0)
                output = (
                    f"{d['symbol']} Greeks\n"
                    f"  IV: {iv:.2f}%\n"
                    f"  Delta: {g.get('delta', 0):.4f}    Gamma: {g.get('gamma', 0):.6f}\n"
                    f"  Theta: {g.get('theta', 0):.4f}    Vega:  {g.get('vega', 0):.4f}\n"
                    f"  Rho:   {g.get('rho', 0):.4f}"
                )
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="greeks", output=output,
            )

        # ─── Expiry ───────────────────────────
        if action == "expiry":
            d = parsed["data"]
            result = await client.expiry(d["symbol"], d["exchange"], "options")
            if result.get("status") == "success":
                dates = result.get("data", [])
                output = f"{d['symbol']} Option Expiries:\n  " + "\n  ".join(dates[:10])
                if len(dates) > 10:
                    output += f"\n  ... {len(dates) - 10} more"
            else:
                output = f"✗ {result.get('message', 'Failed')}"
            return CommandResponse(
                status="success", command=req.command,
                action="expiry", output=output,
            )

        # ─── Error / Unknown ──────────────────
        if action == "error":
            return CommandResponse(
                status="error", command=req.command,
                action="error", output=parsed.get("error", "Unknown error"),
            )

        return CommandResponse(
            status="error", command=req.command,
            action="unknown",
            output=parsed.get("error", f"Unhandled action: {action}"),
        )

    except Exception as e:
        return CommandResponse(
            status="error", command=req.command,
            action="error", output=f"Command execution error: {str(e)}",
        )
