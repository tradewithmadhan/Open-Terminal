import type { OrderStatus } from '@/lib/types';

const CONFIG: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  complete: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'FILLED' },
  open: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'OPEN' },
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'PENDING' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'REJECTED' },
  cancelled: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'CANCELLED' },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const c = CONFIG[status] || CONFIG.pending;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
