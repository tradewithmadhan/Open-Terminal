'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { RefreshCw, AlertTriangle, XCircle, LogOut, Loader2, Shield } from 'lucide-react';
import { useOrderBook, usePositions } from '@/hooks/useApi';
import { orderApi } from '@/lib/api-client';
import { formatIndianNumber } from '@/lib/formatters';
import { showToast } from '@/components/common/ToastManager';

interface StrategyInfo {
  name: string;
  orderCount: number;
  openOrders: number;
  positionCount: number;
  estimatedPnl: number;
  status: 'active' | 'idle';
  pnl?: number;
  legs: Array<{
    symbol: string;
    qty: number;
    ltp: number;
    pnl: number;
  }>;
}

export function StrategyPanel() {
  const { data: orderData, refetch: refetchOrders } = useOrderBook();
  const { data: posData, refetch: refetchPositions } = usePositions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState<'cancel' | 'close' | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Discover strategies from orders and positions
  const strategies = useMemo(() => {
    const stratMap: Record<string, StrategyInfo> = {};

    // Known strategies
    ['TERMINAL', 'PS_OPTIONS', 'PS_SWING', 'PS_MONITOR'].forEach(name => {
      stratMap[name] = {
        name, orderCount: 0, openOrders: 0,
        positionCount: 0, estimatedPnl: 0, status: 'idle',
        legs: []
      };
    });

    // 1. Build a map of Symbol -> Strategy from recent orders
    const symbolToStrat: Record<string, string> = {};
    const rawOrders = orderData?.data?.orders || orderData?.data || orderData || [];
    const orders = Array.isArray(rawOrders) ? rawOrders : [];
    
    orders.forEach((o: any) => {
      const strat = o.strategy || 'UNKNOWN';
      if (!stratMap[strat]) {
        stratMap[strat] = {
          name: strat, orderCount: 0, openOrders: 0,
          positionCount: 0, estimatedPnl: 0, status: 'idle',
          legs: []
        };
      }
      stratMap[strat].orderCount++;
      if (['open', 'pending', 'submitted', 'partially_filled'].includes(o.order_status?.toLowerCase())) {
        stratMap[strat].openOrders++;
      }
      
      // Map symbol to the most recent strategy that traded it
      if (strat !== 'UNKNOWN') {
        symbolToStrat[`${o.symbol || o.tradingsymbol}:${o.exchange}`] = strat;
      }
    });

    // 2. Parse positions and attribute to strategies
    const rawPositions = posData?.data || posData || [];
    const positions = Array.isArray(rawPositions) ? rawPositions : [];
    
    positions.forEach((p: any) => {
      const symbol = p.symbol || p.tradingsymbol || '';
      const exchange = p.exchange || 'NSE';
      const key = `${symbol}:${exchange}`;
      
      // Priority: 1. Position-level tag, 2. Inference from orders, 3. UNKNOWN
      const strat = p.strategy || symbolToStrat[key] || 'UNKNOWN';
      
      const qty = parseInt(p.quantity || p.netqty || '0');
      if (qty === 0) return;

      if (!stratMap[strat]) {
        stratMap[strat] = {
          name: strat, orderCount: 0, openOrders: 0,
          positionCount: 0, estimatedPnl: 0, status: 'idle',
          legs: []
        };
      }
      stratMap[strat].positionCount++;
      const avg = parseFloat(p.averageprice || p.average_price || '0');
      const ltp = parseFloat(p.ltp || p.lastprice || '0');
      const pnl = (ltp - avg) * qty;
      stratMap[strat].estimatedPnl += pnl;
      stratMap[strat].legs.push({
        symbol: p.symbol || p.tradingsymbol || '',
        qty,
        ltp,
        pnl
      });
    });

    // Set status
    Object.values(stratMap).forEach(s => {
      if (s.openOrders > 0 || s.positionCount > 0) {
        s.status = 'active';
      }
    });

    // Sort: active first, then by name
    return Object.values(stratMap)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .filter(s => s.orderCount > 0 || s.positionCount > 0 || ['TERMINAL'].includes(s.name));
  }, [orderData, posData]);

  // Cancel orders for strategy
  const handleCancelOrders = useCallback(async (strategy: string) => {
    setActionInProgress(`cancel-${strategy}`);
    try {
      const { data } = await orderApi.cancelAll(strategy);
      if (data.status === 'success') {
        showToast('success', 'Orders Cancelled', `All ${strategy} orders cancelled`);
        setTimeout(() => refetchOrders(), 1000);
      } else {
        showToast('error', 'Cancel Failed', data.message || 'Failed');
      }
    } catch (err: any) {
      showToast('error', 'Cancel Failed', err.message);
    }
    setActionInProgress(null);
  }, [refetchOrders]);

  // Close positions for strategy
  const handleClosePositions = useCallback(async (strategy: string) => {
    setActionInProgress(`close-${strategy}`);
    try {
      const { data } = await orderApi.closeAll(strategy);
      if (data.status === 'success') {
        showToast('warning', 'Positions Closed', `All ${strategy} positions closed at MARKET`);
        setTimeout(() => refetchPositions(), 1000);
      } else {
        showToast('error', 'Close Failed', data.message || 'Failed');
      }
    } catch (err: any) {
      showToast('error', 'Close Failed', err.message);
    }
    setActionInProgress(null);
  }, [refetchPositions]);

  // Emergency actions
  const handleEmergency = useCallback(async (type: 'cancel' | 'close') => {
    if (confirmText !== 'CONFIRM') return;

    setActionInProgress(`emergency-${type}`);
    setShowEmergencyConfirm(null);
    setConfirmText('');

    try {
      if (type === 'cancel') {
        const { data } = await orderApi.cancelAll();
        showToast(data.status === 'success' ? 'warning' : 'error',
          data.status === 'success' ? '⚠ ALL Orders Cancelled' : 'Cancel Failed',
          data.message || '');
      } else {
        const { data } = await orderApi.closeAll();
        showToast(data.status === 'success' ? 'warning' : 'error',
          data.status === 'success' ? '⚠ ALL Positions Closed' : 'Close Failed',
          data.message || '');
      }
      setTimeout(() => {
        refetchOrders();
        refetchPositions();
      }, 1000);
    } catch (err: any) {
      showToast('error', 'Emergency Action Failed', err.message);
    }
    setActionInProgress(null);
  }, [confirmText, refetchOrders, refetchPositions]);

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden bg-[#08080d]">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30] shrink-0 bg-[#0a0a12]/50">
        <div className="flex items-center gap-1.5">
          <Shield size={11} className="text-[#b388ff]" />
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Strategy Monitoring</span>
        </div>
        <button onClick={() => { refetchOrders(); refetchPositions(); }}
          className="p-1 hover:bg-[#1e1e30] rounded transition-colors group">
          <RefreshCw size={10} className="text-zinc-600 group-hover:text-zinc-300" />
        </button>
      </div>

      {/* Strategy list */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {strategies.map(strat => {
          const pnlColor = strat.estimatedPnl > 0 ? 'text-emerald-400' : strat.estimatedPnl < 0 ? 'text-red-400' : 'text-zinc-500';
          const isCancelling = actionInProgress === `cancel-${strat.name}`;
          const isClosing = actionInProgress === `close-${strat.name}`;

          return (
            <div key={strat.name} className="px-3 py-3 border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e]/30 transition-colors">
              {/* Strategy header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-200 font-bold text-[11px] tracking-tight">{strat.name}</span>
                  <div className={`flex items-center gap-1 text-[9px] font-medium border px-1.5 py-0.5 rounded-full ${
                    strat.status === 'active' 
                      ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20' 
                      : 'text-zinc-600 bg-zinc-900 border-zinc-800'
                  }`}>
                    <div className={`w-1 h-1 rounded-full ${
                      strat.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-700'
                    }`} />
                    {strat.status === 'active' ? 'Active' : 'Idle'}
                  </div>
                </div>
                {strat.estimatedPnl !== 0 && (
                  <span className={`text-[11px] tabular-nums font-bold ${pnlColor}`}>
                    {strat.estimatedPnl > 0 ? '+' : ''}{formatIndianNumber(strat.estimatedPnl)}
                  </span>
                )}
              </div>

              {/* Metrics Grid */}
              <div 
                className="grid grid-cols-3 gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setExpanded(prev => ({ ...prev, [strat.name]: !prev[strat.name] }))}
              >
                <div className="flex flex-col">
                  <span className="text-[8px] text-zinc-600 uppercase">Orders</span>
                  <span className="text-[10px] text-zinc-300 font-mono">{strat.orderCount}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-zinc-600 uppercase">Open</span>
                  <span className={`text-[10px] ${strat.openOrders > 0 ? 'text-amber-400' : 'text-zinc-300'} font-mono`}>{strat.openOrders}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-zinc-600 uppercase">Positions</span>
                  <span className="text-[10px] text-zinc-300 font-mono">{strat.positionCount}</span>
                </div>
              </div>

              {/* Legs Table (Expanded) */}
              {expanded[strat.name] && strat.legs.length > 0 && (
                <div className="mb-3 rounded overflow-hidden border border-[#2a2a42]">
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr className="bg-[#1e1e30] text-zinc-500">
                        <th className="text-left px-2 py-1">Symbol</th>
                        <th className="text-right px-2 py-1">Qty</th>
                        <th className="text-right px-2 py-1">P&L</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#0e0e16]">
                      {strat.legs.map((leg, li) => (
                        <tr key={`${strat.name}-${leg.symbol}-${li}`} className="border-b border-[#1e1e30] last:border-0">
                          <td className="px-2 py-1.5 text-zinc-300 font-bold">{leg.symbol}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">{leg.qty}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${leg.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {leg.pnl > 0 ? '+' : ''}{formatIndianNumber(leg.pnl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions */}
              {strat.status === 'active' && (
                <div className="flex items-center gap-2">
                  {strat.openOrders > 0 && (
                    <button
                      onClick={() => handleCancelOrders(strat.name)}
                      disabled={isCancelling}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-sm hover:bg-amber-500/20 disabled:opacity-50 transition-all font-medium"
                    >
                      {isCancelling ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                      Cancel Orders
                    </button>
                  )}
                  {strat.positionCount > 0 && (
                    <button
                      onClick={() => handleClosePositions(strat.name)}
                      disabled={isClosing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 rounded-sm hover:bg-red-500/20 disabled:opacity-50 transition-all font-bold"
                    >
                      {isClosing ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
                      Close Positions
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {strategies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-700 gap-2 opacity-50">
            <Shield size={24} />
            <span className="text-[10px] uppercase tracking-widest">No strategies detected</span>
          </div>
        )}
      </div>

      {/* Emergency section */}
      <div className="px-3 py-3 border-t border-red-500/20 bg-red-500/[0.03] shrink-0">
        <div className="flex items-center gap-1.5 mb-2.5">
          <AlertTriangle size={12} className="text-red-400" />
          <span className="text-[10px] text-red-400 uppercase tracking-widest font-black">Emergency Controls</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowEmergencyConfirm('cancel'); setConfirmText(''); }}
            className="flex-1 py-1.5 text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 rounded-sm hover:bg-red-500/20 font-medium transition-all"
          >
            Cancel ALL Orders
          </button>
          <button
            onClick={() => { setShowEmergencyConfirm('close'); setConfirmText(''); }}
            className="flex-1 py-1.5 text-[10px] bg-red-500/20 border border-red-500/40 text-red-400 rounded-sm hover:bg-red-500/30 font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)]"
          >
            Close ALL Positions
          </button>
        </div>
      </div>

      {/* Emergency Confirmation Dialog */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e16] border border-red-500/40 rounded-sm p-6 w-full max-w-[400px] space-y-5 shadow-2xl shadow-red-500/10">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 bg-red-500/10 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <span className="text-lg font-black uppercase tracking-tight">
                {showEmergencyConfirm === 'cancel' ? 'Confirm Cancel ALL' : 'Confirm Close ALL'}
              </span>
            </div>
            
            <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-sm">
              <p className="text-[11px] text-red-200 leading-relaxed font-medium">
                {showEmergencyConfirm === 'cancel'
                  ? 'ABORT ACTION: This will cancel ALL open and pending orders across ALL strategies and ALL exchanges immediately.'
                  : 'LIQUIDATION ACTION: This will close ALL open positions across ALL strategies and ALL exchanges using MARKET orders. This cannot be undone.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Verification Required</label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type CONFIRM"
                className="w-full bg-[#08080d] border border-[#2a2a42] rounded-sm px-3 py-3 text-sm text-zinc-100 outline-none focus:border-red-500 placeholder:text-zinc-800 font-black tracking-widest"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowEmergencyConfirm(null); setConfirmText(''); }}
                className="flex-1 py-2.5 rounded-sm text-xs border border-[#2a2a42] text-zinc-500 hover:text-zinc-300 hover:bg-[#1e1e30] transition-all font-bold uppercase"
              >
                Go Back
              </button>
              <button
                onClick={() => handleEmergency(showEmergencyConfirm)}
                disabled={confirmText !== 'CONFIRM' || !!actionInProgress}
                className="flex-[2] py-2.5 rounded-sm text-xs font-black bg-red-600 border border-red-500 text-white hover:bg-red-500 disabled:opacity-20 disabled:grayscale transition-all uppercase tracking-widest"
              >
                {actionInProgress ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Execute Command'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
