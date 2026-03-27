import { formatPrice } from '@/lib/formatters';

interface PriceCellProps {
  price: number;
  prevPrice?: number;
  className?: string;
}

export function PriceCell({ price, prevPrice, className = '' }: PriceCellProps) {
  let color = 'text-zinc-200';
  if (prevPrice !== undefined) {
    if (price > prevPrice) color = 'text-emerald-400';
    else if (price < prevPrice) color = 'text-red-400';
  }

  return (
    <span className={`font-mono tabular-nums ${color} ${className}`}>
      {formatPrice(price)}
    </span>
  );
}
