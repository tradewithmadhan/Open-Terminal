'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// Global toast state
let toastListeners: ((toast: Toast) => void)[] = [];

export function showToast(type: ToastType, title: string, message?: string, duration = 4000) {
  const toast: Toast = {
    id: Date.now().toString() + Math.random(),
    type, title, message, duration,
  };
  toastListeners.forEach(fn => fn(toast));
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400', text: 'text-emerald-300' },
  error:   { bg: 'bg-red-500/10',     border: 'border-red-500/30',     icon: 'text-red-400',     text: 'text-red-300' },
  warning: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: 'text-amber-400',   text: 'text-amber-300' },
  info:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    icon: 'text-blue-400',    text: 'text-blue-300' },
};

export function ToastManager() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (toast: Toast) => {
      setToasts(prev => [...prev.slice(-4), toast]); // Max 5 toasts
      if (toast.duration) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, toast.duration);
      }
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== handler);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-12 right-4 z-[100] flex flex-col gap-2 w-[360px]">
      {toasts.map(toast => {
        const Icon = ICONS[toast.type];
        const colors = COLORS[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-sm border ${colors.bg} ${colors.border} shadow-xl animate-in slide-in-from-right-5`}
          >
            <Icon size={14} className={`${colors.icon} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${colors.text}`}>{toast.title}</div>
              {toast.message && (
                <div className="text-[10px] text-zinc-400 mt-0.5 break-words">{toast.message}</div>
              )}
            </div>
            <button onClick={() => dismiss(toast.id)} className="p-0.5 hover:bg-white/5 rounded shrink-0">
              <X size={10} className="text-zinc-600" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
