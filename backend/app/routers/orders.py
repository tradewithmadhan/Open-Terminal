from fastapi import APIRouter, Depends
from ..dependencies import get_client
from ..services.openalgo_client import OpenAlgoClient
from ..models.schemas import (
    PlaceOrderRequest, ModifyOrderRequest,
    CancelOrderRequest, StrategyFilter,
    OrderStatusRequest,
)

router = APIRouter()


@router.post("/place")
async def place_order(req: PlaceOrderRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.place_order(
        strategy=req.strategy, symbol=req.symbol, action=req.action,
        exchange=req.exchange, pricetype=req.pricetype, product=req.product,
        quantity=req.quantity, price=req.price,
        trigger_price=req.trigger_price,
        disclosed_quantity=req.disclosed_quantity,
    )


@router.post("/modify")
async def modify_order(req: ModifyOrderRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.modify_order(
        orderid=req.orderid, symbol=req.symbol, action=req.action,
        exchange=req.exchange, pricetype=req.pricetype, product=req.product,
        quantity=req.quantity, price=req.price,
        trigger_price=req.trigger_price, strategy=req.strategy,
    )


@router.post("/cancel")
async def cancel_order(req: CancelOrderRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.cancel_order(req.orderid, req.strategy)


@router.post("/cancel-all")
async def cancel_all_orders(req: StrategyFilter, client: OpenAlgoClient = Depends(get_client)):
    return await client.cancel_all_orders(req.strategy)


@router.post("/close-all")
async def close_all_positions(req: StrategyFilter, client: OpenAlgoClient = Depends(get_client)):
    return await client.close_all_positions(req.strategy)


@router.post("/status")
async def order_status(req: OrderStatusRequest, client: OpenAlgoClient = Depends(get_client)):
    return await client.order_status(req.orderid, req.strategy)
