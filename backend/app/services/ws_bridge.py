"""
WebSocket bridge: Browser ↔ FastAPI ↔ OpenAlgo WebSocket (port 8765)

The browser connects to FastAPI's /ws/market endpoint.
FastAPI maintains a connection to OpenAlgo's WebSocket at ws://127.0.0.1:8765
and forwards subscribe/unsubscribe/data messages bidirectionally.
"""

import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
import websockets

from ..config import get_settings

logger = logging.getLogger("terminal.ws_bridge")


async def ws_bridge_endpoint(browser_ws: WebSocket):
    """Bridge WebSocket messages between browser and OpenAlgo with resilient auth and host fallback."""
    await browser_ws.accept()
    settings = get_settings()
    api_key = settings.openalgo_api_key
    
    # Queue to buffer messages from browser until broker is ready
    browser_queue = asyncio.Queue()

    async def collect_from_browser():
        """Listen to browser and dump into queue immediately to prevent loss during probing."""
        try:
            while True:
                data = await browser_ws.receive_text()
                await browser_queue.put(data)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"[WS Bridge] Collection error: {e}")

    # Start collecting browser messages IMMEDIATELY
    collect_task = asyncio.create_task(collect_from_browser())

    # We'll try these URLs in order. 
    urls_to_try = [
        f"ws://localhost:8765/?apikey={api_key}",
        f"ws://127.0.0.1:8765/?apikey={api_key}",
        f"ws://localhost:5000/ws/?apikey={api_key}",
        f"ws://127.0.0.1:5000/ws/?apikey={api_key}",
    ]
    
    openalgo_ws = None
    print(f"[WS Bridge] Browser connected. Probing OpenAlgo with Query-String Auth...")

    try:
        # 1. Probe for broker connection
        for url in urls_to_try:
            try:
                display_url = url.split("?")[0] + " (with apikey)"
                print(f"[WS Bridge] Attempting: {display_url} ...", end=" ", flush=True)
                openalgo_ws = await asyncio.wait_for(websockets.connect(url), timeout=2)
                print(f"SUCCESS")
                break
            except Exception:
                print(f"FAILED")
            await asyncio.sleep(0.1)

        if not openalgo_ws:
            print("[WS Bridge] FATAL: Could not connect to OpenAlgo.")
            await browser_ws.send_text(json.dumps({
                "type": "error", "message": "Terminal could not reach OpenAlgo WebSocket."
            }))
            return

        # 2. Handshake: Fallback Auth
        auth_payload = {"action": "auth", "apikey": api_key}
        print(f"[WS Bridge] Sending fallback Auth message...")
        await openalgo_ws.send(json.dumps(auth_payload))
        
        try:
            # Brief wait for auth confirmation
            auth_resp_raw = await asyncio.wait_for(openalgo_ws.recv(), timeout=2)
            print(f"← [WS AUTH] {auth_resp_raw}")
        except Exception:
            pass

        # 3. Main Forwarding Loops
        async def forward_to_openalgo():
            """Pull from queue and forward to OpenAlgo with normalization."""
            try:
                while True:
                    data = await browser_queue.get()
                    try:
                        msg = json.loads(data)
                        
                        # Mode Normalization & Symbol Aliasing
                        mode_map = {"ltp": 1, "quote": 2, "depth": 3}
                        if msg.get("action") in ["subscribe", "unsubscribe"]:
                            current_mode = msg.get("mode")
                            if isinstance(current_mode, str) and current_mode.lower() in mode_map:
                                msg["mode"] = mode_map[current_mode.lower()]
                            
                            msg["symbols"] = msg.get("instruments", [])
                            data = json.dumps(msg)
                            print(f"→ [BROKER] Forwarding {msg.get('action')} (mode: {msg.get('mode')})")
                    except json.JSONDecodeError:
                        pass
                    
                    await openalgo_ws.send(data)
                    browser_queue.task_done()
            except Exception as e:
                print(f"[WS Bridge] Forwarding error: {e}")

        async def openalgo_to_browser():
            """Forward messages from OpenAlgo → browser."""
            try:
                async for message in openalgo_ws:
                    # Diagnostics: only log non-market data
                    if '"type": "market_data"' not in message and '"type": "ltp"' not in message:
                        print(f"← [WS] {message}")
                    await browser_ws.send_text(message)
            except Exception as e:
                print(f"[WS Bridge] Broker-to-Browser error: {e}")

        # Run tasks concurrently
        forward_task = asyncio.create_task(forward_to_openalgo())
        bridge_task = asyncio.create_task(openalgo_to_browser())
        
        await asyncio.wait([forward_task, bridge_task], return_when=asyncio.FIRST_COMPLETED)
        forward_task.cancel()
        bridge_task.cancel()

    except Exception as e:
        print(f"[WS Bridge] General Error: {e}")
    finally:
        collect_task.cancel()
        if openalgo_ws:
            await openalgo_ws.close()
        await browser_ws.close()
        print(f"[WS Bridge] Gateway closed")
