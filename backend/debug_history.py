import asyncio
import httpx
import json

async def test_history():
    url = "http://localhost:8000/api/market/history"
    # Try multiple common symbol formats
    test_symbols = [
        {"symbol": "RELIANCE", "exchange": "NSE"},
        {"symbol": "NSE:RELIANCE-EQ", "exchange": "NSE"},
        {"symbol": "NIFTY", "exchange": "NSE_INDEX"}
    ]
    
    async with httpx.AsyncClient() as client:
        for s in test_symbols:
            print(f"Testing {s['symbol']}...")
            data = {
                "symbol": s["symbol"],
                "exchange": s["exchange"],
                "interval": "5m",
                "start_date": "2026-03-20",
                "end_date": "2026-03-26"
            }
            try:
                response = await client.post(url, json=data)
                result = response.json()
                if result.get("status") == "success" and result.get("data"):
                    print(f"Success for {s['symbol']}!")
                    print(f"Data length: {len(result['data'])}")
                    print(f"First item keys: {list(result['data'][0].keys())}")
                    print(f"First item: {json.dumps(result['data'][0], indent=2)}")
                    return
                else:
                    print(f"Failed for {s['symbol']}: {result.get('message') or result}")
            except Exception as e:
                print(f"Error for {s['symbol']}: {e}")

if __name__ == "__main__":
    asyncio.run(test_history())
