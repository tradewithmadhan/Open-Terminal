from fastapi import APIRouter, Depends
from ..dependencies import get_client
from ..services.openalgo_client import OpenAlgoClient
from ..models.schemas import QuoteRequest, MultiQuoteRequest, DepthRequest, HistoryRequest

router = APIRouter()


@router.post("/quotes")
async def get_quotes(req: QuoteRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.quotes(req.symbol, req.exchange)


@router.post("/multiquotes")
async def get_multi_quotes(req: MultiQuoteRequest, client: OpenAlgoClient = Depends(get_client)):
    symbols = [{"symbol": s.symbol, "exchange": s.exchange} for s in req.symbols]
    return await client.multi_quotes(symbols)


@router.post("/depth")
async def get_depth(req: DepthRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.depth(req.symbol, req.exchange)


@router.post("/history")
async def get_history(req: HistoryRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.history(
        req.symbol, req.exchange, req.interval,
        req.start_date, req.end_date,
    )
