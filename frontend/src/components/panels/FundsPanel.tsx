'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useFunds } from '@/hooks/useApi';
import { formatIndianNumber } from '@/lib/formatters';

export function FundsPanel() {
  const { data: fundsResponse, isLoading } = useFunds();

  const funds = useMemo(() => {
    const d = fundsResponse?.data || {};
    const cash = parseFloat(d.availablecash || '0');
    const collateral = parseFloat(d.collateral || '0');
    const realized = parseFloat(d.m2mrealized || '0');
    const unrealized = parseFloat(d.m2munrealized || '0');
    const used = parseFloat(d.utiliseddebits || '0');
    const total = d.totalMargin || (cash + collateral);
    const usedPct = d.usedPercent || (total > 0 ? (used / total) * 100 : 0);
    const dayPnl = realized + unrealized;

    return { cash, collateral, total, used, usedPct, realized, unrealized, dayPnl };
  }, [fundsResponse]);

  const barColor = funds.usedPct > 80 ? 'bg-red-400' : funds.usedPct > 50 ? 'bg-amber-400' : 'bg-emerald-400';
  const pnlColor = (v: number) => v >= 0 ? 'text-emerald-400' : 'text-red-400';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-zinc-600 text-xs">
        <Loader2 size={12} className="animate-spin" /> Loading funds...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 p-2.5 text-[11px] h-full bg-[#08080d]">
      {/* Cash & Collateral */}
      <Row label="Available Cash" value={formatIndianNumber(funds.cash)} />
      <Row label="Collateral Value" value={formatIndianNumber(funds.collateral)} />
      <div className="border-t border-[#1e1e30] my-0.5" />
      <Row label="Total Margin" value={formatIndianNumber(funds.total)} bold />

      {/* Usage bar */}
      <div className="mt-2 space-y-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-zinc-500">Margin Used</span>
          <span className="text-zinc-300 font-medium">{formatIndianNumber(funds.used)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-[#1e1e30] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(funds.usedPct, 100)}%` }}
            />
          </div>
          <span className={`text-[9px] tabular-nums font-bold ${
            funds.usedPct > 80 ? 'text-red-400' : 'text-zinc-500'
          }`}>
            {funds.usedPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="border-t border-[#1e1e30] my-1" />

      {/* P&L Snapshot */}
      <div className="space-y-1.5 py-1">
        <Row
          label="Realized P&L"
          value={`${funds.realized >= 0 ? '+' : ''}${formatIndianNumber(funds.realized)}`}
          valueColor={pnlColor(funds.realized)}
        />
        <Row
          label="Unrealized P&L"
          value={`${funds.unrealized >= 0 ? '+' : ''}${formatIndianNumber(funds.unrealized)}`}
          valueColor={pnlColor(funds.unrealized)}
        />
        <div className="pt-1 border-t border-[#1e1e30]/50">
          <Row
            label="Net Day P&L"
            value={`${funds.dayPnl >= 0 ? '+' : ''}${formatIndianNumber(funds.dayPnl)}`}
            valueColor={pnlColor(funds.dayPnl)}
            bold
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, valueColor }: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-zinc-500 ${bold ? 'font-medium text-zinc-400' : ''}`}>{label}</span>
      <span className={`tabular-nums ${valueColor || 'text-zinc-200'} ${bold ? 'font-bold' : ''}`}>
        {value}
      </span>
    </div>
  );
}
