'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { RefreshCw, LogOut, Loader2, AlertTriangle, Download } from 'lucide-react';
import { usePositions, useFunds, useExitAllPositions } from '@/hooks/useApi';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { orderApi } from '@/lib/api-client';
import { formatPrice, formatIndianNumber, formatPercent } from '@/lib/formatters';
import { PnLCell } from '@/components/common/PnLCell';
import { showToast } from '@/components/common/ToastManager';
import { downloadCSV } from '@/lib/export';

export function PositionsPanel() {
  const { data: posData, isLoading, refetch } = usePositions();
  const { data: fundsData } = useFunds();
  const { watchlist, setActiveSymbol, prices } = useTerminalStore();
  const exitAllPositions = useExitAllPositions();
  const [exitingSymbol, setExitingSymbol] = useState<string | null>(null);
  const [isExitingAll, setIsExitingAll] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState<any>(null);

  // Parse positions from API
  const positions = useMemo(() => {
    if (!posData?.data) return [];
    const raw = Array.isArray(posData.data) ? posData.data : [];
    
    return raw
      .map((p: any) => {
        const symbol = p.symbol || p.tradingsymbol || '';
        const exchange = p.exchange || 'NSE';
        const key = `${symbol}:${exchange}`;
        
        const qty = parseInt(p.quantity || p.netqty || '0');
        const avg = parseFloat(p.averageprice || p.average_price || '0');
        
        // Use live price from global store if available (with fuzzy exchange matching)
        let priceData = prices[key];
        if (!priceData) {
          // Try alternative exchange for indices
          const altEx = exchange === 'NSE' ? 'NSE_INDEX' : (exchange === 'NSE_INDEX' ? 'NSE' : (exchange === 'BSE' ? 'BSE_INDEX' : (exchange === 'BSE_INDEX' ? 'BSE' : null)));
          if (altEx) priceData = prices[`${symbol}:${altEx}`];
        }

        let ltp = priceData?.ltp || parseFloat(p.ltp || p.lastprice || '0');
        
        // If still 0, fall back to watchlist
        if (ltp === 0) {
          const wItem = watchlist.find(w => w.symbol === symbol);
          if (wItem) ltp = wItem.ltp;
        }
        
        const pnl = (ltp - avg) * qty;
        const pnlPercent = avg > 0 ? ((ltp - avg) / avg) * 100 : 0;

        return {
          symbol,
          exchange,
          product: p.product || 'MIS',
          quantity: qty,
          averagePrice: avg,
          ltp,
          pnl,
          pnlPercent,
        };
      })
      .filter((p: any) => p.quantity !== 0); // Remove flat positions
  }, [posData, watchlist, prices]);

  // Calculate totals
  const totalPnl = useMemo(() => positions.reduce((sum: number, p: any) => sum + p.pnl, 0), [positions]);
  const realized = fundsData?.data?.m2mrealized || 0;
  const unrealized = fundsData?.data?.m2munrealized || 0;

  const exportPositions = useCallback(() => {
    if (positions.length === 0) return;
    downloadCSV('positions',
      ['Symbol', 'Exchange', 'Product', 'Qty', 'AvgPrice', 'LTP', 'PnL', 'PnL%'],
      positions.map((p: any) => [
        p.symbol, p.exchange, p.product, p.quantity, p.averagePrice, p.ltp, p.pnl, p.pnlPercent
      ])
    );
  }, [positions]);

  // Exit position handler
  const handleExit = useCallback(async (pos: any) => {
    setExitingSymbol(pos.symbol);
    setShowExitConfirm(null);

    try {
      const exitAction = pos.quantity > 0 ? 'SELL' : 'BUY';
      const { data } = await orderApi.place({
        strategy: 'TERMINAL',
        symbol: pos.symbol,
        action: exitAction,
        exchange: pos.exchange,
        pricetype: 'MARKET',
        product: pos.product,
        quantity: String(Math.abs(pos.quantity)),
      });

      if (data.status === 'success') {
        showToast('success', 'Exit Order Placed', `Exit ${pos.symbol} — #${data.orderid}`);
        setTimeout(() => refetch(), 1000);
      } else {
        showToast('error', 'Exit Failed', data.message || 'Unknown error');
      }
    } catch (err: any) {
      showToast('error', 'Exit Failed', err.message || 'Unknown error');
    }
    setExitingSymbol(null);
  }, [refetch]);

  const handleExitAll = useCallback(async () => {
    if (!confirm('Are you sure you want to EXIT ALL open positions? This will place MARKET orders for all net quantities.')) return;
    setIsExitingAll(true);
    try {
      await exitAllPositions.mutateAsync('TERMINAL');
      showToast('success', 'Panic Exit Activated', 'All positions exit requested');
      setTimeout(() => refetch(), 2000);
    } catch (err: any) {
      showToast('error', 'Batch Exit Failed', err.message || 'Unknown error');
    }
    setIsExitingAll(false);
  }, [exitAllPositions, refetch]);

  // Split symbol for display (options)
  const formatSymbolDisplay = (symbol: string) => {
    // Check if it's an option symbol (contains CE or PE at end)
    const optMatch = symbol.match(/^([A-Z]+)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/);
    if (optMatch) {
      return { main: optMatch[1], sub: `${optMatch[3]}${optMatch[4]}` };
    }
    // Futures
    const futMatch = symbol.match(/^([A-Z]+)(\d{2}[A-Z]{3}\d{2})(FUT)$/);
    if (futMatch) {
      return { main: futMatch[1], sub: 'FUT' };
    }
    return { main: symbol, sub: '' };
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30]">
        <span className="text-[10px] text-zinc-500">
          Positions: <span className="text-zinc-300">{positions.length}</span>
        </span>
        <PnLCell value={totalPnl} size="sm" />
        <div className="flex items-center gap-1">
          <button 
            onClick={handleExitAll} 
            disabled={isExitingAll || positions.length === 0}
            className="p-1 hover:bg-red-500/10 rounded flex items-center gap-1 text-zinc-500 hover:text-red-400 disabled:opacity-30" 
            title="Exit All Positions"
          >
            {isExitingAll ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
            <span className="text-[9px] font-bold">KILL</span>
          </button>
          <div className="w-px h-3 bg-[#1e1e30] mx-1" />
          <button onClick={exportPositions} className="p-1 hover:bg-[#1e1e30] rounded flex items-center gap-1 text-zinc-500 hover:text-emerald-400" title="Export CSV">
            <Download size={10} />
          </button>
          <button onClick={() => refetch()} className="p-1 hover:bg-[#1e1e30] rounded">
            <RefreshCw size={10} className={`text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_50px_65px_65px_80px_40px] px-2 py-1 border-b border-[#1e1e30] text-[9px] text-zinc-600 uppercase tracking-wider shrink-0">
        <span>Symbol</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Avg</span>
        <span className="text-right">LTP</span>
        <span className="text-right">P&L</span>
        <span></span>
      </div>

      {/* Position rows */}
      <div className="flex-1 overflow-auto">
        {positions.map((pos: any, idx: number) => {
          const display = formatSymbolDisplay(pos.symbol);
          const isExiting = exitingSymbol === pos.symbol;
          const qtyColor = pos.quantity > 0 ? 'text-emerald-400' : 'text-red-400';
          const pnlColor = pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';

          return (
            <div
              key={`${pos.symbol}-${pos.exchange}-${pos.product}`}
              onClick={() => setActiveSymbol({ symbol: pos.symbol, exchange: pos.exchange })}
              className={`
                grid grid-cols-[1fr_50px_65px_65px_80px_40px] px-2 py-1.5 items-center
                border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e] transition-colors cursor-pointer
                ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0a12]'}
              `}
            >
              {/* Symbol */}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-zinc-200 truncate">{display.main}</span>
                  {pos.exchange !== 'NSE' && !pos.exchange.includes('_INDEX') && (
                    <span className="text-[7px] px-1 bg-[#1e1e30] text-zinc-600 rounded shrink-0">
                      {pos.exchange}
                    </span>
                  )}
                </div>
                {display.sub && (
                  <span className="text-[9px] text-zinc-500">{display.sub}</span>
                )}
              </div>

              {/* Qty */}
              <span className={`text-right tabular-nums font-medium ${qtyColor}`}>
                {pos.quantity > 0 ? '+' : ''}{pos.quantity}
              </span>

              {/* Avg */}
              <span className="text-right tabular-nums text-zinc-500">
                {formatPrice(pos.averagePrice)}
              </span>

              {/* LTP */}
              <span className="text-right tabular-nums text-zinc-200">
                {pos.ltp > 0 ? formatPrice(pos.ltp) : '—'}
              </span>

              {/* P&L */}
              <div className="text-right">
                <span className={`tabular-nums ${pnlColor}`}>
                  {pos.pnl >= 0 ? '+' : ''}{formatIndianNumber(pos.pnl)}
                </span>
                <div className={`text-[9px] ${pnlColor} opacity-60`}>
                  {formatPercent(pos.pnlPercent)}
                </div>
              </div>

              {/* Exit button */}
              <div className="flex justify-center">
                <button
                  onClick={() => setShowExitConfirm(pos)}
                  disabled={isExiting}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  title="Exit position"
                >
                  {isExiting ? (
                    <Loader2 size={10} className="text-zinc-500 animate-spin" />
                  ) : (
                    <LogOut size={10} className="text-zinc-600 hover:text-red-400" />
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {positions.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-[11px]">
            No open positions
          </div>
        )}

        {isLoading && positions.length === 0 && (
          <div className="p-2 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="grid grid-cols-[1fr_50px_65px_65px_80px_40px] gap-2 items-center">
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

      {/* Bottom summary */}
      <div className="grid grid-cols-3 gap-px border-t border-[#1e1e30] bg-[#0a0a12] text-[10px] shrink-0">
        <div className="px-2 py-1.5 text-center">
          <div className="text-zinc-600">Total P&L</div>
          <div className={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {totalPnl >= 0 ? '+' : ''}{formatIndianNumber(totalPnl)}
          </div>
        </div>
        <div className="px-2 py-1.5 text-center">
          <div className="text-zinc-600">Realized</div>
          <div className={parseFloat(String(realized)) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {formatIndianNumber(parseFloat(String(realized)) || 0)}
          </div>
        </div>
        <div className="px-2 py-1.5 text-center">
          <div className="text-zinc-600">Unrealized</div>
          <div className={parseFloat(String(unrealized)) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {formatIndianNumber(parseFloat(String(unrealized)) || 0)}
          </div>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0e0e16] border border-[#2a2a42] rounded-sm p-5 w-[320px] space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={16} />
              <span className="text-sm font-bold">Exit Position</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between border-b border-[#1e1e30] pb-1">
                <span className="text-zinc-500">Symbol</span>
                <span className="text-zinc-200 font-medium">{showExitConfirm.symbol}</span>
              </div>
              <div className="flex justify-between border-b border-[#1e1e30] py-1">
                <span className="text-zinc-500">Quantity</span>
                <span className={showExitConfirm.quantity > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {Math.abs(showExitConfirm.quantity)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#1e1e30] py-1">
                <span className="text-zinc-500">Action</span>
                <span className={showExitConfirm.quantity > 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {showExitConfirm.quantity > 0 ? 'SELL' : 'BUY'} (MARKET)
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Current P&L</span>
                <PnLCell value={showExitConfirm.pnl} size="sm" showPercent={false} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowExitConfirm(null)}
                className="flex-1 py-2 rounded-sm text-[11px] border border-[#2a2a42] text-zinc-400 hover:bg-[#1e1e30] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExit(showExitConfirm)}
                className="flex-1 py-2 rounded-sm text-[11px] font-bold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Exit Position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
