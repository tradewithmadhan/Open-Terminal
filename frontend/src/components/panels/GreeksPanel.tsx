'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, TrendingUp, Info } from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { optionsApi } from '@/lib/api-client';
import { formatPrice } from '@/lib/formatters';

// Check if symbol is an option
function isOptionSymbol(symbol: string): boolean {
  return /\d+(CE|PE)$/i.test(symbol);
}

// Parse option symbol (e.g., NIFTY25JAN2525400CE)
function parseOptionSymbol(symbol: string) {
  const match = symbol.match(/^([A-Z]+)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/);
  if (match) {
    return {
      underlying: match[1],
      expiry: match[2],
      strike: parseInt(match[3]),
      type: match[4] as 'CE' | 'PE',
    };
  }
  return null;
}

export function GreeksPanel() {
  const { activeSymbol } = useTerminalStore();
  const [greeksData, setGreeksData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOption = useMemo(() => activeSymbol ? isOptionSymbol(activeSymbol.symbol) : false, [activeSymbol?.symbol]);
  const parsed = useMemo(() => activeSymbol ? parseOptionSymbol(activeSymbol.symbol) : null, [activeSymbol?.symbol]);

  const fetchGreeks = useCallback(async () => {
    if (!activeSymbol || !isOption) return;

    setIsLoading(true);
    setError(null);

    try {
      const exchange = activeSymbol.exchange === 'NSE_INDEX' || activeSymbol.exchange === 'BSE_INDEX'
        ? (activeSymbol.symbol.includes('SENSEX') ? 'BFO' : 'NFO')
        : activeSymbol.exchange;

      const extras: Record<string, any> = {};
      if (parsed) {
        extras.underlying_symbol = parsed.underlying;
        extras.underlying_exchange = parsed.underlying === 'SENSEX' ? 'BSE_INDEX' : 'NSE_INDEX';
      }

      const { data } = await optionsApi.greeks(activeSymbol.symbol, exchange, extras);

      if (data.status === 'success') {
        setGreeksData(data);
      } else {
        setError(data.message || 'Greeks not available for this broker');
      }
    } catch (err: any) {
      setError('Service connection error');
    }
    setIsLoading(false);
  }, [activeSymbol?.symbol, activeSymbol?.exchange, isOption, parsed]);

  useEffect(() => {
    fetchGreeks();
  }, [fetchGreeks]);

  useEffect(() => {
    if (!isOption) return;
    const timer = window.setInterval(fetchGreeks, 15000); // Increased to 15s to respect rate limits
    return () => window.clearInterval(timer);
  }, [fetchGreeks, isOption]);

  if (!activeSymbol || !isOption) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-[11px] gap-3 px-6 text-center animate-in fade-in duration-500">
        <TrendingUp size={24} className="text-zinc-800" />
        <div>
          <p className="font-bold text-zinc-500 uppercase tracking-widest text-[9px] mb-1">Advanced Analysis</p>
          <p>Select an option strike from the chain to view Greeks (Delta, Gamma, Vega, Theta)</p>
        </div>
      </div>
    );
  }

  if (isLoading && !greeksData) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-zinc-600 text-xs">
        <Loader2 size={12} className="animate-spin text-emerald-500" /> Calculating Greeks...
      </div>
    );
  }

  if (error && !greeksData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-xs p-6 text-center gap-2">
        <Info size={16} className="text-amber-500/50" />
        <span>{error}</span>
      </div>
    );
  }

  const g = greeksData?.greeks || {};
  const iv = greeksData?.implied_volatility || 0;
  const spot = greeksData?.spot_price || 0;
  const strike = greeksData?.strike || parsed?.strike || 0;
  const optType = greeksData?.option_type || parsed?.type || '';
  const dte = greeksData?.days_to_expiry || 0;
  const optPrice = greeksData?.option_price || 0;
  const expiryDate = greeksData?.expiry_date || '';

  const greeksList = [
    { name: 'Delta', value: g.delta || 0, format: (v: number) => v.toFixed(4), barPct: Math.abs(g.delta || 0) * 100, color: 'bg-emerald-500' },
    { name: 'Gamma', value: g.gamma || 0, format: (v: number) => v.toFixed(6), barPct: Math.min(Math.abs(g.gamma || 0) * 10000, 100), color: 'bg-purple-500' },
    { name: 'Theta', value: g.theta || 0, format: (v: number) => v.toFixed(2), barPct: Math.min(Math.abs(g.theta || 0) * 4, 100), color: 'bg-red-500' },
    { name: 'Vega', value: g.vega || 0, format: (v: number) => v.toFixed(2), barPct: Math.min(Math.abs(g.vega || 0) * 3, 100), color: 'bg-cyan-500' },
    { name: 'Rho', value: g.rho || 0, format: (v: number) => v.toFixed(4), barPct: Math.min(Math.abs(g.rho || 0) * 20, 100), color: 'bg-zinc-500' },
  ];

  return (
    <div className="flex flex-col h-full p-3 text-[11px] gap-3 bg-[#08080d] select-none">
      {/* Symbol info */}
      <div className="bg-[#0e0e16] p-2 rounded border border-[#1e1e30]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white tracking-tight">{activeSymbol.symbol}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold ${
            optType === 'CE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>{optType}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10px]">
          <div className="flex justify-between border-b border-[#1e1e30]/50 pb-0.5">
            <span className="text-zinc-500">Spot</span>
            <span className="text-zinc-200 font-bold tabular-nums">{formatPrice(spot)}</span>
          </div>
          <div className="flex justify-between border-b border-[#1e1e30]/50 pb-0.5">
            <span className="text-zinc-500">Strike</span>
            <span className="text-zinc-200 font-bold tabular-nums">{strike}</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="text-zinc-500">DTE</span>
            <span className="text-zinc-100 font-bold">{dte.toFixed(1)} <span className="text-[8px] text-zinc-600">DAYS</span></span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="text-zinc-500">Price</span>
            <span className="text-emerald-400 font-bold tabular-nums">₹{formatPrice(optPrice)}</span>
          </div>
        </div>
      </div>

      {/* IV Gauge */}
      <div className="p-2 border border-[#b388ff]/10 bg-[#b388ff]/[0.02] rounded relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100 transition-opacity">
          <Info size={10} className="text-[#b388ff]" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold">Implied Volatility</span>
          <span className="text-sm font-black text-[#b388ff]">{iv.toFixed(2)}%</span>
        </div>
        <div className="mt-2 h-1 bg-[#1e1e30] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/50 via-[#b388ff] to-red-500/50 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(179,136,255,0.4)]"
            style={{ width: `${Math.min(iv * 2, 100)}%` }}
          />
        </div>
      </div>

      {/* Greeks Bars */}
      <div className="space-y-2.5 px-1 py-1">
        {greeksList.map(greek => (
          <div key={greek.name} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500 font-bold tracking-wider">{greek.name}</span>
              <span className={`tabular-nums font-black ${greek.value < 0 ? 'text-red-400' : 'text-zinc-200'}`}>
                {greek.format(greek.value)}
              </span>
            </div>
            <div className="h-1 bg-[#1e1e30] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${greek.color}`}
                style={{ width: `${greek.barPct}%`, opacity: 0.6 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1" />
      
      {/* Warning/Info Footer */}
      <div className="p-2 bg-amber-500/5 border border-amber-500/10 rounded-sm">
        <p className="text-[8px] leading-tight text-amber-500/70 italic">
          * Greeks are calculated using Black-Scholes model and may vary based on broker precision.
        </p>
      </div>
    </div>
  );
}
