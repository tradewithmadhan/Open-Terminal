'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Trash2, Play, Calculator, Loader2, RefreshCw, Info,
  TrendingUp, TrendingDown, Target
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Label
} from 'recharts';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { marketApi, optionsApi, orderApi, portfolioApi } from '@/lib/api-client';
import { formatPrice, formatIndianNumber } from '@/lib/formatters';
import { showToast } from '@/components/common/ToastManager';
import type { Exchange } from '@/lib/types';

interface SpreadLeg {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  strike: number;
  symbol: string;
  price: number;
  quantity: number;
  greeks?: {
    delta: number;
    theta: number;
    gamma: number;
    vega: number;
  };
}

const STRATEGIES = [
  { value: 'bull_call', label: 'Bull Call', legs: [
    { action: 'BUY', type: 'CE', offset: 'ATM' },
    { action: 'SELL', type: 'CE', offset: 'OTM1' },
  ]},
  { value: 'bear_put', label: 'Bear Put', legs: [
    { action: 'BUY', type: 'PE', offset: 'ATM' },
    { action: 'SELL', type: 'PE', offset: 'OTM1' },
  ]},
  { value: 'long_straddle', label: 'Long Straddle', legs: [
    { action: 'BUY', type: 'CE', offset: 'ATM' },
    { action: 'BUY', type: 'PE', offset: 'ATM' },
  ]},
  { value: 'short_straddle', label: 'Short Straddle', legs: [
    { action: 'SELL', type: 'CE', offset: 'ATM' },
    { action: 'SELL', type: 'PE', offset: 'ATM' },
  ]},
  { value: 'iron_condor', label: 'Iron Condor', legs: [
    { action: 'BUY', type: 'PE', offset: 'OTM2' },
    { action: 'SELL', type: 'PE', offset: 'OTM1' },
    { action: 'SELL', type: 'CE', offset: 'OTM1' },
    { action: 'BUY', type: 'CE', offset: 'OTM2' },
  ]},
  { value: 'custom', label: 'Custom', legs: [] },
];

const INDEX_CONFIG: Record<string, { gap: number; exchange: Exchange }> = {
  'NIFTY': { gap: 50, exchange: 'NSE_INDEX' },
  'BANKNIFTY': { gap: 100, exchange: 'NSE_INDEX' },
  'SENSEX': { gap: 100, exchange: 'BSE_INDEX' },
  'FINNIFTY': { gap: 50, exchange: 'NSE_INDEX' },
  'MIDCPNIFTY': { gap: 100, exchange: 'NSE_INDEX' },
};

export function StrategyBuilderPanel() {
  const { defaults } = useTerminalStore();

  const [underlying, setUnderlying] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [strategy, setStrategy] = useState('bull_call');
  const [legs, setLegs] = useState<SpreadLeg[]>([]);
  const [atmStrike, setAtmStrike] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lots, setLots] = useState(1);
  const [marginEst, setMarginEst] = useState<number | null>(null);

  const config = INDEX_CONFIG[underlying] || { gap: 100, exchange: 'NSE' as Exchange };
  const currentLotSize = defaults.lotSizes?.[underlying] || 1;
  const totalQty = lots * currentLotSize;

  // Helper to format expiry for OptionChain/Symbol API
  const formatExpiryForApi = useCallback((dateStr: string) => {
    return dateStr.replace(/-/g, '').toUpperCase();
  }, []);

  // Helper to extract strike from symbol (e.g., NIFTY30MAR2623200PE -> 23200)
  const extractStrikeFromSymbol = useCallback((symbol: string, currentUnderlying: string, currentExpiry: string) => {
    try {
      if (!symbol) return 0;
      // 1. Strip known prefix: Underlying + Expiry
      const formattedExp = currentExpiry ? currentExpiry.replace(/-/g, '').toUpperCase() : '';
      const prefix = `${currentUnderlying}${formattedExp}`;
      if (prefix && symbol.startsWith(prefix)) {
        const remainder = symbol.slice(prefix.length); // e.g. "23200PE"
        const strikeStr = remainder.replace(/(CE|PE)$/, '');
        const parsed = parseInt(strikeStr);
        if (!isNaN(parsed)) return parsed;
      }
      
      // 2. Fallback: match standard Indian format [A-Z]{3}(\d{2})(\d+)(CE|PE)$
      const match = symbol.match(/[A-Z]{3}(\d{2})(\d+)(CE|PE)$/);
      if (match) return parseInt(match[2]);
      
      // 3. Absolute fallback
      const fallback = symbol.match(/(\d+)(CE|PE)$/);
      if (fallback) {
         const valStr = fallback[1];
         return parseInt(valStr.length > 5 ? valStr.slice(-5) : valStr);
      }
    } catch (e) {
      console.error("Error parsing strike:", symbol);
    }
    return 0;
  }, []);

  // 1. Fetch Expiries
  useEffect(() => {
    const fetchExpiry = async () => {
      try {
        const nfoExchange = (underlying === 'SENSEX' || underlying === 'BANKEX') ? 'BFO' : 'NFO';
        const { data } = await optionsApi.expiry(underlying, nfoExchange, 'options');
        if (data.status === 'success' && data.data) {
          setExpiries(data.data);
          if (data.data.length > 0) setExpiry(data.data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch expiries:', err);
      }
    };
    fetchExpiry();
  }, [underlying]);

  // 2. Fetch Spot Price & Calc ATM
  const fetchSpot = useCallback(async () => {
    try {
      const { data } = await marketApi.quote(underlying, config.exchange);
      if (data.status === 'success') {
        const ltp = data.data?.ltp || data.ltp || 0;
        if (ltp > 0) {
          const rounded = Math.round(ltp / config.gap) * config.gap;
          setAtmStrike(rounded);
        }
      }
    } catch {}
  }, [underlying, config.exchange, config.gap]);

  useEffect(() => {
    fetchSpot();
  }, [fetchSpot]);

  // 3. Build Strategy Legs (using API symbols with OFFSETS)
  const syncStrategy = useCallback(async () => {
    if (strategy === 'custom' || !expiry) return;
    setIsSyncing(true);
    const preset = STRATEGIES.find(s => s.value === strategy);
    if (!preset || preset.legs.length === 0) { setIsSyncing(false); return; }

    const formattedExpiry = formatExpiryForApi(expiry);
    
    try {
      const newLegs: SpreadLeg[] = [];
      for (let i = 0; i < preset.legs.length; i++) {
        const legDef = preset.legs[i];
        // Fetch accurate symbol based on offset (ATM, OTM1, etc.)
        const { data } = await optionsApi.symbol(
          underlying,
          config.exchange,
          formattedExpiry,
          legDef.type,
          legDef.offset
        );
        
        if (data.status === 'success' && data.symbol) {
          const parsedStrike = data.strike || extractStrikeFromSymbol(data.symbol, underlying, expiry);
          newLegs.push({
            id: `leg-${i}`,
            action: legDef.action as 'BUY' | 'SELL',
            optionType: legDef.type as 'CE' | 'PE',
            strike: parsedStrike,
            symbol: data.symbol,
            price: 0,
            quantity: totalQty,
          });
        }
      }
      setLegs(newLegs);
      setMarginEst(null); // Reset margin estimation
    } catch (err) {
      console.error('Failed to sync strategy:', err);
      showToast('error', 'Strategy Sync Failed', 'Check underlying/expiry');
    }
    setIsSyncing(false);
  }, [strategy, underlying, expiry, currentLotSize, config.exchange, formatExpiryForApi]);

  useEffect(() => {
    syncStrategy();
  }, [syncStrategy]);

  // 4. Fetch Prices for Legs
  const fetchLegPrices = useCallback(async () => {
    if (legs.length === 0) return;
    setIsLoading(true);
    try {
      const nfoExchange = (underlying === 'SENSEX' || underlying === 'BANKEX') ? 'BFO' : 'NFO';
      const symbols = legs.map(l => ({ symbol: l.symbol, exchange: nfoExchange }));
      
      // Step 1: Multi-quote for prices
      const { data } = await marketApi.multiQuote(symbols);
      
      // Step 2: Fetch Greeks for each leg
      const greeksResults: any[] = [];
      for (const leg of legs) {
        try {
          const { data: gData } = await optionsApi.greeks(leg.symbol, nfoExchange);
          if (gData.status === 'success') {
            greeksResults.push({ symbol: leg.symbol, greeks: gData.data });
          }
        } catch { /* ignore individual greek failure */ }
      }

      if (data.status === 'success' && data.results) {
        setLegs(prev => prev.map(leg => {
          const result = data.results.find((r: any) => r.symbol === leg.symbol);
          const greekResult = greeksResults.find(g => g.symbol === leg.symbol);
          return {
            ...leg,
            price: result?.data?.ltp || leg.price,
            greeks: greekResult?.greeks || leg.greeks,
          };
        }));
      }
    } catch {}
    setIsLoading(false);
  }, [legs.length, underlying]);

  useEffect(() => {
    if (legs.length > 0 && legs.some(l => l.price === 0)) {
      fetchLegPrices();
    }
  }, [fetchLegPrices]); // Removed legs.length from deps to avoid infinite loops, rely on explicit calls

  // 5. Advanced Analysis & Payoff Simulation
  const analysis = useMemo(() => {
    if (legs.length === 0 || legs.some(l => l.price === 0) || atmStrike === 0) return null;
    
    const lotSize = currentLotSize;
    
    // 1. Calculate Net Premium (Initial Cost/Credit)
    // Buy = Negative (outflow), Sell = Positive (inflow)
    let netPremium = 0;
    legs.forEach(leg => {
      const sign = leg.action === 'BUY' ? -1 : 1;
      netPremium += sign * leg.price * leg.quantity;
    });

    const isDebit = netPremium < 0;

    // 2. Determine Simulation Range
    // We want to see at least 20% around ATM, OR enough to cover all strikes + buffer
    const allStrikes = legs.map(l => l.strike);
    const minStrike = Math.min(...allStrikes, atmStrike);
    const maxStrike = Math.max(...allStrikes, atmStrike);
    const buffer = (maxStrike - minStrike) * 0.2 || atmStrike * 0.05;
    
    const startPrice = Math.max(0, Math.floor((minStrike - buffer) / 100) * 100);
    const endPrice = Math.ceil((maxStrike + buffer) / 100) * 100;
    
    const chartData: any[] = [];
    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    const steps = 100; // Resolution
    const stepSize = (endPrice - startPrice) / steps;

    for (let i = 0; i <= steps; i++) {
      const price = startPrice + (i * stepSize);
      let profitAtExpiry = netPremium; 
      
      legs.forEach(leg => {
        let legPayoff = 0;
        if (leg.optionType === 'CE') {
          legPayoff = Math.max(0, price - leg.strike);
        } else {
          legPayoff = Math.max(0, leg.strike - price);
        }
        
        // Final P&L for a leg at expiry: (Payoff - PricePaid) * Qty
        // If we bought: Payoff - LegPrice
        // If we sold: LegPrice - Payoff
        // Since netPremium already includes +/- LegPrice, we just add the Payoff multiplied by sign
        const sign = leg.action === 'BUY' ? 1 : -1;
        profitAtExpiry += sign * legPayoff * leg.quantity;
      });

      chartData.push({ 
        price: Math.round(price), 
        profit: Math.round(profitAtExpiry) 
      });
      maxProfit = Math.max(maxProfit, profitAtExpiry);
      maxLoss = Math.min(maxLoss, profitAtExpiry);
    }

    // 3. Identify Precise Break-evens
    const breakEvens: number[] = [];
    for (let i = 0; i < chartData.length - 1; i++) {
      const p1 = chartData[i];
      const p2 = chartData[i+1];
      if ((p1.profit <= 0 && p2.profit > 0) || (p1.profit >= 0 && p2.profit < 0)) {
        // Interpolate for better accuracy? A simple average is usually fine for display
        breakEvens.push(Math.round((p1.price + p2.price) / 2));
      }
    }

    // 4. Sanitize Display Values
    // Check if the strategy has theoretically unlimited risk/reward by looking at the edges of a wider range
    // But for most strategies, we can just check if profit is still rising/falling at edges
    const isUncappedProfit = chartData[chartData.length-1].profit > chartData[chartData.length-2].profit && chartData[chartData.length-1].profit > 100000;
    const isUncappedLoss = chartData[0].profit < chartData[1].profit && chartData[0].profit < -100000;

    const displaysMaxProfit = isUncappedProfit ? 'Unlimited' : `₹${formatIndianNumber(Math.max(0, Math.round(maxProfit)))}`;
    const displaysMaxLoss = isUncappedLoss ? 'Unlimited' : `₹${formatIndianNumber(Math.abs(Math.round(maxLoss)))}`;

    // 5. Calculate Gradient Offset for Chart (split at 0)
    let gradientOffset = 0;
    if (maxProfit > 0 && maxLoss < 0) {
      gradientOffset = maxProfit / (maxProfit - maxLoss);
    } else if (maxProfit <= 0) {
      gradientOffset = 0;
    } else {
      gradientOffset = 1;
    }

    // 6. Aggregate Strategy Greeks
    const strategyGreeks = { delta: 0, theta: 0, gamma: 0, vega: 0 };
    legs.forEach(leg => {
      if (leg.greeks) {
        const sign = leg.action === 'BUY' ? 1 : -1;
        const multiplier = leg.quantity;
        strategyGreeks.delta += sign * leg.greeks.delta * multiplier;
        strategyGreeks.theta += sign * leg.greeks.theta * multiplier;
        strategyGreeks.gamma += sign * leg.greeks.gamma * multiplier;
        strategyGreeks.vega += sign * leg.greeks.vega * multiplier;
      }
    });

    return { 
      netPremium, 
      isDebit, 
      maxProfit, 
      maxLoss, 
      displaysMaxProfit,
      displaysMaxLoss,
      chartData, 
      breakEvens,
      gradientOffset,
      strategyGreeks
    };
  }, [legs, atmStrike, underlying, expiry]);

  const removeLeg = (id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
  };

  const checkMargin = async () => {
    if (legs.length === 0) return;
    setIsLoading(true);
    try {
      const nfoExchange = (underlying === 'SENSEX' || underlying === 'BANKEX') ? 'BFO' : 'NFO';
      const positions = legs.map(leg => ({
        symbol: leg.symbol,
        exchange: nfoExchange,
        action: leg.action,
        product: 'NRML',
        pricetype: 'MARKET',
        quantity: String(leg.quantity),
      }));
      const { data } = await portfolioApi.margin(positions);
      if (data.status === 'success') {
        const marginValue = data.total_margin_required || data.data?.total_margin_required || 0;
        setMarginEst(marginValue);
        showToast('info', 'Margin Check', `Required: ₹${formatIndianNumber(marginValue)}`);
      }
    } catch (err: any) {
      showToast('error', 'Margin Check Failed', err.message);
    }
    setIsLoading(false);
  };

  const executeAllLegs = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    const nfoExchange = (underlying === 'SENSEX' || underlying === 'BANKEX') ? 'BFO' : 'NFO';
    let successCount = 0;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      showToast('info', `Placing leg ${i + 1}/${legs.length}`, `${leg.action} ${leg.symbol}`);
      
      try {
        const { data } = await orderApi.place({
          strategy: defaults.strategy || 'TERMINAL',
          symbol: leg.symbol,
          action: leg.action,
          exchange: nfoExchange,
          pricetype: 'MARKET',
          product: 'NRML',
          quantity: String(leg.quantity),
        });
        
        if (data.status === 'success') {
          successCount++;
          // Small delay to prevent rate-limiting or race conditions
          if (i < legs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          showToast('error', `Leg ${i + 1} Failed`, data.message || 'Order failed');
          // Optional: break; if we want to stop on first failure
        }
      } catch (err: any) {
        showToast('error', `Leg ${i + 1} Error`, err.message);
      }
    }

    if (successCount === legs.length) {
      showToast('success', 'Strategy Executed', `All ${legs.length} legs placed successfully`);
    } else if (successCount > 0) {
      showToast('warning', 'Partial Execution', `${successCount}/${legs.length} legs placed — CHECK POSITIONS`);
    } else {
      showToast('error', 'Execution Failed', 'No orders were successfully placed');
    }
    setIsExecuting(false);
  };

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1e1e30] shrink-0 bg-[#0a0a12]/50">
        <select value={underlying} onChange={e => setUnderlying(e.target.value)}
          className="bg-[#08080d] border border-[#2a2a42] rounded-sm px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-[#448aff]">
          {Object.keys(INDEX_CONFIG).map(idx => <option key={idx} value={idx}>{idx}</option>)}
        </select>

        <select value={expiry} onChange={e => setExpiry(e.target.value)}
          className="bg-[#08080d] border border-[#2a2a42] rounded-sm px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-[#448aff]">
          {expiries.map(exp => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
        </select>

        <button onClick={fetchSpot} className="p-1 hover:bg-[#1e1e30] rounded ml-auto transition-colors">
          <RefreshCw size={10} className={`text-zinc-500 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex items-center gap-1.5 ml-2 border-l border-[#1e1e30] pl-2">
          <label className="text-[9px] text-zinc-500 uppercase font-bold">Lots</label>
          <input 
            type="number" 
            value={lots} 
            onChange={e => {
              const val = Math.max(1, parseInt(e.target.value) || 1);
              setLots(val);
              setLegs(prev => prev.map(l => ({ ...l, quantity: val * currentLotSize })));
            }}
            className="w-10 bg-[#08080d] border border-[#2a2a42] rounded-sm px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-[#448aff]"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <label className="text-[9px] text-zinc-500 uppercase font-bold">Qty</label>
          <input 
            type="number" 
            value={totalQty}
            onChange={e => {
              const qty = Math.max(currentLotSize, parseInt(e.target.value) || currentLotSize);
              const roundedLots = Math.max(1, Math.floor(qty / currentLotSize));
              setLots(roundedLots);
              setLegs(prev => prev.map(l => ({ ...l, quantity: roundedLots * currentLotSize })));
            }}
            className="w-14 bg-[#08080d] border border-[#2a2a42] rounded-sm px-1.5 py-1 text-[10px] text-zinc-300 outline-none focus:border-[#448aff]"
          />
        </div>
      </div>

      {/* Strategies */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1e1e30] overflow-x-auto no-scrollbar shrink-0">
        {STRATEGIES.map(s => (
          <button key={s.value} onClick={() => setStrategy(s.value)}
            className={`px-2 py-0.5 text-[9px] rounded-sm whitespace-nowrap transition-colors border ${
              strategy === s.value ? 'bg-[#448aff15] text-[#448aff] border-[#448aff30]' : 'text-zinc-600 border-transparent hover:text-zinc-400'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Legs List */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5 bg-[#08080d]/40">
        {isSyncing ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2 text-zinc-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[10px]">Syncing strategy legs...</span>
          </div>
        ) : (
          legs.map((leg, i) => (
            <div key={leg.id} className="flex items-center gap-2 bg-[#0a0a12] border border-[#1e1e30] rounded px-2 py-1.5 hover:border-[#2a2a42] transition-colors group">
              <span className="text-[9px] text-zinc-600 font-mono w-4">{i + 1}</span>
              <div className="flex flex-col min-w-[100px]">
                <span className={`font-bold ${leg.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {leg.action} {leg.optionType}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">{leg.symbol}</span>
              </div>
              <div className="flex-1 flex flex-col items-end">
                <span className="text-zinc-200 tabular-nums">
                  {leg.price > 0 ? `₹${formatPrice(leg.price)}` : <span className="animate-pulse">...</span>}
                </span>
                <span className="text-[9px] text-zinc-600 font-medium">
                  {Math.round(leg.quantity / currentLotSize)} Lot{Math.round(leg.quantity / currentLotSize) > 1 ? 's' : ''} ({leg.quantity} Qty)
                </span>
              </div>
              <button onClick={() => removeLeg(leg.id)} className="p-1 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={10} className="text-zinc-700 hover:text-red-400" />
              </button>
            </div>
          ))
        )}
        
        {!isSyncing && legs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2 opacity-50">
            <Info size={24} />
            <span className="text-[10px]">Select a strategy and expiry to build your positions</span>
          </div>
        )}
      </div>

      {/* Analysis Section */}
      {analysis && (
        <div className="border-t border-[#1e1e30] bg-[#0a0a12]/80">
          {/* Chart Container */}
          <div className="h-40 w-full pt-4 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.chartData}>
                <defs>
                  <linearGradient id="splitColorFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={analysis.gradientOffset} stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset={analysis.gradientOffset} stopColor="#ef4444" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="splitColorStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={analysis.gradientOffset} stopColor="#10b981" stopOpacity={1}/>
                    <stop offset={analysis.gradientOffset} stopColor="#ef4444" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" vertical={false} />
                <XAxis 
                  dataKey="price" 
                  type="number" 
                  domain={['dataMin', 'dataMax']} 
                  hide 
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0e0e16', border: '1px solid #2a2a42', fontSize: '10px' }}
                  itemStyle={{ color: '#10b981' }}
                  labelStyle={{ color: '#71717a' }}
                  formatter={(value: any) => [`₹${formatIndianNumber(value)}`, 'P&L']}
                  labelFormatter={(label: any) => `Expiry Price: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="url(#splitColorStroke)" 
                  fill="url(#splitColorFill)" 
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <ReferenceLine y={0} stroke="#444" strokeWidth={1} />
                <ReferenceLine x={atmStrike} stroke="#448aff" strokeDasharray="3 3" opacity={0.5}>
                  <Label value="SPOT" position="top" fill="#448aff" fontSize={8} />
                </ReferenceLine>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="px-3 pb-3 space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Strategy Analysis</span>
              <div className="flex gap-2">
                <span className="text-[9px] text-zinc-500">ATM: {atmStrike}</span>
                {analysis.breakEvens.length > 0 && (
                  <span className="text-[9px] text-emerald-500/80 font-bold">BE: {analysis.breakEvens.join(' / ')}</span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex justify-between items-center bg-[#0e0e16] p-2 rounded border border-[#1e1e30]">
                <span className="text-zinc-500 uppercase text-[9px] font-bold">Net Premium</span>
                <span className={`tabular-nums font-bold ${analysis.isDebit ? 'text-red-400' : 'text-emerald-400'}`}>
                  {analysis.isDebit ? '-' : '+'}{formatIndianNumber(Math.abs(analysis.netPremium))}
                </span>
              </div>
              <div className="flex justify-between items-center bg-[#0e0e16] p-2 rounded border border-[#1e1e30]">
                <span className="text-zinc-500 uppercase text-[9px] font-bold">Max Profit</span>
                <span className="text-emerald-500 font-bold">{analysis.displaysMaxProfit}</span>
              </div>
              <div className="flex justify-between items-center bg-[#0e0e16] p-2 rounded border border-[#1e1e30]">
                <span className="text-zinc-500 uppercase text-[9px] font-bold">Margin Est.</span>
                <span className="text-zinc-200">
                  {marginEst ? `₹${formatIndianNumber(marginEst)}` : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-[#0e0e16] p-2 rounded border border-[#1e1e30]">
                <span className="text-zinc-500 uppercase text-[9px] font-bold">Max Loss</span>
                <span className="text-red-500 font-bold">{analysis.displaysMaxLoss}</span>
              </div>
            </div>

            {/* Greeks Grid */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#1e1e30]/50">
              <GreekItem label="Delta" value={analysis.strategyGreeks.delta} />
              <GreekItem label="Theta" value={analysis.strategyGreeks.theta} />
              <GreekItem label="Gamma" value={analysis.strategyGreeks.gamma} />
              <GreekItem label="Vega" value={analysis.strategyGreeks.vega} />
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-2 py-2 gap-2 flex flex-col border-t border-[#1e1e30] bg-[#08080d] shrink-0">
        <div className="flex gap-2">
          <button onClick={checkMargin} disabled={legs.length === 0 || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#1e1e30] border border-[#2a2a42] text-zinc-400 rounded-sm text-[10px] hover:bg-[#252540] hover:text-zinc-200 disabled:opacity-30 transition-colors">
            {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Calculator size={11} />}
            Margin
          </button>
          <button onClick={fetchLegPrices} disabled={legs.length === 0 || isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#1e1e30] border border-[#2a2a42] text-zinc-400 rounded-sm text-[10px] hover:bg-[#252540] hover:text-zinc-200 disabled:opacity-30 transition-colors">
            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <button onClick={executeAllLegs} disabled={legs.length === 0 || isExecuting || isSyncing}
          className="w-full h-9 flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-sm text-xs font-bold hover:bg-emerald-500/30 disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          {isExecuting ? <><Loader2 size={14} className="animate-spin" /> EXECUTING...</> : <><Play size={14} fill="currentColor" /> EXECUTE {lots} LOTS ({totalQty} QTY)</>}
        </button>
      </div>
    </div>
  );
}
function GreekItem({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0;
  return (
    <div className="flex flex-col items-center bg-[#0e0e16] py-1 rounded border border-[#1e1e30]/30">
      <span className="text-zinc-600 text-[8px] uppercase">{label}</span>
      <span className={`tabular-nums font-bold text-[9px] ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}
