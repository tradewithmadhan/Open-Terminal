import { formatIndianNumber, formatPercent } from '@/lib/formatters';

interface PnLCellProps {
  value: number;
  percent?: number;
  showPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PnLCell({ value, percent, showPercent = true, size = 'md' }: PnLCellProps) {
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-zinc-400';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base font-bold' : 'text-sm';

  return (
    <span className={`font-mono tabular-nums ${color} ${textSize}`}>
      {value >= 0 ? '+' : ''}{formatIndianNumber(value)}
      {showPercent && percent !== undefined && (
        <span className="ml-1 opacity-60 text-xs">({formatPercent(percent)})</span>
      )}
    </span>
  );
}
