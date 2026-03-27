'use client';

import { useEffect, useCallback } from 'react';
import { WifiOff } from 'lucide-react';
import { TopBar } from './TopBar';
import { CommandBar } from './CommandBar';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { healthApi } from '@/lib/api-client';

// Panel placeholders (we'll replace these in Phase 2-4)
import { WatchlistPanel } from '@/components/panels/WatchlistPanel';
import { ChartPanel } from '@/components/panels/ChartPanel';
import { OrderTicketPanel } from '@/components/panels/OrderTicketPanel';
import { PositionsPanel } from '@/components/panels/PositionsPanel';
import { OrderBookPanel } from '@/components/panels/OrderBookPanel';
import { TradeBookPanel } from '@/components/panels/TradeBookPanel';

import { CommandOutput } from './CommandOutput';
import { GridLayout } from './GridLayout';
import { ToastManager } from '@/components/common/ToastManager';

import { useRouter } from 'next/navigation';
import { useAlertMonitor } from '@/hooks/useAlerts';
import { PriceSync } from './PriceSync';

export function TerminalShell() {
  const { connection, setConnection, panels, togglePanel, minimizePanel, watchlist } = useTerminalStore();
  const ws = useWebSocket();
  const router = useRouter();
  
  // Initialize price alert monitor
  useAlertMonitor();

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // "/" or Ctrl+K focuses command bar (unless already in an input)
      if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName
      )) {
        e.preventDefault();
        const cmdInput = document.querySelector('[data-command-input]') as HTMLInputElement;
        if (cmdInput) cmdInput.focus();
      }

      // Escape blurs the command bar or closes modals
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
      }

      // Alt Shortcuts (Toggle Panels)
      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'w') { e.preventDefault(); togglePanel('watchlist'); }
        if (key === 'c') { e.preventDefault(); togglePanel('chart'); }
        if (key === 'o') { e.preventDefault(); togglePanel('orderbook'); }
        if (key === 'p') { e.preventDefault(); togglePanel('positions'); }
        if (key === 't') { e.preventDefault(); togglePanel('tradebook'); }
        if (key === 's') { e.preventDefault(); router.push('/settings'); }
      }
    };

    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, [togglePanel, router]);

  // ─── API Health Check ─────────────────────────
  useEffect(() => {
    const check = async () => {
      setConnection({ api: 'checking' });
      try {
        const { data } = await healthApi.check();
        setConnection({
          api: data.openalgo === 'online' ? 'online' : 'offline',
          lastCheck: new Date().toISOString(),
        });
        // Check analyzer mode
        try {
          const { data: analyzerData } = await healthApi.getAnalyzer();
          setConnection({ mode: analyzerData.analyzer_enabled ? 'paper' : 'live' });
        } catch { /* ignore */ }
      } catch {
        setConnection({ api: 'offline', lastCheck: new Date().toISOString() });
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [setConnection]);

  // WebSocket connection management
  useEffect(() => {
    // We attempt to connect even if API is 'checking' or 'offline'
    // but PriceSync handles the actual subscription logic once ready.
    ws.connect();
    return () => ws.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Panel helpers ────────────────────────────
  const isVisible = useCallback(
    (id: string) => panels.find(p => p.id === id)?.visible ?? false,
    [panels]
  );
  const isMinimized = useCallback(
    (id: string) => panels.find(p => p.id === id)?.minimized ?? false,
    [panels]
  );

  const showOptionChain = isVisible('optionchain');

  return (
    <div className="flex flex-col h-screen w-screen bg-[#08080d] text-zinc-200 overflow-hidden">
      <PriceSync />
      <TopBar />

      <div className="flex-1 overflow-hidden transition-all duration-500">
        <GridLayout />
      </div>

      <CommandOutput />
      <CommandBar />
      <ToastManager />
    </div>
  );
}

