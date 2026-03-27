'use client';

import { useState, useEffect } from 'react';
import { Zap, Loader2, ShieldCheck, Cpu, Globe } from 'lucide-react';

export function StartupScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing core systems...');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const sequence = [
      { p: 15, s: 'Loading API configuration...' },
      { p: 35, s: 'Establishing WebSocket handshake...' },
      { p: 55, s: 'Fetching market watchlist...' },
      { p: 80, s: 'Securing trade tunnel...' },
      { p: 100, s: 'Ready' }
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < sequence.length) {
        setProgress(sequence[currentIdx].p);
        setStatus(sequence[currentIdx].s);
        currentIdx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsDone(true);
          setTimeout(onComplete, 500); // Fade out time
        }, 500);
      }
    }, 600);

    // Failsafe timeout: always complete after 5 seconds
    const failsafe = setTimeout(() => {
      if (!isDone) {
        clearInterval(interval);
        setProgress(100);
        setStatus('Ready — Failsafe triggered');
        setTimeout(() => {
          setIsDone(true);
          setTimeout(onComplete, 500);
        }, 300);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]); // Removed isDone from deps to avoid re-triggering logic

  return (
    <div className={`
      fixed inset-0 z-[999] bg-[#08080d] flex flex-col items-center justify-center transition-opacity duration-500
      ${isDone ? 'opacity-0' : 'opacity-100'}
    `}>
      <div className="relative flex flex-col items-center">
        {/* Animated Glow */}
        <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full" />
        
        {/* Logo */}
        <div className="relative mb-8 text-emerald-400 group">
          <Zap size={64} className="animate-pulse" />
          <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full scale-150 animate-ping opacity-20" />
        </div>

        <h1 className="text-2xl font-black tracking-tighter text-white mb-2">
          OPEN<span className="text-emerald-400">TERMINAL</span>
        </h1>
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-bold mb-12">
          Advanced Algorithmic Trading Interface
        </p>

        {/* Progress Container */}
        <div className="w-64 space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin text-emerald-400" />
              {status}
            </span>
            <span className="text-emerald-400 tabular-nums">{progress}%</span>
          </div>
          
          <div className="h-1 w-full bg-[#1e1e30] rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* System Checklist */}
        <div className="mt-16 flex gap-8">
          <StatusIndicator icon={<ShieldCheck size={14} />} active={progress > 20} />
          <StatusIndicator icon={<Cpu size={14} />} active={progress > 50} />
          <StatusIndicator icon={<Globe size={14} />} active={progress > 80} />
        </div>
      </div>

      <div className="absolute bottom-8 text-[9px] text-zinc-700 tracking-widest font-bold uppercase transition-all hover:text-emerald-500 cursor-default">
        v1.0.0 — Professional Trading Terminal for Everyone
      </div>
    </div>
  );
}

function StatusIndicator({ icon, active }: { icon: React.ReactNode, active: boolean }) {
  return (
    <div className={`transition-all duration-300 ${active ? 'text-emerald-400' : 'text-zinc-800'}`}>
      {icon}
    </div>
  );
}
