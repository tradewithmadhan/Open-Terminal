'use client';

import { useMemo } from 'react';
import { RefreshCw, Loader2, Download } from 'lucide-react';
import { useHoldings } from '@/hooks/useApi';
import { formatPrice, formatIndianNumber, formatPercent } from '@/lib/formatters';
import { downloadCSV } from '@/lib/export';

export function HoldingsPanel() {
  const { data: holdData, isLoading, refetch } = useHoldings();

  const holdings = useMemo(() => {
    if (!holdData?.data) return [];
    const raw = Array.isArray(holdData.data) ? holdData.data : [];
    return raw.map((h: any) => {
      const qty = parseInt(h.quantity || '0');
      const avg = parseFloat(h.averageprice || h.average_price || '0');
      const ltp = parseFloat(h.ltp || h.lastprice || '0');
      const pnl = (ltp - avg) * qty;
      const pnlPct = avg > 0 ? ((ltp - avg) / avg) * 100 : 0;
      const invested = avg * qty;
      const current = ltp * qty;
      return {
        symbol: h.symbol || h.tradingsymbol || '',
        exchange: h.exchange || 'NSE',
        quantity: qty,
        averagePrice: avg,
        ltp,
        pnl,
        pnlPercent: pnlPct,
        invested,
        current,
      };
    }).filter((h: any) => h.quantity > 0);
  }, [holdData]);

  const totals = useMemo(() => ({
    invested: holdings.reduce((s: number, h: any) => s + h.invested, 0),
    current: holdings.reduce((s: number, h: any) => s + h.current, 0),
    pnl: holdings.reduce((s: number, h: any) => s + h.pnl, 0),
  }), [holdings]);

  const exportHoldings = () => {
    if (holdings.length === 0) return;
    downloadCSV('holdings',
      ['Symbol', 'Exchange', 'Qty', 'AvgPrice', 'LTP', 'PnL', 'PnL%', 'Invested', 'Current'],
      holdings.map((h: any) => [
        h.symbol, h.exchange, h.quantity, h.averagePrice, h.ltp, h.pnl, h.pnlPercent, h.invested, h.current
      ])
    );
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30]">
        <span className="text-[10px] text-zinc-500">
          Holdings: <span className="text-zinc-300">{holdings.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <button onClick={exportHoldings} className="p-1 hover:bg-[#1e1e30] rounded flex items-center gap-1 text-zinc-500 hover:text-emerald-400" title="Export CSV">
            <Download size={10} />
          </button>
          <button onClick={() => refetch()} className="p-1 hover:bg-[#1e1e30] rounded">
            <RefreshCw size={10} className={`text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_45px_65px_65px_85px] px-2 py-1 border-b border-[#1e1e30] text-[9px] text-zinc-600 uppercase tracking-wider shrink-0">
        <span>Symbol</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Avg</span>
        <span className="text-right">LTP</span>
        <span className="text-right">P&L</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {holdings.map((h: any, idx: number) => {
          const pnlColor = h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
          return (
            <div
              key={`${h.symbol}-${idx}`}
              className={`grid grid-cols-[1fr_45px_65px_65px_85px] px-2 py-1.5 items-center border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e] ${idx % 2 ? 'bg-[#0a0a12]' : ''}`}
            >
              <span className="text-zinc-200 truncate">{h.symbol}</span>
              <span className="text-right tabular-nums text-zinc-300">{h.quantity}</span>
              <span className="text-right tabular-nums text-zinc-500">{formatPrice(h.averagePrice)}</span>
              <span className="text-right tabular-nums text-zinc-200">{h.ltp > 0 ? formatPrice(h.ltp) : '—'}</span>
              <div className="text-right">
                <span className={`tabular-nums ${pnlColor}`}>
                  {h.pnl >= 0 ? '+' : ''}{formatIndianNumber(h.pnl)}
                </span>
                <div className={`text-[9px] opacity-60 ${pnlColor}`}>{formatPercent(h.pnlPercent)}</div>
              </div>
            </div>
          );
        })}
        {holdings.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-[11px]">No holdings</div>
        )}
        {isLoading && holdings.length === 0 && (
          <div className="flex items-center justify-center h-20 gap-2 text-zinc-600 text-[11px]">
            <Loader2 size={12} className="animate-spin" /> Loading holdings...
          </div>
        )}
      </div>

      {/* Bottom summary */}
      <div className="grid grid-cols-3 gap-px border-t border-[#1e1e30] bg-[#0a0a12] text-[10px] shrink-0">
        <div className="px-2 py-1.5 text-center">
          <div className="text-zinc-600">Invested</div>
          <div className="text-zinc-300">{formatIndianNumber(totals.invested, 0)}</div>
        </div>
        <div className="px-2 py-1.5 text-center">
          <div className="text-zinc-600">Current</div>
          <div className="text-zinc-300">{formatIndianNumber(totals.current, 0)}</div>
        </div>
        <div className="px-2 py-1.5 text-center">
          <div className="text-zinc-600">P&L</div>
          <div className={`${totals.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'} font-bold`}>
            {totals.pnl >= 0 ? '+' : ''}{formatIndianNumber(totals.pnl, 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
