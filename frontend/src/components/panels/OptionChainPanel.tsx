'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { optionsApi } from '@/lib/api-client';
import { formatPrice } from '@/lib/formatters';
import type { Exchange } from '@/lib/types';

const UNDERLYINGS = [
  { symbol: 'NIFTY', exchange: 'NSE_INDEX' as Exchange, label: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' as Exchange, label: 'BANK NIFTY' },
  { symbol: 'SENSEX', exchange: 'BSE_INDEX' as Exchange, label: 'SENSEX' },
  { symbol: 'FINNIFTY', exchange: 'NSE_INDEX' as Exchange, label: 'FIN NIFTY' },
  { symbol: 'MIDCPNIFTY', exchange: 'NSE_INDEX' as Exchange, label: 'MIDCAP' },
];

const STRIKE_COUNTS = [5, 10, 15, 20];

// Convert "10-JUL-25" → "10JUL25"
function convertExpiry(expiry: string): string {
  return expiry.replace(/-/g, '').toUpperCase();
}

// Format expiry for display: "10-JUL-25" → "10 Jul"
function formatExpiryDisplay(expiry: string): string {
  const parts = expiry.split('-');
  if (parts.length === 3) {
    return `${parts[0]} ${parts[1]}`;
  }
  return expiry;
}

// Format OI/Volume compactly
function fmtCompact(val: number): string {
  if (!val) return '—';
  if (val >= 1e7) return `${(val / 1e7).toFixed(1)}Cr`;
  if (val >= 1e5) return `${(val / 1e5).toFixed(1)}L`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return String(val);
}

export function OptionChainPanel() {
  const { setActiveSymbol, togglePanel } = useTerminalStore();

  const [underlying, setUnderlying] = useState(UNDERLYINGS[0]);
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [strikeCount, setStrikeCount] = useState(10);
  const [chainData, setChainData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExpiry, setIsLoadingExpiry] = useState(false);
  const [showGreeks, setShowGreeks] = useState(false);

  // ─── Fetch expiry dates ────────────────────────
  const fetchExpiries = useCallback(async () => {
    setIsLoadingExpiry(true);
    try {
      const { data } = await optionsApi.expiry(
        underlying.symbol,
        underlying.symbol === 'SENSEX' ? 'BFO' : 'NFO',
        'options'
      );
      if (data.status === 'success' && data.data) {
        const expiryList = Array.isArray(data.data) ? data.data : [];
        setExpiries(expiryList);
        // Only set default if nothing is selected or if the current selection isn't in the new list
        if (expiryList.length > 0) {
          setSelectedExpiry(prev => {
            if (!prev || !expiryList.includes(prev)) return expiryList[0];
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Expiry fetch error:', err);
    }
    setIsLoadingExpiry(false);
  }, [underlying.symbol]); // Removed selectedExpiry dependency

  // Reset and fetch when underlying changes
  useEffect(() => {
    setSelectedExpiry('');
    setChainData(null);
    fetchExpiries();
  }, [underlying.symbol, fetchExpiries]); 

  // ─── Fetch option chain ────────────────────────
  const fetchChain = useCallback(async () => {
    if (!selectedExpiry) return;
    setIsLoading(true);
    try {
      const apiExpiry = convertExpiry(selectedExpiry);
      const { data } = await optionsApi.chain(
        underlying.symbol,
        underlying.exchange,
        apiExpiry,
        strikeCount
      );
      if (data.status === 'success') {
        setChainData(data);
      }
    } catch (err) {
      console.error('Option chain fetch error:', err);
    }
    setIsLoading(false);
  }, [underlying.symbol, underlying.exchange, selectedExpiry, strikeCount]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

  // Auto-refresh chain every 15s
  useEffect(() => {
    if (!selectedExpiry) return;
    const timer = window.setInterval(fetchChain, 15000); // 15s to stay within rate limits
    return () => window.clearInterval(timer);
  }, [fetchChain, selectedExpiry]);

  // ─── Parse chain data ─────────────────────────
  const { chain, spotPrice, atmStrike, totalCeOi, totalPeOi, pcr } = useMemo(() => {
    if (!chainData) return { chain: [], spotPrice: 0, atmStrike: 0, totalCeOi: 0, totalPeOi: 0, pcr: 0 };

    const chain = chainData.chain || [];
    const spotPrice = chainData.underlying_ltp || 0;
    const atmStrike = chainData.atm_strike || 0;
    const totalCeOi = chain.reduce((s: number, row: any) => s + Number(row.ce?.oi || 0), 0);
    const totalPeOi = chain.reduce((s: number, row: any) => s + Number(row.pe?.oi || 0), 0);
    const pcr = totalCeOi > 0 ? totalPeOi / totalCeOi : 0;

    return { chain, spotPrice, atmStrike, totalCeOi, totalPeOi, pcr };
  }, [chainData]);

  // ─── Handle option click ──────────────────────
  const handleOptionClick = useCallback((symbol: string, exchange: string) => {
    if (symbol) {
      setActiveSymbol({
        symbol,
        exchange: (exchange || (underlying.symbol === 'SENSEX' ? 'BFO' : 'NFO')) as Exchange,
      });
      // Show Greeks when an option is selected from chain
      togglePanel('greeks');
    }
  }, [setActiveSymbol, togglePanel, underlying.symbol]);

  return (
    <div className="flex flex-col h-full text-xs bg-[#08080d]">
      {/* Header controls */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1e1e30] flex-wrap bg-[#0a0a12]">
        <select
          value={underlying.symbol}
          onChange={(e) => {
            const u = UNDERLYINGS.find(u => u.symbol === e.target.value);
            if (u) setUnderlying(u);
          }}
          className="bg-[#0e0e16] border border-[#2a2a42] rounded px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-emerald-500/50"
        >
          {UNDERLYINGS.map(u => (
            <option key={u.symbol} value={u.symbol}>{u.label}</option>
          ))}
        </select>

        <select
          value={selectedExpiry}
          onChange={(e) => setSelectedExpiry(e.target.value)}
          disabled={isLoadingExpiry}
          className="bg-[#0e0e16] border border-[#2a2a42] rounded px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-emerald-500/50"
        >
          {expiries.map(exp => (
            <option key={exp} value={exp}>{formatExpiryDisplay(exp)}</option>
          ))}
        </select>

        <div className="flex items-center gap-4 ml-2">
          {spotPrice > 0 && (
            <span className="text-[10px] text-zinc-500">
              Spot: <span className="text-zinc-100 font-bold tabular-nums">{formatPrice(spotPrice)}</span>
            </span>
          )}
          {atmStrike > 0 && (
            <span className="text-[10px] text-zinc-500">
              ATM: <span className="text-emerald-400 font-bold tabular-nums">{atmStrike}</span>
            </span>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          {STRIKE_COUNTS.map(sc => (
            <button
              key={sc}
              onClick={() => setStrikeCount(sc)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                strikeCount === sc ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              ±{sc}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-[#0e0e16] border border-[#2a2a42] rounded px-1 py-0.5 ml-2">
          <button
            onClick={() => setShowGreeks(false)}
            className={`px-2 py-0.5 text-[9px] rounded-sm transition-colors ${!showGreeks ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-zinc-600'}`}
          >
            DATA
          </button>
          <button
            onClick={() => setShowGreeks(true)}
            className={`px-2 py-0.5 text-[9px] rounded-sm transition-colors ${showGreeks ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-zinc-600'}`}
          >
            GREEKS
          </button>
        </div>

        <button onClick={fetchChain} className="p-1 hover:bg-[#1e1e30] rounded ml-1">
          <RefreshCw size={10} className={`text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Column headers */}
      <div className={`grid ${showGreeks ? 'grid-cols-[100px_45px_45px_45px_1fr_45px_45px_45px_100px]' : 'grid-cols-[80px_60px_60px_60px_1fr_60px_60px_60px_80px]'} px-2 py-1.5 border-b border-[#1e1e30] text-[9px] text-zinc-600 uppercase tracking-wider font-bold bg-[#0e0e16]`}>
        {showGreeks ? (
          <>
            <span className="text-right">DELTA/THETA</span>
            <span className="text-right">VEGA</span>
            <span className="text-right">GAMMA</span>
            <span className="text-right text-emerald-600 pr-1">LTP</span>
            <span className="text-center">STRIKE</span>
            <span className="text-left text-red-600 pl-1">LTP</span>
            <span className="text-left">GAMMA</span>
            <span className="text-left">VEGA</span>
            <span className="text-left">DELTA/THETA</span>
          </>
        ) : (
          <>
            <span className="text-right pr-2">Bid/Ask</span>
            <span className="text-right">Vol</span>
            <span className="text-right">OI</span>
            <span className="text-right text-emerald-600 pr-1">CE LTP</span>
            <span className="text-center">STRIKE</span>
            <span className="text-left text-red-600 pl-1">PE LTP</span>
            <span className="text-left">OI</span>
            <span className="text-left">Vol</span>
            <span className="text-left pl-2">Bid/Ask</span>
          </>
        )}
      </div>

      {/* Chain rows */}
      <div className="flex-1 overflow-auto">
        {chain.map((row: any, idx: number) => {
          const isAtm = row.strike === atmStrike;
          const ceItm = row.strike < atmStrike;
          const peItm = row.strike > atmStrike;
          const ce = row.ce || {};
          const pe = row.pe || {};

          return (
            <div
              key={row.strike}
              className={`
                grid ${showGreeks ? 'grid-cols-[100px_45px_45px_45px_1fr_45px_45px_45px_100px]' : 'grid-cols-[80px_60px_60px_60px_1fr_60px_60px_60px_80px]'} px-2 py-1 items-center
                border-b border-[#1e1e30]/30 transition-colors
                ${isAtm ? 'bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/20' : ''}
                ${ceItm && !isAtm ? 'bg-emerald-500/[0.03]' : ''}
                ${peItm && !isAtm ? 'bg-red-500/[0.03]' : ''}
                ${idx % 2 && !isAtm ? 'bg-[#0a0a12]/30' : ''}
                hover:bg-white/[0.04]
              `}
            >
              {showGreeks ? (
                <>
                  <div className="text-right text-[9px]">
                    <div className="text-zinc-300">{(ce.delta || 0).toFixed(2)}</div>
                    <div className="text-zinc-600">{(ce.theta || 0).toFixed(1)}</div>
                  </div>
                  <span className="text-right text-zinc-500 tabular-nums">{(ce.vega || 0).toFixed(1)}</span>
                  <span className="text-right text-zinc-500 tabular-nums">{(ce.gamma || 0).toFixed(3)}</span>
                </>
              ) : (
                <>
                  <span className="text-right text-[10px] text-zinc-600 pr-2 tabular-nums">
                    {ce.bid ? `${formatPrice(ce.bid)}/${formatPrice(ce.ask)}` : '—'}
                  </span>
                  <span className="text-right tabular-nums text-zinc-500 font-medium">{fmtCompact(ce.volume)}</span>
                  <span className="text-right tabular-nums text-zinc-400">{fmtCompact(ce.oi)}</span>
                </>
              )}

              <button
                className="text-right tabular-nums text-emerald-400 font-bold pr-1 hover:underline"
                onClick={() => handleOptionClick(ce.symbol, '')}
              >
                {ce.ltp ? formatPrice(ce.ltp) : '—'}
              </button>

              <span className={`text-center tabular-nums font-black ${isAtm ? 'text-emerald-400 text-xs' : 'text-zinc-400'}`}>
                {isAtm ? `► ${row.strike} ◄` : row.strike}
              </span>

              <button
                className="text-left tabular-nums text-red-400 font-bold pl-1 hover:underline"
                onClick={() => handleOptionClick(pe.symbol, '')}
              >
                {pe.ltp ? formatPrice(pe.ltp) : '—'}
              </button>

              {showGreeks ? (
                <>
                  <span className="text-left text-zinc-500 tabular-nums">{(pe.gamma || 0).toFixed(3)}</span>
                  <span className="text-left text-zinc-500 tabular-nums">{(pe.vega || 0).toFixed(1)}</span>
                  <div className="text-left text-[9px]">
                    <div className="text-zinc-300">{(pe.delta || 0).toFixed(2)}</div>
                    <div className="text-zinc-600">{(pe.theta || 0).toFixed(1)}</div>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-left tabular-nums text-zinc-400">{fmtCompact(pe.oi)}</span>
                  <span className="text-left tabular-nums text-zinc-500 font-medium">{fmtCompact(pe.volume)}</span>
                  <span className="text-left text-[10px] text-zinc-600 pl-2 tabular-nums">
                    {pe.bid ? `${formatPrice(pe.bid)}/${formatPrice(pe.ask)}` : '—'}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#1e1e30] bg-[#0e0e16] text-[10px] font-medium">
        <div className="flex gap-4">
          <span className="text-zinc-500">Total CE OI: <span className="text-emerald-400">{fmtCompact(totalCeOi)}</span></span>
          <span className="text-zinc-500">Total PE OI: <span className="text-red-400">{fmtCompact(totalPeOi)}</span></span>
        </div>
        <span className="text-zinc-500">
          PCR: <span className={`font-black px-2 py-0.5 rounded-sm ${
            pcr > 1.1 ? 'bg-emerald-500/10 text-emerald-400' : pcr < 0.7 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            {pcr.toFixed(2)}
          </span>
        </span>
      </div>
    </div>
  );
}
