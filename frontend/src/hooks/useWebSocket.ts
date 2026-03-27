import { useEffect, useRef, useCallback } from 'react';
import { useTerminalStore } from './useTerminalStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/market';

// Singleton state at module level
let singletonWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let onDataCallback: ((data: Record<string, unknown>) => void) | null = null;
const priceBuffer: any[] = [];
let bufferTimer: ReturnType<typeof setTimeout> | null = null;

// Track messages sent while connecting
const pendingMessages: string[] = [];

export function useWebSocket() {
  const connectionState = useTerminalStore((s) => s.connection.websocket);
  const setConnection = useTerminalStore((s) => s.setConnection);
  const bulkUpdatePrices = useTerminalStore((s) => s.bulkUpdatePrices);

  const flushBuffer = useCallback(() => {
    if (priceBuffer.length > 0) {
      bulkUpdatePrices([...priceBuffer]);
      priceBuffer.length = 0;
    }
    bufferTimer = null;
  }, [bulkUpdatePrices]);

  const connect = useCallback(() => {
    if (singletonWs?.readyState === WebSocket.OPEN || singletonWs?.readyState === WebSocket.CONNECTING) return;

    setConnection({ websocket: 'connecting' });
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      if (singletonWs !== ws) return;
      console.log('[WS] Connected (Singleton)');
      (window as any).__openTerminalWS = ws;
      setConnection({ websocket: 'connected' });
      
      // Flush any pending messages that were queued while connecting
      while (pendingMessages.length > 0) {
        const msg = pendingMessages.shift();
        if (msg) ws.send(msg);
      }
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      if (singletonWs !== ws) return;
      try {
        const msg = JSON.parse(event.data);

        if ((msg.type === 'ltp' || msg.type === 'market_data') && msg.data) {
          const { symbol, exchange, ltp, change, change_percent, cp } = msg.data;
          
          // Fallback calculations for brokers that don't provide change/percent directly (e.g. Upstox uses 'cp' for Close Price)
          let finalChange = change;
          let finalPercent = change_percent;
          
          if (finalChange === undefined && cp !== undefined && ltp !== undefined) {
            finalChange = ltp - cp;
            finalPercent = (finalChange / cp) * 100;
          }

          priceBuffer.push({ 
            symbol: symbol || msg.symbol, 
            exchange: exchange || msg.exchange, 
            ltp, 
            change: finalChange, 
            changePercent: finalPercent 
          });
          
          if (!bufferTimer) {
            bufferTimer = setTimeout(flushBuffer, 100);
          }
        }

        if (msg.type === 'error') {
          console.error('[WS] Server error:', msg.message);
        }

        onDataCallback?.(msg);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onerror = () => {
      if (singletonWs !== ws) return;
      console.error('[WS] Connection error');
    };

    ws.onclose = () => {
      if (singletonWs !== ws) return;
      console.log('[WS] Disconnected');
      (window as any).__openTerminalWS = null;
      setConnection({ websocket: 'disconnected' });
      singletonWs = null;

      // Auto-reconnect after 5s
      reconnectTimer = setTimeout(() => {
        console.log('[WS] Reconnecting singleton...');
        connect();
      }, 5000);
    };

    singletonWs = ws;
  }, [setConnection, flushBuffer]);

  const disconnect = useCallback(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    singletonWs?.close();
    singletonWs = null;
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    const msg = JSON.stringify(data);
    if (singletonWs?.readyState === WebSocket.OPEN) {
      singletonWs.send(msg);
    } else if (singletonWs?.readyState === WebSocket.CONNECTING) {
      // Queue message to be sent when onopen fires
      pendingMessages.push(msg);
    } else {
      console.warn('[WS] Cannot send message, socket is closed or not initialized');
    }
  }, []);

  const subscribe = useCallback((
    instruments: Array<{ exchange: string; symbol: string }>,
    mode: 'ltp' | 'quote' | 'depth' = 'ltp'
  ) => {
    send({ action: 'subscribe', mode, instruments });
  }, [send]);

  const unsubscribe = useCallback((
    instruments: Array<{ exchange: string; symbol: string }>,
    mode: 'ltp' | 'quote' | 'depth' = 'ltp'
  ) => {
    send({ action: 'unsubscribe', mode, instruments });
  }, [send]);

  const setOnData = useCallback((cb: ((data: Record<string, unknown>) => void) | null) => {
    onDataCallback = cb;
  }, []);

  return { connect, disconnect, subscribe, unsubscribe, send, setOnData, connectionState };
}
