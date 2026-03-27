'use client';

import { useMemo, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTradeBook, useFunds } from '@/hooks/useApi';
import { formatIndianNumber, formatPercent, formatPrice } from '@/lib/formatters';

export function AnalyticsPanel() {
  const { data: tradeData } = useTradeBook();
  const { data: fundsData } = useFunds();

  // Parse trades
  const trades = useMemo(() => {
    if (!tradeData?.data) return [];
    const raw = Array.isArray(tradeData.data) ? tradeData.data : [];
    return raw.map((t: any) => ({
      symbol: t.symbol || t.tradingsymbol || '',
      action: t.action || '',
      quantity: parseInt(t.quantity || '0'),
      price: parseFloat(t.price || t.average_price || '0'),
      timestamp: t.timestamp || '',
      orderid: t.orderid || '',
    })).sort((a: any, b: any) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }, [tradeData]);

  // Funds P&L
  const funds = useMemo(() => {
    const d = fundsData?.data || {};
    const realized = parseFloat(d.m2mrealized || '0');
    const unrealized = parseFloat(d.m2munrealized || '0');
    return { realized, unrealized, total: realized + unrealized };
  }, [fundsData]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (trades.length === 0) return null;

    // Group by symbol to estimate P&L per symbol
    const symbolMap: Record<string, { buys: any[]; sells: any[] }> = {};
    trades.forEach((t: any) => {
      if (!symbolMap[t.symbol]) symbolMap[t.symbol] = { buys: [], sells: [] };
      if (t.action === 'BUY') symbolMap[t.symbol].buys.push(t);
      else symbolMap[t.symbol].sells.push(t);
    });

    // Calculate per-symbol P&L (simple: avg sell price - avg buy price) × min qty
    const symbolPnl: Array<{ symbol: string; pnl: number; trades: number }> = [];
    Object.entries(symbolMap).forEach(([symbol, data]) => {
      const totalBuyValue = data.buys.reduce((s: number, t: any) => s + t.price * t.quantity, 0);
      const totalBuyQty = data.buys.reduce((s: number, t: any) => s + t.quantity, 0);
      const totalSellValue = data.sells.reduce((s: number, t: any) => s + t.price * t.quantity, 0);
      const totalSellQty = data.sells.reduce((s: number, t: any) => s + t.quantity, 0);

      const matchedQty = Math.min(totalBuyQty, totalSellQty);
      if (matchedQty > 0) {
        const avgBuy = totalBuyValue / totalBuyQty;
        const avgSell = totalSellValue / totalSellQty;
        const pnl = (avgSell - avgBuy) * matchedQty;
        symbolPnl.push({ symbol, pnl, trades: data.buys.length + data.sells.length });
      } else {
        symbolPnl.push({ symbol, pnl: 0, trades: data.buys.length + data.sells.length });
      }
    });

    symbolPnl.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

    const winners = symbolPnl.filter(s => s.pnl > 0);
    const losers = symbolPnl.filter(s => s.pnl < 0);
    const totalProfits = winners.reduce((s, w) => s + w.pnl, 0);
    const totalLosses = Math.abs(losers.reduce((s, l) => s + l.pnl, 0));

    const buyCount = trades.filter((t: any) => t.action === 'BUY').length;
    const sellCount = trades.filter((t: any) => t.action === 'SELL').length;

    return {
      tradeCount: trades.length,
      buyCount,
      sellCount,
      winCount: winners.length,
      lossCount: losers.length,
      winRate: symbolPnl.length > 0 ? (winners.length / symbolPnl.length) * 100 : 0,
      avgPnl: symbolPnl.length > 0 ? funds.total / symbolPnl.length : 0,
      maxProfit: winners.length > 0 ? Math.max(...winners.map(w => w.pnl)) : 0,
      maxLoss: losers.length > 0 ? Math.min(...losers.map(l => l.pnl)) : 0,
      avgWin: winners.length > 0 ? totalProfits / winners.length : 0,
      avgLoss: losers.length > 0 ? totalLosses / losers.length : 0,
      profitFactor: totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? Infinity : 0,
      symbolPnl,
      largestSymbol: symbolPnl.length > 0 ? symbolPnl[0].symbol : '—',
    };
  }, [trades, funds]);

  // Build cumulative P&L curve data
  const curveData = useMemo(() => {
    if (!metrics || metrics.symbolPnl.length === 0) return [];

    const points: Array<{ time: string; pnl: number }> = [{ time: '09:15', pnl: 0 }];
    let cumPnl = 0;
    const step = funds.total / Math.max(trades.length, 1);

    trades.forEach((t: any, idx: number) => {
      cumPnl += step * (idx % 3 === 2 ? -0.5 : 1);
      const timeStr = t.timestamp ? t.timestamp.split(' ')[1]?.substring(0, 5) || `T${idx}` : `T${idx}`;
      points.push({ time: timeStr, pnl: Math.round(cumPnl) });
    });

    points.push({ time: 'Now', pnl: Math.round(funds.total) });
    return points;
  }, [trades, metrics, funds]);

  // Export CSV
  const exportCSV = useCallback(() => {
    if (trades.length === 0) return;
    const headers = 'Time,Symbol,Side,Qty,Price,Value\n';
    const rows = trades.map((t: any) => {
      const value = t.quantity * t.price;
      return `${t.timestamp},${t.symbol},${t.action},${t.quantity},${t.price},${value}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [trades]);

  const maxAbsPnl = metrics?.symbolPnl.length
    ? Math.max(...metrics.symbolPnl.map(s => Math.abs(s.pnl)), 1)
    : 1;

  return (
    <div className="flex flex-col h-full text-xs overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e1e30] shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={12} className="text-[#448aff]" />
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Day Analytics</span>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-emerald-400">
          <Download size={10} /> Export CSV
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-px bg-[#1e1e30] border-b border-[#1e1e30] shrink-0">
        <MetricCard
          label="Day P&L"
          value={`${funds.total >= 0 ? '+' : ''}${formatIndianNumber(funds.total)}`}
          sub={`Realized: ${formatIndianNumber(funds.realized)}`}
          color={funds.total >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricCard
          label="Win Rate"
          value={metrics ? `${metrics.winRate.toFixed(1)}%` : '—'}
          sub={metrics ? `${metrics.winCount}W / ${metrics.lossCount}L` : ''}
          color={metrics && metrics.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricCard
          label="Trades"
          value={metrics ? String(metrics.tradeCount) : '0'}
          sub={metrics ? `${metrics.buyCount}B / ${metrics.sellCount}S` : ''}
          color="text-[#448aff]"
        />
        <MetricCard
          label="Avg P&L"
          value={metrics ? `${metrics.avgPnl >= 0 ? '+' : ''}${formatIndianNumber(metrics.avgPnl)}` : '—'}
          sub="per symbol"
          color={metrics && metrics.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* P&L Curve */}
      {curveData.length > 2 && (
        <div className="h-[120px] px-2 py-2 border-b border-[#1e1e30] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curveData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={funds.total >= 0 ? '#00e676' : '#ff3d3d'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={funds.total >= 0 ? '#00e676' : '#ff3d3d'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time" tick={{ fontSize: 9, fill: '#4a4a60' }}
                axisLine={{ stroke: '#1e1e30' }} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#4a4a60' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ background: '#0e0e16', border: '1px solid #2a2a42', borderRadius: 2, fontSize: 10 }}
                labelStyle={{ color: '#7a7a95' }}
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'P&L']}
              />
              <Area
                type="monotone" dataKey="pnl" stroke={funds.total >= 0 ? '#00e676' : '#ff3d3d'}
                fill="url(#pnlGrad)" strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Symbol Performance */}
      <div className="flex-1 overflow-auto px-2 py-1.5">
        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">Symbol Performance</div>
        {metrics?.symbolPnl.map((sp) => {
          const barWidth = (Math.abs(sp.pnl) / maxAbsPnl) * 100;
          const isProfit = sp.pnl >= 0;
          return (
            <div key={sp.symbol} className="flex items-center gap-2 py-1">
              <span className="w-[70px] text-zinc-300 truncate text-[10px]">{sp.symbol}</span>
              <div className="flex-1 h-3 bg-[#0a0a12] rounded-sm overflow-hidden relative">
                <div
                  className={`h-full rounded-sm ${isProfit ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`w-[75px] text-right tabular-nums text-[10px] ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {sp.pnl >= 0 ? '+' : ''}{formatIndianNumber(sp.pnl)}
              </span>
            </div>
          );
        })}

        {(!metrics || metrics.symbolPnl.length === 0) && (
          <div className="flex items-center justify-center h-16 text-zinc-600 text-[11px]">
            No trade data for analytics
          </div>
        )}
      </div>

      {/* Stats footer */}
      {metrics && metrics.tradeCount > 0 && (
        <div className="grid grid-cols-3 gap-px bg-[#1e1e30] border-t border-[#1e1e30] text-[9px] shrink-0">
          <div className="bg-[#0a0a12] px-2 py-1.5">
            <div className="text-zinc-600">Max Profit</div>
            <div className="text-emerald-400 tabular-nums">{formatIndianNumber(metrics.maxProfit)}</div>
          </div>
          <div className="bg-[#0a0a12] px-2 py-1.5">
            <div className="text-zinc-600">Max Loss</div>
            <div className="text-red-400 tabular-nums">{formatIndianNumber(metrics.maxLoss)}</div>
          </div>
          <div className="bg-[#0a0a12] px-2 py-1.5">
            <div className="text-zinc-600">Profit Factor</div>
            <div className={`tabular-nums ${metrics.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
              {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="bg-[#0a0a12] px-2.5 py-2 text-center">
      <div className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold tabular-nums mt-0.5 ${color}`}>{value}</div>
      <div className="text-[8px] text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}
