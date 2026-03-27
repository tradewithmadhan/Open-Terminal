'use client';

import { useState } from 'react';
import { Bell, X, BellOff, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { useAlertStore, AlertCondition } from '@/hooks/useAlerts';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { formatPrice } from '@/lib/formatters';
import { showToast } from '@/components/common/ToastManager';

export function AlertsPanel() {
  const { alerts, addAlert, removeAlert, disableAlert, clearTriggered } = useAlertStore();
  const { activeSymbol } = useTerminalStore();
  const [isAdding, setIsAdding] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSymbol || !targetPrice) return;
    
    addAlert({
      symbol: activeSymbol.symbol,
      exchange: activeSymbol.exchange,
      condition,
      targetPrice: parseFloat(targetPrice),
      sound: true,
      repeat: false,
    });
    
    showToast('success', 'Alert Created', `${activeSymbol.symbol} ${condition} ₹${targetPrice}`);
    setTargetPrice('');
    setIsAdding(false);
  };

  const active = alerts.filter(a => a.status === 'active');
  const triggered = alerts.filter(a => a.status === 'triggered');
  const disabled = alerts.filter(a => a.status === 'disabled');

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex items-center px-2 py-1.5 border-b border-[#1e1e30] bg-[#0a0a12]">
        <span className="text-[10px] text-zinc-500">
          Active: <span className="text-amber-400">{active.length}</span>
          {triggered.length > 0 && (
            <> | Triggered: <span className="text-emerald-400">{triggered.length}</span></>
          )}
        </span>
        <div className="flex-1" />
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`p-1 rounded transition-colors ${isAdding ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-600 hover:text-zinc-300'}`}
          title="Create Alert"
        >
          <Plus size={12} />
        </button>
        <div className="w-px h-3 bg-[#1e1e30] mx-1" />
        {triggered.length > 0 && (
          <button onClick={clearTriggered} className="text-[9px] text-zinc-600 hover:text-red-400">
            Clear triggered
          </button>
        )}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="p-3 bg-[#0a0a12] border-b border-[#1e1e30] animate-in slide-in-from-top duration-200">
          {!activeSymbol ? (
            <p className="text-[10px] text-zinc-600 text-center italic">Select a symbol first</p>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-400 font-bold tracking-tight">{activeSymbol.symbol}</span>
                <span className="text-zinc-600 uppercase text-[8px]">{activeSymbol.exchange}</span>
              </div>
              
              <div className="flex gap-2">
                <select 
                  value={condition}
                  onChange={e => setCondition(e.target.value as AlertCondition)}
                  className="flex-1 bg-[#0e0e16] border border-[#2a2a42] rounded px-1.5 py-1 text-[10px] text-zinc-300 outline-none"
                >
                  <option value="above">Price Above</option>
                  <option value="below">Price Below</option>
                  <option value="cross_above">Crosses Up</option>
                  <option value="cross_below">Crosses Down</option>
                </select>
                <input 
                  type="number" 
                  step="0.05"
                  autoFocus
                  placeholder="Price"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  className="w-[80px] bg-[#0e0e16] border border-[#2a2a42] rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none focus:border-emerald-500/50"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded hover:bg-emerald-500/20 transition-all"
              >
                SET ALERT
              </button>
            </form>
          )}
        </div>
      )}

      {/* Alert list */}
      <div className="flex-1 overflow-auto">
        {[...triggered, ...active, ...disabled].map(alert => {
          const condIcon = alert.condition.includes('above') ? '▲' : '▼';
          const condColor = alert.condition.includes('above') ? 'text-emerald-400' : 'text-red-400';

          return (
            <div
              key={alert.id}
              className={`flex items-center gap-2 px-2 py-2 border-b border-[#1e1e30]/30 ${
                alert.status === 'triggered' ? 'bg-amber-500/5' :
                alert.status === 'disabled' ? 'opacity-40' : ''
              }`}
            >
              <Bell size={10} className={
                alert.status === 'triggered' ? 'text-amber-400 animate-pulse' :
                alert.status === 'active' ? 'text-zinc-400' : 'text-zinc-600'
              } />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-200 font-medium">{alert.symbol}</span>
                  <span className={`text-[10px] ${condColor}`}>{condIcon}</span>
                  <span className="text-zinc-300 tabular-nums">₹{formatPrice(alert.targetPrice)}</span>
                </div>
                {alert.currentPrice > 0 && (
                  <div className="text-[9px] text-zinc-600">
                    Current: ₹{formatPrice(alert.currentPrice)}
                    {alert.triggeredAt && (
                      <span className="text-amber-400/60 ml-2">
                        Triggered {new Date(alert.triggeredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                {alert.status === 'active' && (
                  <button onClick={() => disableAlert(alert.id)} className="p-1 hover:bg-[#1e1e30] rounded" title="Disable">
                    <BellOff size={10} className="text-zinc-600 hover:text-amber-400" />
                  </button>
                )}
                <button onClick={() => removeAlert(alert.id)} className="p-1 hover:bg-red-500/20 rounded" title="Delete">
                  <Trash2 size={10} className="text-zinc-600 hover:text-red-400" />
                </button>
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-20 text-zinc-600 text-[11px] gap-1">
            <Bell size={16} className="text-zinc-700" />
            <span>No alerts set</span>
            <span className="text-[9px] text-zinc-700">Use /alert or right-click watchlist</span>
          </div>
        )}
      </div>
    </div>
  );
}
