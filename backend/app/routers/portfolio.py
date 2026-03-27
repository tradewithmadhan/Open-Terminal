from fastapi import APIRouter, Depends
from ..dependencies import get_client
from ..services.openalgo_client import OpenAlgoClient
from ..models.schemas import QuoteRequest

router = APIRouter()


@router.get("/funds")
async def get_funds(client: OpenAlgoClient = Depends(get_client)):
    result = await client.funds()
    if result.get("status") == "success":
        data = result.get("data", result)
        cash = float(data.get("availablecash", 0))
        collateral = float(data.get("collateral", 0))
        debits = float(data.get("utiliseddebits", 0))
        total_margin = cash + collateral
        return {
            "status": "success",
            "data": {
                "availablecash": cash,
                "collateral": collateral,
                "m2mrealized": float(data.get("m2mrealized", 0)),
                "m2munrealized": float(data.get("m2munrealized", 0)),
                "utiliseddebits": debits,
                "totalMargin": total_margin,
                "usedPercent": round((debits / total_margin * 100) if total_margin > 0 else 0, 2),
            },
        }
    return result


@router.get("/positions")
async def get_positions(client: OpenAlgoClient = Depends(get_client)):
    return await client.position_book()


@router.get("/orderbook")
async def get_orderbook(client: OpenAlgoClient = Depends(get_client)):
    return await client.order_book()


@router.get("/tradebook")
async def get_tradebook(client: OpenAlgoClient = Depends(get_client)):
    return await client.trade_book()


@router.get("/holdings")
async def get_holdings(client: OpenAlgoClient = Depends(get_client)):
    return await client.holdings()


@router.post("/margin")
async def check_margin(positions: list[dict], client: OpenAlgoClient = Depends(get_client)):
    return await client.margin_required(positions)


@router.post("/open-position")
async def check_open_position(req: QuoteRequest, product: str = "MIS", client: OpenAlgoClient = Depends(get_client)):
    return await client.open_position(req.symbol, req.exchange, product)
