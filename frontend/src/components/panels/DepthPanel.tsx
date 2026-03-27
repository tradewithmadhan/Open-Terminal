'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { marketApi } from '@/lib/api-client';
import { formatPrice, formatQty } from '@/lib/formatters';

export function DepthPanel() {
  const { activeSymbol } = useTerminalStore();
  const [depth, setDepth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDepth = useCallback(async () => {
    if (!activeSymbol) return;
    setIsLoading(true);
    try {
      const { data } = await marketApi.depth(activeSymbol.symbol, activeSymbol.exchange);
      if (data.status === 'success') {
        setDepth(data.data || data);
      }
    } catch (err) {
      console.error('Depth fetch error:', err);
    }
    setIsLoading(false);
  }, [activeSymbol?.symbol, activeSymbol?.exchange]);

  // Fetch on mount and every 2 seconds
  useEffect(() => {
    fetchDepth();
    const interval = setInterval(fetchDepth, 5000); // 5s to stay within rate limits
    return () => clearInterval(interval);
  }, [fetchDepth]);

  // Parse depth data
  const { bids, asks, totalBuy, totalSell, maxQty } = useMemo(() => {
    if (!depth) return { bids: [], asks: [], totalBuy: 0, totalSell: 0, maxQty: 1 };

    const bids = Array.isArray(depth.bids) ? depth.bids.slice(0, 5) : [];
    const asks = Array.isArray(depth.asks) ? depth.asks.slice(0, 5) : [];
    const totalBuy = depth.totalbuyqty || bids.reduce((s: number, b: any) => s + (b.quantity || 0), 0);
    const totalSell = depth.totalsellqty || asks.reduce((s: number, a: any) => s + (a.quantity || 0), 0);
    const maxQty = Math.max(
      ...bids.map((b: any) => b.quantity || 0),
      ...asks.map((a: any) => a.quantity || 0),
      1
    );

    return { bids, asks, totalBuy, totalSell, maxQty };
  }, [depth]);

  const buyRatio = totalBuy + totalSell > 0 ? (totalBuy / (totalBuy + totalSell)) * 100 : 50;

  if (!activeSymbol) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-[11px]">
        Select a symbol from watchlist to view depth
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-200 font-bold truncate">{activeSymbol.symbol}</span>
        {!activeSymbol.exchange.includes('_INDEX') && (
          <span className="text-[8px] px-1 bg-[#1e1e30] text-zinc-500 rounded font-bold shrink-0">{activeSymbol.exchange}</span>
        )}
        </div>
        <div className="flex items-center gap-2">
          {depth?.last_price && (
            <span className="text-zinc-300 tabular-nums font-medium">{formatPrice(depth.last_price)}</span>
          )}
          {isLoading && <Loader2 size={10} className="text-zinc-600 animate-spin" />}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-2 py-1 border-b border-[#1e1e30] text-[9px] text-zinc-600 uppercase tracking-wider shrink-0 bg-[#08080d]/50">
        <span>Buy Qty</span>
        <span className="text-center">Price</span>
        <span className="text-right">Sell Qty</span>
      </div>

      {/* Depth table */}
      <div className="flex-1 overflow-auto bg-[#08080d]">
        {/* Asks (reversed — best ask at bottom) */}
        {[...asks].reverse().map((ask: any, idx: number) => {
          const barWidth = (ask.quantity / maxQty) * 100;
          return (
            <div key={`ask-${idx}`} className="grid grid-cols-3 px-2 py-1 items-center relative group hover:bg-white/[0.02]">
              <span></span>
              <span className="text-center tabular-nums text-red-400 font-medium z-10">{formatPrice(ask.price)}</span>
              <div className="flex items-center justify-end gap-1 z-10">
                <span className="text-right tabular-nums text-zinc-400 text-[10px]">{formatQty(ask.quantity)}</span>
                <div
                  className="absolute right-0 top-0 bottom-0 bg-red-500/10 group-hover:bg-red-500/20 transition-all"
                  style={{ width: `${barWidth / 2}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Spread line & Separator */}
        <div className="border-y border-[#1e1e30] px-2 py-0.5 text-center bg-[#14141f]/30">
          {bids.length > 0 && asks.length > 0 && (
            <span className="text-[9px] text-zinc-500 font-medium tracking-tight">
              SPREAD: {formatPrice((asks[0]?.price || 0) - (bids[0]?.price || 0))}
            </span>
          )}
        </div>

        {/* Bids */}
        {bids.map((bid: any, idx: number) => {
          const barWidth = (bid.quantity / maxQty) * 100;
          return (
            <div key={`bid-${idx}`} className="grid grid-cols-3 px-2 py-1 items-center relative group hover:bg-white/[0.02]">
              <div className="flex items-center gap-1 z-10">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-all"
                  style={{ width: `${barWidth / 2}%` }}
                />
                <span className="tabular-nums text-zinc-400 text-[10px]">{formatQty(bid.quantity)}</span>
              </div>
              <span className="text-center tabular-nums text-emerald-400 font-medium z-10">{formatPrice(bid.price)}</span>
              <span></span>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="px-2 py-2 border-t border-[#1e1e30] bg-[#0a0a12] space-y-1.5 shrink-0">
        <div className="flex justify-between text-[10px] font-medium">
          <span className="text-emerald-400">Total Buy: {formatQty(totalBuy)}</span>
          <span className="text-red-400">Total Sell: {formatQty(totalSell)}</span>
        </div>
        {/* Ratio bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden bg-[#1e1e30] ring-1 ring-[#2a2a42]">
          <div 
            className="bg-emerald-500/70 transition-all duration-700 ease-out border-r border-[#08080d]" 
            style={{ width: `${buyRatio}%` }} 
          />
          <div 
            className="bg-red-500/70 transition-all duration-700 ease-out" 
            style={{ width: `${100 - buyRatio}%` }} 
          />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-500 font-bold tabular-nums">
          <span>{buyRatio.toFixed(1)}% BUY</span>
          <span>{(100 - buyRatio).toFixed(1)}% SELL</span>
        </div>

        {/* Market Stats Grid */}
        <div className="grid grid-cols-4 gap-y-2 gap-x-3 pt-2 mt-2 border-t border-[#1e1e30]/50 text-[10px]">
          <Stat label="Open" value={formatPrice(depth?.open_price)} />
          <Stat label="High" value={formatPrice(depth?.high_price)} variant="up" />
          <Stat label="Low" value={formatPrice(depth?.low_price)} variant="down" />
          <Stat label="Close" value={formatPrice(depth?.close_price || depth?.prev_close)} />
          
          <Stat label="Volume" value={formatQty(depth?.volume)} />
          <Stat label="ATP" value={formatPrice(depth?.atp)} />
          <Stat label="OI" value={formatQty(depth?.oi)} />
          <Stat label="OI Chg" value={formatQty(depth?.oi_change)} variant={depth?.oi_change >= 0 ? 'up' : 'down'} />

          <Stat label="LCL" value={formatPrice(depth?.lower_circuit_limit)} variant="down" />
          <Stat label="UCL" value={formatPrice(depth?.upper_circuit_limit)} variant="up" />
          <Stat label="52W H" value={formatPrice(depth?.fifty_two_week_high)} />
          <Stat label="52W L" value={formatPrice(depth?.fifty_two_week_low)} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: string; variant?: 'up' | 'down' }) {
  const color = variant === 'up' ? 'text-emerald-400' : variant === 'down' ? 'text-red-400' : 'text-zinc-300';
  return (
    <div className="flex flex-col">
      <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-tighter">{label}</span>
      <span className={`tabular-nums font-medium truncate ${color}`}>{value || '—'}</span>
    </div>
  );
}
