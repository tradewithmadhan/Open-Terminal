'use client';

import { useState, useMemo, useCallback } from 'react';
import { X, RefreshCw, Loader2, Download, Trash2, Edit2 } from 'lucide-react';
import { useOrderBook, useCancelOrder, useCancelAllOrders } from '@/hooks/useApi';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatPrice } from '@/lib/formatters';
import type { OrderStatus } from '@/lib/types';
import { showToast } from '@/components/common/ToastManager';
import { downloadCSV } from '@/lib/export';
import { orderApi } from '@/lib/api-client';

type FilterType = 'all' | 'open' | 'complete' | 'cancelled' | 'rejected';

export function OrderBookPanel() {
  const { setActiveSymbol } = useTerminalStore();
  const { data: orderData, isLoading, refetch } = useOrderBook();
  const cancelOrder = useCancelOrder();
  const cancelAllOrders = useCancelAllOrders();
  const [filter, setFilter] = useState<FilterType>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isCancellingAll, setIsCancellingAll] = useState(false);
  const [modifyOrder, setModifyOrder] = useState<any | null>(null);

  // Parse orders from API response
  const orders = useMemo(() => {
    if (!orderData?.data) return [];
    
    // Handle both {"data": [...]} and {"data": {"orders": [...]}} structures
    let raw = [];
    if (Array.isArray(orderData.data)) {
      raw = orderData.data;
    } else if (orderData.data.orders && Array.isArray(orderData.data.orders)) {
      raw = orderData.data.orders;
    }

    return raw.map((o: any) => ({
      ...o,
      // Normalize symbol/tradingsymbol
      symbol: o.symbol || o.tradingsymbol || 'UNKNOWN',
      // Normalize orderid
      orderid: o.orderid || o.order_id || String(Math.random()),
    })).sort((a: any, b: any) => {
      // Sort by timestamp descending (newest first)
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
  }, [orderData]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'open') return orders.filter((o: any) => o.order_status === 'open' || o.order_status === 'pending');
    return orders.filter((o: any) => o.order_status === filter);
  }, [orders, filter]);

  // Count by status
  const counts = useMemo(() => {
    const c = { all: orders.length, open: 0, complete: 0, cancelled: 0, rejected: 0 };
    orders.forEach((o: any) => {
      if (o.order_status === 'open' || o.order_status === 'pending') c.open++;
      else if (o.order_status === 'complete') c.complete++;
      else if (o.order_status === 'cancelled') c.cancelled++;
      else if (o.order_status === 'rejected') c.rejected++;
    });
    return c;
  }, [orders]);

  // Cancel handler
  const handleCancel = useCallback(async (orderid: string) => {
    setCancellingId(orderid);
    try {
      await cancelOrder.mutateAsync({ orderid });
      showToast('success', 'Order Cancelled', `Order #${orderid} cancellation sent`);
    } catch (err: any) {
      showToast('error', 'Cancel Failed', err.message || 'Unknown error');
      console.error('Cancel failed:', err);
    }
    setCancellingId(null);
  }, [cancelOrder]);

  const handleCancelAll = useCallback(async () => {
    if (!confirm('Are you sure you want to cancel ALL open orders?')) return;
    setIsCancellingAll(true);
    try {
      await cancelAllOrders.mutateAsync('TERMINAL');
      showToast('success', 'Kill Switch Activated', 'All open orders cancellation requested');
    } catch (err: any) {
      showToast('error', 'Batch Cancel Failed', err.message || 'Unknown error');
    }
    setIsCancellingAll(false);
  }, [cancelAllOrders]);

  const handleModifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyOrder) return;
    try {
      const { data } = await orderApi.modify({
        orderid: modifyOrder.orderid,
        symbol: modifyOrder.symbol,
        exchange: modifyOrder.exchange,
        action: modifyOrder.action,
        quantity: modifyOrder.quantity,
        price: modifyOrder.price,
        trigger_price: modifyOrder.trigger_price,
        pricetype: modifyOrder.pricetype,
        product: modifyOrder.product,
      });
      if (data.status === 'success') {
        showToast('success', 'Order Modified', `Order #${modifyOrder.orderid} updated`);
        setModifyOrder(null);
        refetch();
      } else {
        showToast('error', 'Modify Failed', data.message);
      }
    } catch (err: any) {
      showToast('error', 'Modify Error', err.message);
    }
  };

  const exportOrders = useCallback(() => {
    if (orders.length === 0) return;
    downloadCSV('orders', 
      ['OrderID', 'Time', 'Symbol', 'Exchange', 'Side', 'Qty', 'Price', 'Type', 'Status'],
      orders.map((o: any) => [
        o.orderid, o.timestamp, o.symbol, o.exchange,
        o.action, o.quantity, o.price, o.pricetype, o.order_status
      ])
    );
  }, [orders]);

  // Format time from timestamp string
  const formatOrderTime = (ts: string) => {
    if (!ts) return '—';
    // Handle format like "28-Aug-2025 09:59:10"
    try {
      const parts = ts.split(' ');
      if (parts.length >= 2) {
        return parts[1]?.substring(0, 5) || ts;
      }
      return ts.substring(0, 5);
    } catch {
      return ts.substring(0, 5);
    }
  };

  // Format price display
  const formatOrderPrice = (order: any) => {
    if (order.pricetype === 'MARKET') return 'MKT';
    if (order.pricetype === 'SL-M') return `SL ${formatPrice(order.trigger_price || 0)}`;
    if (order.pricetype === 'SL') return `${formatPrice(order.price)} / SL ${formatPrice(order.trigger_price || 0)}`;
    return formatPrice(order.price || 0);
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'complete', label: 'Filled' },
    { key: 'cancelled', label: 'Canc.' },
    { key: 'rejected', label: 'Rej.' },
  ];

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[#1e1e30] overflow-x-auto shrink-0 bg-[#08080d]/50">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'bg-[#14141f] text-emerald-400 border-b-2 border-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f.label}
            <span className={`px-1 rounded text-[8px] ${
              filter === f.key ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#1e1e30] text-zinc-600'
            }`}>
              {counts[f.key]}
            </span>
          </button>
        ))}

        <div className="flex-1" />
        <button 
          onClick={handleCancelAll} 
          disabled={isCancellingAll || counts.open === 0}
          className="p-1 hover:bg-red-500/10 rounded flex items-center gap-1 text-zinc-500 hover:text-red-400 disabled:opacity-30" 
          title="Cancel All Open Orders"
        >
          {isCancellingAll ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          <span className="text-[9px] font-bold">KILL</span>
        </button>
        <div className="w-px h-3 bg-[#1e1e30] mx-1" />
        <button onClick={exportOrders} className="p-1 hover:bg-[#1e1e30] rounded flex items-center gap-1 text-zinc-500 hover:text-emerald-400" title="Export CSV">
          <Download size={10} />
        </button>
        <button onClick={() => refetch()} className="p-1 hover:bg-[#1e1e30] rounded">
          <RefreshCw size={10} className={`text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[45px_1fr_40px_50px_75px_65px_28px] px-2 py-1 border-b border-[#1e1e30] text-[9px] text-zinc-600 uppercase tracking-wider shrink-0">
        <span>Time</span>
        <span>Symbol</span>
        <span>Side</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-center">Status</span>
        <span></span>
      </div>

      {/* Order rows */}
      <div className="flex-1 overflow-auto">
        {filteredOrders.map((order: any, idx: number) => {
          const isOpen = order.order_status === 'open' || order.order_status === 'pending';
          const isCancelling = cancellingId === order.orderid;

          return (
            <div
              key={order.orderid || idx}
              onClick={() => setActiveSymbol({ symbol: order.symbol, exchange: order.exchange || 'NSE' })}
              className={`
                grid grid-cols-[45px_1fr_40px_50px_75px_65px_28px] px-2 py-1.5 items-center
                border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e] transition-colors cursor-pointer
                ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0a12]'}
                ${order.order_status === 'rejected' ? 'opacity-50' : ''}
              `}
            >
              {/* Time */}
              <span className="text-zinc-500 tabular-nums">
                {formatOrderTime(order.timestamp)}
              </span>

              {/* Symbol */}
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-zinc-200 truncate">{order.symbol}</span>
                {order.exchange && order.exchange !== 'NSE' && !order.exchange.includes('_INDEX') && (
                  <span className="text-[7px] px-1 bg-[#1e1e30] text-zinc-600 rounded shrink-0">
                    {order.exchange}
                  </span>
                )}
              </div>

              {/* Side */}
              <span className={`font-bold ${
                order.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {order.action}
              </span>

              {/* Qty */}
              <span className="text-right tabular-nums text-zinc-300">
                {order.quantity}
              </span>

              {/* Price */}
              <span className={`text-right tabular-nums ${
                order.pricetype === 'MARKET' ? 'text-cyan-400' : 'text-zinc-300'
              }`}>
                {formatOrderPrice(order)}
              </span>

              {/* Status */}
              <div className="flex justify-center">
                <StatusBadge status={order.order_status as OrderStatus} />
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-1">
                {isOpen && (
                  <>
                    <button
                      onClick={() => setModifyOrder({ ...order })}
                      className="p-1 hover:bg-emerald-500/20 rounded transition-colors"
                      title="Modify order"
                    >
                      <Edit2 size={10} className="text-zinc-600 hover:text-emerald-400" />
                    </button>
                    <button
                      onClick={() => handleCancel(order.orderid)}
                      disabled={isCancelling}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                      title="Cancel order"
                    >
                      {isCancelling ? (
                        <Loader2 size={10} className="text-zinc-500 animate-spin" />
                      ) : (
                        <X size={10} className="text-zinc-600 hover:text-red-400" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {filteredOrders.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-[11px]">
            {filter === 'all' ? 'No orders today' : `No ${filter} orders`}
          </div>
        )}

        {/* Loading state */}
        {isLoading && orders.length === 0 && (
          <div className="p-2 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="grid grid-cols-[45px_1fr_40px_50px_75px_65px_28px] gap-2 items-center">
                <div className="h-4 skeleton w-full" />
                <div className="h-4 skeleton w-full" />
                <div className="h-4 skeleton w-full" />
                <div className="h-4 skeleton w-full" />
                <div className="h-4 skeleton w-full" />
                <div className="h-4 skeleton w-full" />
                <div className="h-4 skeleton w-full" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modify Dialog */}
      {modifyOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-[#0e0e16] border border-[#2a2a42] rounded-sm p-4 w-[280px] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Modify Order</span>
              <button onClick={() => setModifyOrder(null)}><X size={14} className="text-zinc-500" /></button>
            </div>
            
            <form onSubmit={handleModifySubmit} className="space-y-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-500">{modifyOrder.symbol}</span>
                <span className={modifyOrder.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{modifyOrder.action}</span>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-600 uppercase">Quantity</label>
                <input 
                  type="number" 
                  value={modifyOrder.quantity}
                  onChange={e => setModifyOrder({...modifyOrder, quantity: e.target.value})}
                  className="w-full bg-[#14141f] border border-[#1e1e30] rounded p-1.5 text-zinc-200 outline-none focus:border-emerald-500/50"
                />
              </div>

              {modifyOrder.pricetype !== 'MARKET' && (
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-600 uppercase">Price</label>
                  <input 
                    type="number" 
                    step="0.05"
                    value={modifyOrder.price}
                    onChange={e => setModifyOrder({...modifyOrder, price: e.target.value})}
                    className="w-full bg-[#14141f] border border-[#1e1e30] rounded p-1.5 text-zinc-200 outline-none focus:border-emerald-500/50"
                  />
                </div>
              )}

              {(modifyOrder.pricetype === 'SL' || modifyOrder.pricetype === 'SL-M') && (
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-600 uppercase">Trigger Price</label>
                  <input 
                    type="number" 
                    step="0.05"
                    value={modifyOrder.trigger_price}
                    onChange={e => setModifyOrder({...modifyOrder, trigger_price: e.target.value})}
                    className="w-full bg-[#14141f] border border-[#1e1e30] rounded p-1.5 text-zinc-200 outline-none focus:border-emerald-500/50"
                  />
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded hover:bg-emerald-500/30 transition-all"
              >
                UPDATE ORDER
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
