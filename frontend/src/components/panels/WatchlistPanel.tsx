'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, RefreshCw, X, Bell, Download, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { marketApi, orderApi } from '@/lib/api-client';
import { formatPrice, formatPercent, formatVolume } from '@/lib/formatters';
import type { Exchange, WatchlistItem } from '@/lib/types';
import { EXCHANGES } from '@/lib/constants';
import { AlertDialog } from '@/components/common/AlertDialog';
import { useAlertStore } from '@/hooks/useAlerts';
import { downloadJSON } from '@/lib/export';
import { showToast } from '@/components/common/ToastManager';

export function WatchlistPanel() {
  const {
    watchlist, addToWatchlist, removeFromWatchlist,
    activeSymbol, setActiveSymbol, updatePrice,
    watchlistGroups, activeWatchlistId, switchWatchlist,
    createWatchlist, deleteWatchlist, defaults,
    exportWatchlist, importWatchlist, reorderWatchlist,
    prices, connection
  } = useTerminalStore();
  
  const { addAlert } = useAlertStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newExchange, setNewExchange] = useState<Exchange>('NSE');
  const [isLoading, setIsLoading] = useState(false);
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down' | null>>({});
  const [alertSymbol, setAlertSymbol] = useState<{ symbol: string; exchange: Exchange; price: number } | null>(null);

  // ─── Initial load: fetch all quotes ─────────────
  const fetchAllQuotes = useCallback(async () => {
    if (watchlist.length === 0) return;
    setIsLoading(true);
    try {
      const symbols = watchlist.map(w => ({ symbol: w.symbol, exchange: w.exchange }));
      const { data } = await marketApi.multiQuote(symbols);
      
      if (data.status === 'success' && data.results) {
        data.results.forEach((result: any) => {
          if (result.data) {
            const updateObj: any = {
              ltp: parseFloat(result.data.ltp || result.data.last_price || 0),
              bid: parseFloat(result.data.bid || 0),
              ask: parseFloat(result.data.ask || 0),
              volume: parseFloat(result.data.volume || 0),
              oi: parseFloat(result.data.oi || 0),
            };
            const pc = result.data.prev_close || result.data.close_price || result.data.close;
            if (pc) updateObj.prevClose = parseFloat(pc);

            updatePrice(result.symbol, result.exchange || '', updateObj);
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    }
    setIsLoading(false);
  }, [watchlist.length, updatePrice]);

  // Initial fetch + refresh interval
  useEffect(() => {
    fetchAllQuotes();
    const interval = setInterval(fetchAllQuotes, 30000);
    return () => clearInterval(interval);
  }, [fetchAllQuotes]);

  // ─── Price flash detection ──────────────────────
  useEffect(() => {
    const newFlash: Record<string, 'up' | 'down' | null> = {};
    let hasFlash = false;

    watchlist.forEach(w => {
      const key = `${w.symbol}:${w.exchange}`;
      const prev = prevPricesRef.current[key];
      if (prev !== undefined && w.ltp !== prev) {
        newFlash[key] = w.ltp > prev ? 'up' : 'down';
        hasFlash = true;
      }
      prevPricesRef.current[key] = w.ltp;
    });

    if (hasFlash) {
      setFlashMap(newFlash);
      const timer = setTimeout(() => setFlashMap({}), 300);
      return () => clearTimeout(timer);
    }
  }, [watchlist]);

  // ─── Add symbol handler ─────────────────────────
  const handleAdd = useCallback(() => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    
    // Check duplicate
    const exists = watchlist.some(w => w.symbol === sym && w.exchange === newExchange);
    if (exists) return;

    addToWatchlist(sym, newExchange);
    setNewSymbol('');
    setShowAdd(false);
  }, [newSymbol, newExchange, watchlist, addToWatchlist]);

  const handleExport = () => {
    const group = exportWatchlist();
    if (!group) return;
    downloadJSON(`watchlist-${group.name.toLowerCase()}`, group);
    showToast('success', 'Watchlist Exported', `Saved ${group.items.length} symbols`);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re: any) => {
        try {
          const content = JSON.parse(re.target.result);
          if (content.name && Array.isArray(content.items)) {
            importWatchlist(content.name, content.items);
            showToast('success', 'Watchlist Imported', `Loaded ${content.items.length} symbols`);
          } else {
            showToast('error', 'Import Failed', 'Invalid watchlist format');
          }
        } catch {
          showToast('error', 'Import Failed', 'Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleRowClick = (item: WatchlistItem) => {
    setActiveSymbol({ symbol: item.symbol, exchange: item.exchange });
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Watchlist Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[#1e1e30] bg-[#0a0a12]/50">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {watchlistGroups.map(g => (
            <div key={g.id} className="group/tab flex items-center h-5">
              <button
                onClick={() => switchWatchlist(g.id)}
                className={`px-2 h-full text-[9px] font-bold rounded-sm transition-colors whitespace-nowrap ${
                  activeWatchlistId === g.id
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {g.name}
              </button>
              {g.id !== 'default' && activeWatchlistId === g.id && (
                <button 
                  onClick={() => { if(confirm('Delete watchlist?')) deleteWatchlist(g.id); }}
                  className="hidden group-hover/tab:block px-1 text-zinc-700 hover:text-red-400"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            const name = prompt('Watchlist name:');
            if (name) createWatchlist(name);
          }}
          className="p-1 text-zinc-600 hover:text-emerald-400 transition-colors"
          title="New Watchlist"
        >
          <Plus size={10} />
        </button>
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1e1e30]">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          <Plus size={12} />
          <span>Add Symbol</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={handleImport}
            className="p-1 hover:bg-[#1e1e30] rounded text-zinc-500 hover:text-emerald-400"
            title="Import Watchlist (JSON)"
          >
            <Upload size={11} />
          </button>
          <button
            onClick={handleExport}
            className="p-1 hover:bg-[#1e1e30] rounded text-zinc-500 hover:text-emerald-400"
            title="Export Watchlist (JSON)"
          >
            <Download size={11} />
          </button>
          <button
            onClick={fetchAllQuotes}
            disabled={isLoading}
            className="p-1 hover:bg-[#1e1e30] rounded transition-colors"
          >
            <RefreshCw size={11} className={`text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Add symbol row */}
      {showAdd && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1e1e30] bg-[#0a0a12]">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
            placeholder="Symbol..."
            className="flex-1 bg-[#08080d] border border-[#2a2a42] rounded-sm px-2 py-1 text-zinc-200 outline-none"
            autoFocus
          />
          <select
            value={newExchange}
            onChange={(e) => setNewExchange(e.target.value as Exchange)}
            className="bg-[#08080d] border border-[#2a2a42] rounded-sm px-1 py-1 text-zinc-500 text-[10px] outline-none"
          >
            {EXCHANGES.map(ex => (
              <option key={ex.value} value={ex.value}>{ex.label}</option>
            ))}
          </select>
          <button onClick={handleAdd} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#0d0d1a] border-b border-[#1e1e30] z-10 shadow-sm">
            <tr className="text-[9px] text-zinc-600 uppercase tracking-wider">
              <th className="text-left px-2 py-1.5 font-medium">Symbol</th>
              <th className="text-right px-2 py-1.5 font-medium">LTP</th>
              <th className="text-right px-2 py-1.5 font-medium">Change</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((item) => {
              const isActive = activeSymbol.symbol === item.symbol && activeSymbol.exchange === item.exchange;
              const flash = flashMap[`${item.symbol}:${item.exchange}`];
              const flashClass = flash === 'up' ? 'bg-emerald-500/20' : flash === 'down' ? 'bg-red-500/20' : '';

              const priceKey = `${item.symbol}:${item.exchange}`;
              const cachedPrice = prices[priceKey];
              
              // Use live WS price or fall back to store item or price cache
              const displayLtp = item.ltp || cachedPrice?.ltp || 0;
              const displayChange = item.change || cachedPrice?.change || 0;
              const displayChangePercent = item.changePercent || cachedPrice?.changePercent || 0;
              const isStale = displayLtp > 0 && !flash && connection.isOffline;

              return (
                <tr
                  key={`${item.symbol}:${item.exchange}`}
                  onClick={() => handleRowClick(item)}
                  className={`border-b border-[#1e1e30]/30 hover:bg-[#1c1c2e] cursor-pointer transition-colors group ${isActive ? 'bg-[#1c1c2e]' : ''} ${flashClass}`}
                >
                  <td className="px-2 py-2">
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-bold ${isActive ? 'text-emerald-400' : 'text-zinc-200'} ${isStale ? 'opacity-40' : ''}`}>
                        {item.symbol}
                      </span>
                    </div>
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${isStale ? 'opacity-40' : ''}`}>
                    <span className={`text-[11px] font-medium ${displayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {displayLtp > 0 ? formatPrice(displayLtp) : '—'}
                    </span>
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${isStale ? 'opacity-40' : ''}`}>
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] ${displayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {displayChange >= 0 ? '+' : ''}{formatPrice(displayChange)}
                      </span>
                      <span className={`text-[8px] ${displayChange >= 0 ? 'text-emerald-400' : 'text-red-400'} opacity-60`}>
                        {formatPercent(displayChangePercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = watchlist.indexOf(item);
                          if (idx > 0) reorderWatchlist(idx, idx - 1);
                        }}
                        className="p-1 hover:bg-[#2a2a42] rounded transition-colors group-hover:block hidden"
                        title="Move Up"
                      >
                        <ChevronUp size={10} className="text-zinc-500" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = watchlist.indexOf(item);
                          if (idx < watchlist.length - 1) reorderWatchlist(idx, idx + 1);
                        }}
                        className="p-1 hover:bg-[#2a2a42] rounded transition-colors group-hover:block hidden"
                        title="Move Down"
                      >
                        <ChevronDown size={10} className="text-zinc-500" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAlertSymbol({ symbol: item.symbol, exchange: item.exchange, price: item.ltp });
                        }}
                        className="p-1 hover:bg-[#2a2a42] rounded transition-colors"
                        title="Set Price Alert"
                      >
                        <Bell size={10} className="text-zinc-500 hover:text-amber-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWatchlist(item.symbol, item.exchange);
                        }}
                        className="p-1 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove"
                      >
                        <X size={10} className="text-zinc-600 hover:text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {watchlist.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-600">
            <Plus className="opacity-20 mb-2" size={32} />
            <p className="text-[11px]">Your watchlist is empty.</p>
            <button onClick={() => setShowAdd(true)} className="mt-2 text-[#448aff] hover:underline">
              Add some symbols
            </button>
          </div>
        )}
      </div>

      {/* Detail Bar */}
      {activeSymbol.symbol && (
        <div className="bg-[#0d0d1a] border-t border-[#1e1e30] px-3 py-1.5 animate-in slide-in-from-bottom duration-200">
          {watchlist.find(w => w.symbol === activeSymbol.symbol && w.exchange === activeSymbol.exchange) ? (
            (() => {
              const item = watchlist.find(w => w.symbol === activeSymbol.symbol && w.exchange === activeSymbol.exchange)!;
              const spread = Math.max(0, item.ask - item.bid);
              return (
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-zinc-600 text-[8px] uppercase font-bold">Bid</span>
                      <span className="text-emerald-400 font-mono tracking-tighter">{formatPrice(item.bid || 0)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-600 text-[8px] uppercase font-bold">Ask</span>
                      <span className="text-red-400 font-mono tracking-tighter">{formatPrice(item.ask || 0)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-600 text-[8px] uppercase font-bold">Spread</span>
                      <span className="text-zinc-400 font-mono tracking-tighter">{formatPrice(spread)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-zinc-600 text-[8px] uppercase font-bold">Open Interest</span>
                    <span className="text-zinc-300 font-bold">{formatVolume(item.oi || 0)}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-zinc-600 italic">Select a symbol to view market depth details</div>
          )}
        </div>
      )}

      {alertSymbol && (
        <AlertDialog
          symbol={alertSymbol.symbol}
          exchange={alertSymbol.exchange}
          currentPrice={alertSymbol.price}
          onClose={() => setAlertSymbol(null)}
        />
      )}
    </div>
  );
}
