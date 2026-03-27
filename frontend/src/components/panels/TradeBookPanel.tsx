'use client';

import { useMemo } from 'react';
import { RefreshCw, Loader2, Download } from 'lucide-react';
import { useTradeBook } from '@/hooks/useApi';
import { formatPrice, formatIndianNumber } from '@/lib/formatters';
import { downloadCSV } from '@/lib/export';

export function TradeBookPanel() {
  const { data: tradeData, isLoading, refetch } = useTradeBook();

  const trades = useMemo(() => {
    if (!tradeData?.data) return [];
    
    // Handle potential nesting though usually direct array
    let raw = [];
    if (Array.isArray(tradeData.data)) {
      raw = tradeData.data;
    } else if ((tradeData.data as any).trades && Array.isArray((tradeData.data as any).trades)) {
      raw = (tradeData.data as any).trades;
    }

    return raw.map((t: any) => ({
      ...t,
      symbol: t.symbol || t.tradingsymbol || 'UNKNOWN',
      tradeid: t.tradeid || t.orderid || String(Math.random()),
    })).sort((a: any, b: any) => {
      const timeA = a.timestamp || '';
      const timeB = b.timestamp || '';
      return timeB.localeCompare(timeA);
    });
  }, [tradeData]);

  const totalTurnover = useMemo(() =>
    trades.reduce((sum: number, t: any) => {
      const qty = Math.abs(parseInt(t.quantity || '0'));
      const price = parseFloat(t.price || t.average_price || '0');
      return sum + qty * price;
    }, 0),
    [trades]
  );

  const exportTrades = () => {
    if (trades.length === 0) return;
    downloadCSV('trades', 
      ['TradeID', 'Time', 'Symbol', 'Exchange', 'Side', 'Qty', 'Price', 'Value'],
      trades.map((t: any) => [
        t.tradeid || t.orderid, t.timestamp, t.symbol, t.exchange,
        t.action, t.quantity, t.price, (t.quantity * t.price)
      ])
    );
  };

  const formatTradeTime = (ts: string) => {
    if (!ts) return '—';
    try {
      // Standard format: "28-Aug-2025 11:02:15"
      const parts = ts.split(' ');
      if (parts.length >= 2) {
        return parts[1]?.substring(0, 5) || ts;
      }
      return ts.substring(0, 5);
    } catch {
      return ts.substring(0, 5);
    }
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30]">
        <span className="text-[10px] text-zinc-500">
          Trades: <span className="text-zinc-300">{trades.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <button onClick={exportTrades} className="p-1 hover:bg-[#1e1e30] rounded flex items-center gap-1 text-zinc-500 hover:text-emerald-400" title="Export CSV">
            <Download size={10} />
          </button>
          <button onClick={() => refetch()} className="p-1 hover:bg-[#1e1e30] rounded">
            <RefreshCw size={10} className={`text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[40px_1fr_38px_45px_65px_65px] px-2 py-1 border-b border-[#1e1e30] text-[9px] text-zinc-600 uppercase tracking-wider shrink-0">
        <span>Time</span>
        <span>Symbol</span>
        <span>Side</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Value</span>
      </div>

      {/* Trade rows */}
      <div className="flex-1 overflow-auto">
        {trades.map((trade: any, idx: number) => {
          const qty = Math.abs(parseInt(trade.quantity || '0'));
          const price = parseFloat(trade.price || trade.average_price || '0');
          const value = qty * price;

          return (
            <div
              key={trade.orderid || idx}
              className={`
                grid grid-cols-[40px_1fr_38px_45px_65px_65px] px-2 py-1.5 items-center
                border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e] transition-colors
                ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0a12]'}
              `}
            >
              {/* Time */}
              <span className="text-zinc-500 tabular-nums">{formatTradeTime(trade.timestamp)}</span>

              {/* Symbol */}
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-zinc-200 truncate">{trade.symbol || trade.tradingsymbol}</span>
                {trade.exchange && trade.exchange !== 'NSE' && (
                  <span className="text-[7px] px-1 bg-[#1e1e30] text-zinc-600 rounded shrink-0">
                    {trade.exchange}
                  </span>
                )}
              </div>

              {/* Side */}
              <span className={`font-bold ${trade.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                {trade.action}
              </span>

              {/* Qty */}
              <span className="text-right tabular-nums text-zinc-300">{qty}</span>

              {/* Price */}
              <span className="text-right tabular-nums text-zinc-300">{formatPrice(price)}</span>

              {/* Value */}
              <span className="text-right tabular-nums text-zinc-400">
                {formatIndianNumber(value, 0).replace('₹', '')}
              </span>
            </div>
          );
        })}

        {/* Empty state */}
        {trades.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-[11px]">
            No trades today
          </div>
        )}

        {/* Loading state */}
        {isLoading && trades.length === 0 && (
          <div className="flex items-center justify-center h-20 gap-2 text-zinc-600 text-[11px]">
            <Loader2 size={12} className="animate-spin" /> Loading trades...
          </div>
        )}
      </div>

      {/* Bottom summary */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-[#1e1e30] bg-[#14141f] text-[10px] shrink-0">
        <span className="text-zinc-500">
          Total Turnover: <span className="text-zinc-300 font-medium">{formatIndianNumber(totalTurnover, 0)}</span>
        </span>
        <span className="text-zinc-500">
          Count: <span className="text-zinc-300 font-medium">{trades.length}</span>
        </span>
      </div>
    </div>
  );
}
