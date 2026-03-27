'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below';
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'disabled';

export interface PriceAlert {
  id: string;
  symbol: string;
  exchange: string;
  condition: AlertCondition;
  targetPrice: number;
  currentPrice: number;
  status: AlertStatus;
  createdAt: string;
  triggeredAt?: string;
  message?: string;
  sound: boolean;
  repeat: boolean;
}

interface AlertStore {
  alerts: PriceAlert[];
  addAlert: (alert: Omit<PriceAlert, 'id' | 'status' | 'createdAt' | 'currentPrice'>) => void;
  removeAlert: (id: string) => void;
  updateAlertPrice: (symbol: string, exchange: string, price: number) => void;
  triggerAlert: (id: string) => void;
  disableAlert: (id: string) => void;
  clearTriggered: () => void;
  activeCount: () => number;
}

export const useAlertStore = create<AlertStore>()(
  persist(
    (set, get) => ({
      alerts: [],

      addAlert: (alert) => set((s) => ({
        alerts: [...s.alerts, {
          ...alert,
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          status: 'active' as AlertStatus,
          createdAt: new Date().toISOString(),
          currentPrice: 0,
        }],
      })),

      removeAlert: (id) => set((s) => ({
        alerts: s.alerts.filter(a => a.id !== id),
      })),

      updateAlertPrice: (symbol, exchange, price) => set((s) => ({
        alerts: s.alerts.map(a => {
          if (a.symbol !== symbol || a.exchange !== exchange) return a;
          if (a.status !== 'active') return { ...a, currentPrice: price };

          // Check alert condition
          let triggered = false;
          if (a.condition === 'above' && price >= a.targetPrice) triggered = true;
          if (a.condition === 'below' && price <= a.targetPrice) triggered = true;
          if (a.condition === 'cross_above' && a.currentPrice < a.targetPrice && price >= a.targetPrice) triggered = true;
          if (a.condition === 'cross_below' && a.currentPrice > a.targetPrice && price <= a.targetPrice) triggered = true;

          if (triggered) {
            return {
              ...a,
              currentPrice: price,
              status: a.repeat ? 'active' as AlertStatus : 'triggered' as AlertStatus,
              triggeredAt: new Date().toISOString(),
            };
          }

          return { ...a, currentPrice: price };
        }),
      })),

      triggerAlert: (id) => set((s) => ({
        alerts: s.alerts.map(a =>
          a.id === id ? { ...a, status: 'triggered' as AlertStatus, triggeredAt: new Date().toISOString() } : a
        ),
      })),

      disableAlert: (id) => set((s) => ({
        alerts: s.alerts.map(a =>
          a.id === id ? { ...a, status: 'disabled' as AlertStatus } : a
        ),
      })),

      clearTriggered: () => set((s) => ({
        alerts: s.alerts.filter(a => a.status !== 'triggered'),
      })),

      activeCount: () => get().alerts.filter(a => a.status === 'active').length,
    }),
    { name: 'open-terminal-alerts' }
  )
);

// ─── Alert Checker Hook ──────────────────────────────
// Use this in TerminalShell to monitor watchlist prices

import { useEffect, useRef } from 'react';
import { useTerminalStore } from './useTerminalStore';
import { showToast } from '@/components/common/ToastManager';

export function useAlertMonitor() {
  const watchlist = useTerminalStore((s) => s.watchlist);
  const { alerts, updateAlertPrice } = useAlertStore();
  const prevTriggeredRef = useRef<Set<string>>(new Set());
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let triggeredAny = false;

    // Update prices for all alerts
    watchlist.forEach(w => {
      const key = `${w.exchange}:${w.symbol}`;
      if (w.ltp > 0 && w.ltp !== prevPricesRef.current[key]) {
        updateAlertPrice(w.symbol, w.exchange, w.ltp);
        prevPricesRef.current[key] = w.ltp;
      }
    });
  }, [watchlist, updateAlertPrice]);

  useEffect(() => {
    // Check for newly triggered alerts
    const currentTriggeredIds = new Set(
      alerts.filter(a => a.status === 'triggered' || a.triggeredAt).map(a => a.id)
    );

    alerts.forEach(a => {
      if (a.triggeredAt && !prevTriggeredRef.current.has(a.id)) {
        // New trigger!
        const condText = a.condition.includes('above') ? '▲' : '▼';
        showToast(
          'warning',
          `🔔 Alert: ${a.symbol} ${condText} ₹${a.targetPrice.toLocaleString('en-IN')}`,
          `Current: ₹${a.currentPrice.toLocaleString('en-IN')}`,
          8000
        );

        // Play sound
        if (a.sound) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch {}
        }
      }
    });

    prevTriggeredRef.current = currentTriggeredIds;
  }, [alerts]);
}
