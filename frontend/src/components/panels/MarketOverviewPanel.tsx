'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { marketApi } from '@/lib/api-client';
import { formatPrice, formatPercent, formatIndianNumber } from '@/lib/formatters';

const INDICES = [
  { symbol: 'NIFTY', exchange: 'NSE_INDEX', label: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX', label: 'BANK NIFTY' },
  { symbol: 'SENSEX', exchange: 'BSE_INDEX', label: 'SENSEX' },
  { symbol: 'FINNIFTY', exchange: 'NSE_INDEX', label: 'FIN NIFTY' },
  { symbol: 'MIDCPNIFTY', exchange: 'NSE_INDEX', label: 'MIDCAP' },
];

interface IndexData {
  symbol: string;
  label: string;
  ltp: number;
  change: number;
  changePct: number;
  volume: number;
}

export function MarketOverviewPanel() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [vix, setVix] = useState<{ ltp: number; change: number; changePct: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const symbols = [
        ...INDICES.map(i => ({ symbol: i.symbol, exchange: i.exchange })),
        { symbol: 'INDIAVIX', exchange: 'NSE_INDEX' },
      ];

      const { data } = await marketApi.multiQuote(symbols);

      if (data.status === 'success' && data.results) {
        const indexData: IndexData[] = [];

        data.results.forEach((r: any) => {
          if (r.symbol === 'INDIAVIX' && r.data) {
            setVix({
              ltp: r.data.ltp || 0,
              change: (r.data.ltp || 0) - (r.data.prev_close || r.data.ltp || 0),
              changePct: r.data.prev_close ? (((r.data.ltp || 0) - r.data.prev_close) / r.data.prev_close) * 100 : 0,
            });
            return;
          }

          const idx = INDICES.find(i => i.symbol === r.symbol);
          if (idx && r.data) {
            const ltp = r.data.ltp || 0;
            const prevClose = r.data.prev_close || ltp;
            indexData.push({
              symbol: idx.symbol,
              label: idx.label,
              ltp,
              change: ltp - prevClose,
              changePct: prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0,
              volume: r.data.volume || 0,
            });
          }
        });

        const ordered = INDICES.map(idx =>
          indexData.find(d => d.symbol === idx.symbol) || {
            symbol: idx.symbol, label: idx.label, ltp: 0, change: 0, changePct: 0, volume: 0,
          }
        );
        setIndices(ordered);
      }
    } catch (err) {
      console.error('Market overview fetch error:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const vixLevel = useMemo(() => {
    if (!vix) return { label: '—', color: 'text-zinc-500', barColor: 'bg-zinc-500', pct: 0 };
    if (vix.ltp < 15) return { label: 'Low Fear', color: 'text-emerald-400', barColor: 'bg-emerald-400', pct: (vix.ltp / 50) * 100 };
    if (vix.ltp < 20) return { label: 'Moderate', color: 'text-amber-400', barColor: 'bg-amber-400', pct: (vix.ltp / 50) * 100 };
    if (vix.ltp < 30) return { label: 'High Fear', color: 'text-red-400', barColor: 'bg-red-400', pct: (vix.ltp / 50) * 100 };
    return { label: 'Extreme Fear', color: 'text-red-500', barColor: 'bg-red-500', pct: Math.min((vix.ltp / 50) * 100, 100) };
  }, [vix]);

  const maxChange = Math.max(...indices.map(i => Math.abs(i.changePct)), 0.1);

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30] shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity size={11} className="text-[#448aff]" />
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Market Overview</span>
        </div>
        <button onClick={fetchData} className="p-1 hover:bg-[#1e1e30] rounded">
          <RefreshCw size={10} className={`text-zinc-600 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {indices.map((idx) => {
          const color = idx.change >= 0 ? 'text-emerald-400' : 'text-red-400';
          const barWidth = (Math.abs(idx.changePct) / maxChange) * 60;
          const Icon = idx.change > 0 ? TrendingUp : idx.change < 0 ? TrendingDown : Minus;

          return (
            <div key={idx.symbol} className="flex items-center gap-2 px-2 py-2 border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e]">
              <div className="w-[80px]">
                <div className="text-zinc-200 font-medium text-[10px]">{idx.label}</div>
              </div>
              <span className="w-[70px] text-right tabular-nums text-zinc-200">
                {idx.ltp > 0 ? formatPrice(idx.ltp) : '—'}
              </span>
              <span className={`w-[90px] text-right tabular-nums text-[10px] ${color}`}>
                {idx.change >= 0 ? '+' : ''}{formatPrice(idx.change)} ({formatPercent(idx.changePct)})
              </span>
              <div className="flex-1 h-2 bg-[#0a0a12] rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm ${idx.change >= 0 ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <Icon size={10} className={color} />
            </div>
          );
        })}

        {vix && (
          <div className="px-2 py-2 border-b border-[#1e1e30]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-400 text-[10px]">
                India VIX: <span className={`font-bold ${vixLevel.color}`}>{vix.ltp.toFixed(2)}</span>
                <span className={`ml-1 text-[9px] ${vix.change >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  ({vix.changePct >= 0 ? '+' : ''}{vix.changePct.toFixed(1)}%)
                </span>
              </span>
              <span className={`text-[9px] font-medium ${vixLevel.color}`}>{vixLevel.label}</span>
            </div>
            <div className="h-1.5 bg-[#1e1e30] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${vixLevel.barColor}`} style={{ width: `${vixLevel.pct}%`, opacity: 0.6 }} />
            </div>
          </div>
        )}

        {/* Sectoral Performance */}
        <div className="px-2 py-3 bg-[#0a0a12]/50 border-y border-[#1e1e30]">
          <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mb-2">Sectoral Heatmap</div>
          <div className="grid grid-cols-2 gap-2">
            <Sector sym="IT" change={+1.2} />
            <Sector sym="BANK" change={-0.4} />
            <Sector sym="AUTO" change={+0.8} />
            <Sector sym="METAL" change={-1.5} />
            <Sector sym="PHARMA" change={+0.5} />
            <Sector sym="REALTY" change={+2.4} />
          </div>
        </div>

        {/* Advance/Decline Breadth */}
        <div className="px-2 py-3">
          <div className="flex justify-between items-center text-[9px] text-zinc-600 font-bold uppercase mb-2">
            <span>Market Breadth (NIFTY 50)</span>
            <span className="text-zinc-500">1.4 ADR</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-[#1e1e30]">
            <div className="bg-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: '60%' }} />
            <div className="bg-zinc-700" style={{ width: '10%' }} />
            <div className="bg-red-500/60" style={{ width: '30%' }} />
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-bold">
            <span className="text-emerald-400">32 ADV</span>
            <span className="text-zinc-500">5 UNC</span>
            <span className="text-red-400">13 DEC</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sector({ sym, change }: { sym: string; change: number }) {
  const isUp = change >= 0;
  return (
    <div className={`flex items-center justify-between p-1.5 rounded-sm border ${isUp ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
      <span className="text-[9px] font-bold text-zinc-400 truncate w-10">NIFTY {sym}</span>
      <span className={`text-[10px] tabular-nums font-black ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
        {isUp ? '+' : ''}{change.toFixed(1)}%
      </span>
    </div>
  );
}
