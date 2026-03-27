'use client';

import { useState, useRef, useEffect } from 'react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { ChevronRight } from 'lucide-react';

export function CommandOutput() {
  const { commands, clearCommands } = useTerminalStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commands.length]);

  // Show only last N commands
  const visibleCommands = commands.slice(-20);

  if (commands.length === 0) return null;

  return (
    <div className={`border-t border-[#1e1e30] bg-[#0a0a12] transition-all flex flex-col ${expanded ? 'h-[200px]' : 'h-[80px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-0.5 border-b border-[#1e1e30] shrink-0 bg-[#08080d]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-wider"
        >
          {expanded ? '▼ Collapse' : '▲ Expand'} Output ({commands.length})
        </button>
        <button
          onClick={clearCommands}
          className="text-[9px] text-zinc-600 hover:text-red-400 font-bold uppercase tracking-wider"
        >
          Clear
        </button>
      </div>

      {/* Output area */}
      <div ref={scrollRef} className="overflow-auto flex-1 px-3 py-2 scrollbar-thin scrollbar-thumb-[#1e1e30]">
        {visibleCommands.map((cmd, idx) => (
          <div key={idx} className="mb-2 last:mb-0">
            {/* Input line */}
            <div className="flex items-start gap-1.5 opacity-80">
              <ChevronRight size={10} className="text-emerald-400 mt-1 shrink-0" />
              <span className="text-[11px] text-emerald-400/90 font-mono italic">{cmd.input}</span>
            </div>
            {/* Output */}
            <div className="ml-4 mt-0.5">
              <pre className={`text-[10px] whitespace-pre-wrap font-mono leading-relaxed tracking-tight ${
                cmd.success ? 'text-zinc-400' : 'text-red-400'
              }`}>
                {cmd.output}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
