'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAlertStore, AlertCondition } from '@/hooks/useAlerts';
import { formatPrice } from '@/lib/formatters';
import type { Exchange } from '@/lib/types';

interface AlertDialogProps {
  symbol: string;
  exchange: Exchange;
  currentPrice: number;
  onClose: () => void;
}

export function AlertDialog({ symbol, exchange, currentPrice, onClose }: AlertDialogProps) {
  const { addAlert } = useAlertStore();
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState(currentPrice.toString());
  const [sound, setSound] = useState(true);
  const [repeat, setRepeat] = useState(false);

  const handleCreate = () => {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;

    addAlert({
      symbol,
      exchange,
      condition,
      targetPrice: price,
      sound,
      repeat,
    });

    onClose();
  };

  const CONDITIONS: { value: AlertCondition; label: string; desc: string }[] = [
    { value: 'above', label: 'Price Above', desc: 'Triggers when LTP ≥ target' },
    { value: 'below', label: 'Price Below', desc: 'Triggers when LTP ≤ target' },
    { value: 'cross_above', label: 'Crosses Above', desc: 'Triggers when LTP crosses up through target' },
    { value: 'cross_below', label: 'Crosses Below', desc: 'Triggers when LTP crosses down through target' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#0e0e16] border border-[#2a2a42] rounded-sm p-5 w-[360px] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-zinc-200">Set Price Alert</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#1e1e30] rounded">
            <X size={14} className="text-zinc-500" />
          </button>
        </div>

        {/* Symbol */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-200 font-medium">{symbol}</span>
          <span className="text-zinc-400">LTP: ₹{formatPrice(currentPrice)}</span>
        </div>

        {/* Condition */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Condition</label>
          <div className="grid grid-cols-2 gap-1.5">
            {CONDITIONS.map(c => (
              <button
                key={c.value}
                onClick={() => setCondition(c.value)}
                className={`px-2 py-1.5 rounded-sm text-[10px] text-left border transition-colors ${
                  condition === c.value
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-[#08080d] border-[#2a2a42] text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div className="font-medium">{c.label}</div>
                <div className="text-[8px] opacity-60 mt-0.5">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Price */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Target Price</label>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            step="0.05"
            className="w-full bg-[#08080d] border border-[#2a2a42] rounded-sm px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500 tabular-nums text-right"
            autoFocus
          />
        </div>

        {/* Options */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={sound} onChange={() => setSound(!sound)} className="accent-amber-400" />
            Sound alert
          </label>
          <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={repeat} onChange={() => setRepeat(!repeat)} className="accent-amber-400" />
            Repeat
          </label>
        </div>

        {/* Create */}
        <button
          onClick={handleCreate}
          className="w-full py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-sm text-xs font-bold hover:bg-amber-500/30 transition-colors"
        >
          Create Alert
        </button>
      </div>
    </div>
  );
}
