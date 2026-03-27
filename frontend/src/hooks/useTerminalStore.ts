import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  WatchlistItem, ConnectionStatus, PanelConfig,
  TerminalCommand, Exchange, Layouts, ChartSettings,
  BarData
} from '@/lib/types';
import { DEFAULT_WATCHLIST } from '@/lib/constants';

interface WatchlistGroup {
  id: string;
  name: string;
  items: WatchlistItem[];
}

interface TerminalStore {
  // Connection
  connection: ConnectionStatus & { isOffline: boolean };
  setConnection: (c: Partial<ConnectionStatus>) => void;
  setOffline: (offline: boolean) => void;

  // Active symbol (drives chart, depth, etc.)
  activeSymbol: { symbol: string; exchange: Exchange };
  setActiveSymbol: (s: { symbol: string; exchange: Exchange }) => void;

  watchlist: WatchlistItem[];
  watchlistGroups: WatchlistGroup[];
  activeWatchlistId: string;
  addToWatchlist: (symbol: string, exchange: Exchange) => void;
  removeFromWatchlist: (symbol: string, exchange: string) => void;
  updatePrice: (symbol: string, exchange: string, data: Partial<WatchlistItem>) => void;
  bulkUpdatePrices: (updates: Array<{ symbol: string; exchange: string; ltp: number; change?: number; changePercent?: number }>) => void;

  // NEW: Global price cache — keyed by "SYMBOL:EXCHANGE"
  prices: Record<string, { ltp: number; change: number; changePercent: number; updatedAt: number }>;
  lastTickAt: number;
  updateGlobalPrice: (key: string, data: { ltp: number; change: number; changePercent: number }) => void;

  // NEW: Chart history cache — keyed by "SYMBOL:EXCHANGE:INTERVAL"
  chartHistory: Record<string, { bars: BarData[]; fetchedAt: number }>;
  setChartHistory: (key: string, bars: BarData[]) => void;
  getChartHistory: (key: string) => BarData[] | null;

  createWatchlist: (name: string) => void;
  deleteWatchlist: (id: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  switchWatchlist: (id: string) => void;
  importWatchlist: (name: string, symbols: Array<{symbol: string, exchange: string}>) => void;
  exportWatchlist: () => WatchlistGroup | undefined;
  reorderWatchlist: (startIndex: number, endIndex: number) => void;

  // Panels
  panels: PanelConfig[];
  togglePanel: (id: string) => void;
  minimizePanel: (id: string) => void;

  // Commands
  commands: TerminalCommand[];
  addCommand: (cmd: TerminalCommand) => void;
  clearCommands: () => void;

  // Layouts
  isEditMode: boolean;
  toggleEditMode: () => void;
  isAutosaveEnabled: boolean;
  toggleAutosave: () => void;
  commitLayout: () => void;
  resetLayout: (name: string) => void;
  maximizedPanelId: string | null;
  setMaximizedPanel: (id: string | null) => void;
  updatePendingLayout: (layouts: Layouts) => void;
  activeLayoutName: string;
  setActiveLayoutName: (name: string) => void;
  savedLayouts: Record<string, Layouts>;
  savedPanels: Record<string, PanelConfig[]>;
  pendingLayouts: Layouts | null;
  saveLayout: (name: string, layouts: Layouts) => void;
  createLayout: (name: string, options: { isBlank?: boolean }) => void;
  deleteLayout: (name: string) => void;

  // Order defaults
  defaults: {
    exchange: Exchange;
    product: string;
    pricetype: string;
    strategy: string;
    quantity: string;
    autoConfirm: boolean;
    lotSizes: Record<string, number>;
  };
  setDefaults: (d: Partial<TerminalStore['defaults']>) => void;
  updateLotSize: (index: string, size: number) => void;
  // Chart Settings
  chartSettings: ChartSettings;
  updateChartSettings: (s: Partial<ChartSettings>) => void;
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'watchlist', title: 'WATCHLIST', visible: true, minimized: false },
  { id: 'chart', title: 'CHART', visible: true, minimized: false },
  { id: 'orderTicket', title: 'ORDER TICKET', visible: true, minimized: false },
  { id: 'positions', title: 'POSITIONS', visible: true, minimized: false },
  { id: 'orderbook', title: 'ORDER BOOK', visible: true, minimized: false },
  { id: 'tradebook', title: 'TRADE BOOK', visible: true, minimized: false },
  { id: 'funds', title: 'FUNDS', visible: true, minimized: false },
  { id: 'depth', title: 'MARKET DEPTH', visible: false, minimized: false },
  { id: 'optionchain', title: 'OPTION CHAIN', visible: false, minimized: false },
  { id: 'greeks', title: 'GREEKS', visible: false, minimized: false },
  { id: 'holdings', title: 'HOLDINGS', visible: false, minimized: false },
  { id: 'alerts', title: 'ALERTS', visible: false, minimized: false },
  { id: 'analytics', title: 'ANALYTICS', visible: false, minimized: false },
  { id: 'marketoverview', title: 'MARKET OVERVIEW', visible: false, minimized: false },
  { id: 'strategyBuilder', title: 'STRATEGY BUILDER', visible: false, minimized: false },
  { id: 'strategy', title: 'STRATEGIES', visible: false, minimized: false },
];

const MAX_CHART_CACHE_ENTRIES = 10;
const INITIAL_WATCHLIST: WatchlistItem[] = DEFAULT_WATCHLIST.map(w => ({
  ...w,
  ltp: 0, prevClose: 0, change: 0, changePercent: 0,
  volume: 0, bid: 0, ask: 0, oi: 0,
}));

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      // Connection
      connection: {
        api: 'checking' as const,
        websocket: 'disconnected' as const,
        mode: 'live' as const,
        lastCheck: '',
        isOffline: false,
      },
      setConnection: (c) => set((s) => ({
        connection: { ...s.connection, ...c },
      })),
      setOffline: (offline) => set((s) => ({
        connection: { ...s.connection, isOffline: offline },
      })),

      // Active Symbol
      activeSymbol: { symbol: 'NIFTY', exchange: 'NSE_INDEX' as Exchange },
      setActiveSymbol: (sym) => set({ activeSymbol: sym }),

      // Watchlist
      watchlist: INITIAL_WATCHLIST,
      watchlistGroups: [
        {
          id: 'default',
          name: 'Default',
          items: INITIAL_WATCHLIST,
        },
      ],
      activeWatchlistId: 'default',
      addToWatchlist: (symbol, exchange) => set((s) => {
        if (s.watchlist.some(w => w.symbol === symbol && w.exchange === exchange)) return s;
        const newItem: WatchlistItem = {
          symbol, exchange, ltp: 0, prevClose: 0, change: 0,
          changePercent: 0, volume: 0, bid: 0, ask: 0, oi: 0,
        };
        const nextWatchlist = [...s.watchlist, newItem];
        return {
          watchlist: nextWatchlist,
          watchlistGroups: s.watchlistGroups.map(g => 
            g.id === s.activeWatchlistId ? { ...g, items: nextWatchlist } : g
          ),
        };
      }),
      removeFromWatchlist: (symbol, exchange) => set((s) => {
        const nextWatchlist = s.watchlist.filter(w => !(w.symbol === symbol && w.exchange === exchange));
        return {
          watchlist: nextWatchlist,
          watchlistGroups: s.watchlistGroups.map(g => 
            g.id === s.activeWatchlistId ? { ...g, items: nextWatchlist } : g
          ),
        };
      }),
      updatePrice: (symbol, exchange, data) => set((s) => {
        let matchedKey: string | null = null;
        const nextWatchlist = s.watchlist.map(w => {
          const symMatch = w.symbol.toUpperCase() === symbol.toUpperCase();
          if (!symMatch) return w;
          
          const uEx = exchange.toUpperCase();
          const wEx = w.exchange.toUpperCase();
          let exMatch = (uEx === wEx);
          if (!exMatch) {
            if ((uEx === 'NSE' && wEx === 'NSE_INDEX') || (uEx === 'NSE_INDEX' && wEx === 'NSE')) exMatch = true;
            if ((uEx === 'BSE' && wEx === 'BSE_INDEX') || (uEx === 'BSE_INDEX' && wEx === 'BSE')) exMatch = true;
          }

          if (exMatch) {
            matchedKey = `${w.symbol}:${w.exchange}`;
            const updated = { ...w, ...data };
            const pc = updated.prevClose;
            if (pc && pc > 0) {
              updated.change = updated.ltp - pc;
              updated.changePercent = (updated.change / pc) * 100;
            }
            return updated;
          }
          return w;
        });
        
        // Also update global prices cache
        const nextPrices = { ...s.prices };
        if (matchedKey) {
          const item = nextWatchlist.find(w => `${w.symbol}:${w.exchange}` === matchedKey);
          if (item) {
            nextPrices[matchedKey] = {
              ltp: item.ltp,
              change: item.change,
              changePercent: item.changePercent,
              updatedAt: Date.now(),
            };
          }
        }

        return {
          watchlist: nextWatchlist,
          prices: nextPrices,
          watchlistGroups: s.watchlistGroups.map(g => 
            g.id === s.activeWatchlistId ? { ...g, items: nextWatchlist } : g
          ),
        };
      }),
      updateGlobalPrice: (key, data) => set((s) => ({
        prices: {
          ...s.prices,
          [key]: { ...data, updatedAt: Date.now() },
        },
      })),
      prices: {},
      chartHistory: {},
      setChartHistory: (key, bars) => set((s) => {
        const existing = { ...s.chartHistory };
        const keys = Object.keys(existing);
        if (keys.length >= MAX_CHART_CACHE_ENTRIES && !(key in existing)) {
          const oldest = keys.reduce((a, b) =>
            existing[a].fetchedAt < existing[b].fetchedAt ? a : b
          );
          delete existing[oldest];
        }
        existing[key] = { bars, fetchedAt: Date.now() };
        return { chartHistory: existing };
      }),
      getChartHistory: (key) => get().chartHistory[key]?.bars || null,
      reorderWatchlist: (startIndex, endIndex) => set((s) => {
        const nextWatchlist = Array.from(s.watchlist);
        const [removed] = nextWatchlist.splice(startIndex, 1);
        nextWatchlist.splice(endIndex, 0, removed);
        
        return {
          watchlist: nextWatchlist,
          watchlistGroups: s.watchlistGroups.map(g => 
            g.id === s.activeWatchlistId ? { ...g, items: nextWatchlist } : g
          ),
        };
      }),
      lastTickAt: 0,
      bulkUpdatePrices: (updates) => set((s) => {
        const nextPrices = { ...s.prices };
        let hasUpdates = false;
        const nextWatchlist = s.watchlist.map(w => {
          // Normalize comparison for symbols and exchanges
          const update = updates.find(u => {
            const symMatch = u.symbol.toUpperCase() === w.symbol.toUpperCase();
            if (!symMatch) return false;
            
            // Flexible exchange matching: treat NSE/NSE_INDEX and BSE/BSE_INDEX as similar
            const uEx = u.exchange.toUpperCase();
            const wEx = w.exchange.toUpperCase();
            if (uEx === wEx) return true;
            if (uEx === 'NSE' && wEx === 'NSE_INDEX') return true;
            if (uEx === 'NSE_INDEX' && wEx === 'NSE') return true;
            if (uEx === 'BSE' && wEx === 'BSE_INDEX') return true;
            if (uEx === 'BSE_INDEX' && wEx === 'BSE') return true;
            
            return false;
          });

          if (update) hasUpdates = true;
          if (!update) return w;
          
          const ltp = update.ltp;
          const change = (update.change !== undefined) ? update.change : (w.prevClose ? ltp - w.prevClose : 0);
          const changePercent = (update.changePercent !== undefined) ? update.changePercent : (w.prevClose ? (change / w.prevClose) * 100 : 0);
          
          // Sync global cache using the STORE'S key format (SYMBOL:EXCHANGE)
          const key = `${w.symbol}:${w.exchange}`;
          nextPrices[key] = {
            ltp,
            change,
            changePercent,
            updatedAt: Date.now(),
          };
          
          return { ...w, ltp, change, changePercent };
        });
        return {
          watchlist: nextWatchlist,
          prices: nextPrices,
          lastTickAt: hasUpdates ? Date.now() : s.lastTickAt,
          watchlistGroups: s.watchlistGroups.map(g => 
            g.id === s.activeWatchlistId ? { ...g, items: nextWatchlist } : g
          ),
        };
      }),
      createWatchlist: (name) => set((s) => ({
        watchlistGroups: [...s.watchlistGroups, {
          id: `wl-${Date.now()}`,
          name,
          items: [],
        }],
      })),
      deleteWatchlist: (id) => set((s) => {
        if (id === 'default') return s;
        const nextGroups = s.watchlistGroups.filter(g => g.id !== id);
        const nextActiveId = s.activeWatchlistId === id ? 'default' : s.activeWatchlistId;
        const targetGroup = nextGroups.find(g => g.id === nextActiveId);
        return {
          watchlistGroups: nextGroups,
          activeWatchlistId: nextActiveId,
          watchlist: targetGroup?.items || [],
        };
      }),
      renameWatchlist: (id, name) => set((s) => ({
        watchlistGroups: s.watchlistGroups.map(g => g.id === id ? { ...g, name } : g),
      })),
      switchWatchlist: (id) => set((s) => {
        // First save current watchlist to current group
        const savedGroups = s.watchlistGroups.map(g => 
          g.id === s.activeWatchlistId ? { ...g, items: s.watchlist } : g
        );
        const targetGroup = savedGroups.find(g => g.id === id);
        return {
          watchlistGroups: savedGroups,
          activeWatchlistId: id,
          watchlist: targetGroup?.items || [],
        };
      }),
      importWatchlist: (name, symbols) => set((s) => {
        const items: WatchlistItem[] = symbols.map(sym => ({
          symbol: sym.symbol,
          exchange: sym.exchange as any,
          ltp: 0, prevClose: 0, change: 0, changePercent: 0,
          volume: 0, bid: 0, ask: 0, oi: 0,
        }));
        const newGroup = { id: `wl-${Date.now()}`, name, items };
        return {
          watchlistGroups: [...s.watchlistGroups, newGroup],
          activeWatchlistId: newGroup.id,
          watchlist: items,
        };
      }),
      exportWatchlist: () => {
        const s = get();
        return s.watchlistGroups.find(g => g.id === s.activeWatchlistId);
      },

      // Panels
      panels: DEFAULT_PANELS,
      togglePanel: (id) => set((s) => ({
        panels: s.panels.map(p => p.id === id ? { ...p, visible: !p.visible } : p),
      })),
      minimizePanel: (id) => set((s) => ({
        panels: s.panels.map(p => p.id === id ? { ...p, minimized: !p.minimized } : p),
      })),
      maximizedPanelId: null,
      setMaximizedPanel: (id) => set({ maximizedPanelId: id }),

      // Commands
      commands: [],
      addCommand: (cmd) => set((s) => ({
        commands: [...s.commands.slice(-199), cmd],
      })),
      clearCommands: () => set({ commands: [] }),

      // Layouts
      isEditMode: false,
      toggleEditMode: () => set((s) => ({ 
        isEditMode: !s.isEditMode,
        pendingLayouts: !s.isEditMode ? (s.savedLayouts[s.activeLayoutName] || null) : null
      })),
      isAutosaveEnabled: false,
      toggleAutosave: () => set((s) => ({ isAutosaveEnabled: !s.isAutosaveEnabled })),
      pendingLayouts: null,
      updatePendingLayout: (layouts) => set({ pendingLayouts: layouts }),
      commitLayout: () => set((s) => ({
        isEditMode: false,
        savedLayouts: s.pendingLayouts 
          ? { ...s.savedLayouts, [s.activeLayoutName]: s.pendingLayouts }
          : s.savedLayouts,
        savedPanels: { ...s.savedPanels, [s.activeLayoutName]: [...s.panels] },
        pendingLayouts: null
      })),
      resetLayout: (name) => set((s) => {
        const nextLayouts = { ...s.savedLayouts };
        const nextPanels = { ...s.savedPanels };
        delete nextLayouts[name];
        delete nextPanels[name];
        return { 
          savedLayouts: nextLayouts,
          savedPanels: nextPanels,
          panels: name === s.activeLayoutName ? DEFAULT_PANELS : s.panels,
          pendingLayouts: null,
          isEditMode: false
        };
      }),
      activeLayoutName: 'Default',
      setActiveLayoutName: (name) => set((s) => ({ 
        // Save current panels to the OLD active layout before switching
        savedPanels: { ...s.savedPanels, [s.activeLayoutName]: [...s.panels] },
        activeLayoutName: name, 
        panels: s.savedPanels[name] || DEFAULT_PANELS,
        pendingLayouts: null, 
        isEditMode: false 
      })),
      savedLayouts: {},
      savedPanels: {},
      saveLayout: (name, layouts) => set((s) => ({
        savedLayouts: { ...s.savedLayouts, [name]: layouts },
        savedPanels: { ...s.savedPanels, [name]: [...s.panels] }
      })),
      createLayout: (name, { isBlank }) => set((s) => {
        const newPanels = isBlank 
          ? s.panels.map(p => ({ ...p, visible: false }))
          : [...s.panels];
        
        const newGrid = isBlank 
          ? { lg: [] } 
          : (s.pendingLayouts || s.savedLayouts[s.activeLayoutName] || { lg: [] });

        return {
          savedLayouts: { ...s.savedLayouts, [name]: newGrid },
          savedPanels: { ...s.savedPanels, [name]: newPanels },
          activeLayoutName: name,
          panels: newPanels,
          pendingLayouts: null,
          isEditMode: false
        };
      }),
      deleteLayout: (name) => set((s) => {
        const nextLayouts = { ...s.savedLayouts };
        const nextPanels = { ...s.savedPanels };
        delete nextLayouts[name];
        delete nextPanels[name];
        return { 
          savedLayouts: nextLayouts,
          savedPanels: nextPanels
        };
      }),

      // Defaults
      defaults: {
        exchange: 'NSE' as Exchange,
        product: 'MIS',
        pricetype: 'MARKET',
        strategy: 'TERMINAL',
        quantity: '1',
        autoConfirm: false,
        lotSizes: {
          'NIFTY': 25,
          'BANKNIFTY': 15,
          'FINNIFTY': 25,
          'MIDCPNIFTY': 50,
          'SENSEX': 10,
          'BANKEX': 15
        }
      },
      setDefaults: (d) => set((s) => ({
        defaults: { ...s.defaults, ...d },
      })),
      updateLotSize: (index, size) => set((s) => {
        const currentLotSizes = s.defaults.lotSizes || {
          'NIFTY': 25,
          'BANKNIFTY': 15,
          'FINNIFTY': 25,
          'MIDCPNIFTY': 50,
          'SENSEX': 10,
          'BANKEX': 15
        };
        return {
          defaults: {
            ...s.defaults,
            lotSizes: { ...currentLotSizes, [index]: size }
          }
        };
      }),
      // Chart Settings
      chartSettings: {
        showVolume: true,
        indicators: {
          sma: { enabled: false, period: 20, color: '#2962FF' },
          ema: { enabled: false, period: 50, color: '#FF9800' },
          cpr: { enabled: false, period: 0, color: '#FF3D3D' },
        },
      },
      updateChartSettings: (s) => set((state) => ({
        chartSettings: { 
          ...state.chartSettings, 
          ...s,
          indicators: s.indicators ? { ...state.chartSettings.indicators, ...s.indicators } : state.chartSettings.indicators
        },
      })),
    }),
    {
      name: 'open-terminal',
      version: 6,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return persistedState;
        
        // v3 migration merged here
        if (version < 3) {
          const currentPanels = persistedState.panels || [];
          const missingPanels = DEFAULT_PANELS.filter(dp => !currentPanels.find((cp: any) => cp.id === dp.id));
          if (missingPanels.length > 0) {
            persistedState.panels = [...currentPanels, ...missingPanels];
          }
        }

        // v4 Migration: Ensure lotSizes exists and has all indices
        if (!persistedState.defaults) persistedState.defaults = {};
        const standardLotSizes = {
          'NIFTY': 25,
          'BANKNIFTY': 15,
          'FINNIFTY': 25,
          'MIDCPNIFTY': 50,
          'SENSEX': 10,
          'BANKEX': 15
        };
        
        if (!persistedState.defaults.lotSizes) {
          persistedState.defaults.lotSizes = standardLotSizes;
        } else {
          // Merge missing indices into existing lotSizes
          persistedState.defaults.lotSizes = { ...standardLotSizes, ...persistedState.defaults.lotSizes };
        }

        // Rename spreadbuilder to strategyBuilder in existing state
        if (persistedState.panels) {
          persistedState.panels = persistedState.panels.map((p: any) => 
            p.id === 'spreadbuilder' ? { ...p, id: 'strategyBuilder', title: 'STRATEGY BUILDER' } : p
          );
        }
        if (persistedState.savedPanels) {
          Object.keys(persistedState.savedPanels).forEach(key => {
            persistedState.savedPanels[key] = persistedState.savedPanels[key].map((p: any) => 
              p.id === 'spreadbuilder' ? { ...p, id: 'strategyBuilder', title: 'STRATEGY BUILDER' } : p
            );
          });
        }
        if (persistedState.savedLayouts) {
          Object.keys(persistedState.savedLayouts).forEach(key => {
            if (persistedState.savedLayouts[key].lg) {
              persistedState.savedLayouts[key].lg = persistedState.savedLayouts[key].lg.map((l: any) => 
                l.i === 'spreadbuilder' ? { ...l, i: 'strategyBuilder' } : l
              );
            }
          });
        }
        
        // Ensure cpr indicator settings exist
        if (!persistedState.chartSettings) persistedState.chartSettings = {};
        if (!persistedState.chartSettings.indicators) persistedState.chartSettings.indicators = {};
        if (!persistedState.chartSettings.indicators.cpr) {
          persistedState.chartSettings.indicators.cpr = { enabled: false, period: 0, color: '#FF3D3D' };
        }

        // v5 Migration: Add pricetype and autoConfirm defaults
        if (version < 5) {
          if (persistedState.defaults) {
            if (persistedState.defaults.pricetype === undefined) persistedState.defaults.pricetype = 'MARKET';
            if (persistedState.defaults.autoConfirm === undefined) persistedState.defaults.autoConfirm = false;
          }
        }
        
        return persistedState;
      },
      partialize: (state) => ({
        watchlist: state.watchlist,
        watchlistGroups: state.watchlistGroups,
        activeWatchlistId: state.activeWatchlistId,
        panels: state.panels,
        savedPanels: state.savedPanels,
        activeLayoutName: state.activeLayoutName,
        isAutosaveEnabled: state.isAutosaveEnabled,
        maximizedPanelId: state.maximizedPanelId,
        chartSettings: state.chartSettings,
        defaults: state.defaults,
        savedLayouts: state.savedLayouts,
        activeSymbol: state.activeSymbol,
        prices: state.prices,
        chartHistory: state.chartHistory,
      }),
    }
  )
);
