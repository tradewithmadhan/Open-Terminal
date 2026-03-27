'use client';

import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePositions } from '@/hooks/useApi';

/**
 * PriceSync — renders nothing, manages WebSocket subscriptions globally.
 * Mounted in TerminalShell to track all active symbols (Watchlist + Positions).
 */
export function PriceSync() {
  const { watchlist, updateGlobalPrice, setOffline } = useTerminalStore();
  const { subscribe, unsubscribe, connectionState } = useWebSocket();
  const { data: positionsData } = usePositions();

  // Track which symbols are currently subscribed to avoid redundant calls
  const subscribedRef = useRef<Set<string>>(new Set());

  // Sync isOffline from WS connection state
  useEffect(() => {
    const isOffline = connectionState !== 'connected';
    setOffline(isOffline);
    
    // CRITICAL: When we reconnect, clear the subscription ref to force a fresh subscribe
    if (connectionState === 'connected') {
      console.log('[PriceSync] Reconnected, clearing subscription cache');
      subscribedRef.current.clear();
    }
  }, [connectionState, setOffline]);

  // Subscribe/resubscribe when watchlist or positions change
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const desired = new Set<string>();
    
    // Get symbols from watchlist
    watchlist.forEach(item => {
      desired.add(`${item.exchange}:${item.symbol}`);
    });
    
    // Get symbols from open positions
    if (positionsData?.data) {
      const positions = Array.isArray(positionsData.data) ? positionsData.data : [];
      positions.forEach((p: any) => {
        const symbol = p.symbol || p.tradingsymbol;
        const exchange = p.exchange || 'NSE';
        if (symbol) {
          desired.add(`${exchange}:${symbol}`);
        }
      });
    }

    // Unsubscribe stale symbols
    const toUnsub: Array<{ exchange: string; symbol: string }> = [];
    subscribedRef.current.forEach((key) => {
      if (!desired.has(key)) {
        const [exchange, symbol] = key.split(':');
        toUnsub.push({ exchange, symbol });
        subscribedRef.current.delete(key);
      }
    });
    if (toUnsub.length > 0) {
      unsubscribe(toUnsub);
    }

    // Subscribe new symbols
    const toSub: Array<{ exchange: string; symbol: string }> = [];
    desired.forEach((key) => {
      if (!subscribedRef.current.has(key)) {
        const [exchange, symbol] = key.split(':');
        toSub.push({ exchange, symbol });
        subscribedRef.current.add(key);
      }
    });

    if (toSub.length > 0) {
      console.log(`[PriceSync] Subscribing to ${toSub.length} symbols:`, toSub.map(s => `${s.exchange}:${s.symbol}`));
      subscribe(toSub, 'ltp');
    }
  }, [watchlist, positionsData, connectionState, subscribe, unsubscribe]);

  return null;
}
