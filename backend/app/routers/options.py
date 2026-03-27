from fastapi import APIRouter, Depends
from ..dependencies import get_client
from ..services.openalgo_client import OpenAlgoClient
from ..models.schemas import (
    OptionChainRequest, OptionGreeksRequest,
    ExpiryRequest, OptionSymbolRequest,
)

router = APIRouter()


@router.post("/chain")
async def get_option_chain(req: OptionChainRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.option_chain(
        req.underlying, req.exchange, req.expiry_date, req.strike_count,
    )


@router.post("/greeks")
async def get_option_greeks(req: OptionGreeksRequest, client: OpenAlgoClient = Depends(get_client)):
    extras = {}
    if req.interest_rate is not None:
        extras["interest_rate"] = req.interest_rate
    if req.underlying_symbol:
        extras["underlying_symbol"] = req.underlying_symbol
    if req.underlying_exchange:
        extras["underlying_exchange"] = req.underlying_exchange
    return await client.option_greeks(req.symbol, req.exchange, **extras)


@router.post("/expiry")
async def get_expiry(req: ExpiryRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.expiry(req.symbol, req.exchange, req.instrument_type)


@router.post("/symbol")
async def get_option_symbol(req: OptionSymbolRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.option_symbol(
        req.underlying, req.exchange, req.expiry_date,
        req.option_type, req.offset,
    )
