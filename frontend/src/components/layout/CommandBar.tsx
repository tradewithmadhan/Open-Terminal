'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Terminal, Send } from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { commandApi } from '@/lib/api-client';
import { useAlertStore } from '@/hooks/useAlerts';

const COMMANDS = [
  { cmd: '/buy', hint: 'SYMBOL QTY [PRICE]', desc: 'Place buy order' },
  { cmd: '/sell', hint: 'SYMBOL QTY [PRICE]', desc: 'Place sell order' },
  { cmd: '/cancel', hint: 'ORDERID | all', desc: 'Cancel order' },
  { cmd: '/cancelall', hint: '', desc: 'Shorthand for /cancel all' },
  { cmd: '/exit', hint: 'SYMBOL | all', desc: 'Exit position' },
  { cmd: '/exitall', hint: '', desc: 'Shorthand for /exit all' },
  { cmd: '/modify', hint: 'ORDERID QTY PRICE', desc: 'Modify order' },
  { cmd: '/quote', hint: 'SYMBOL', desc: 'Get quote' },
  { cmd: '/q', hint: 'SYMBOL', desc: 'Get quote (alias)' },
  { cmd: '/depth', hint: 'SYMBOL', desc: 'Market depth' },
  { cmd: '/watch', hint: 'SYMBOL', desc: 'Add to watchlist' },
  { cmd: '/w', hint: 'SYMBOL', desc: 'Add to watchlist (alias)' },
  { cmd: '/unwatch', hint: 'SYMBOL', desc: 'Remove from watchlist' },
  { cmd: '/positions', hint: '', desc: 'Show positions' },
  { cmd: '/pos', hint: '', desc: 'Show positions (alias)' },
  { cmd: '/orders', hint: '', desc: 'Show order book' },
  { cmd: '/trades', hint: '', desc: 'Show trade book' },
  { cmd: '/funds', hint: '', desc: 'Show account funds' },
  { cmd: '/holdings', hint: '', desc: 'Show holdings' },
  { cmd: '/chain', hint: 'UNDERLYING', desc: 'Option chain' },
  { cmd: '/greeks', hint: 'OPTION_SYMBOL', desc: 'Option Greeks' },
  { cmd: '/expiry', hint: 'SYMBOL', desc: 'Expiry dates' },
  { cmd: '/ping', hint: '', desc: 'Check connection' },
  { cmd: '/mode', hint: '[live|paper]', desc: 'Trading mode' },
  { cmd: '/help', hint: '[command]', desc: 'Show help' },
  { cmd: '/alert', hint: 'SYMBOL cond PRICE', desc: 'Set price alert' },
  { cmd: '/export', hint: '[orders|trades|pos|holdings]', desc: 'Export data to CSV' },
  { cmd: '/clear', hint: '', desc: 'Clear output' },
];

export function CommandBar() {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    addCommand, 
    clearCommands, 
    addToWatchlist, 
    removeFromWatchlist, 
    panels, 
    togglePanel 
  } = useTerminalStore();
  
  const { addAlert } = useAlertStore();

  // Filter suggestions
  const suggestions = useMemo(() => {
    if (!input.startsWith('/') || input.includes(' ')) return [];
    const filtered = COMMANDS.filter(c => c.cmd.startsWith(input.toLowerCase()));
    return filtered;
  }, [input]);

  // Reset selected index when input changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [input]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim();
    setInput('');
    setSelectedIndex(0);

    try {
      const { data } = await commandApi.execute(cmd);
      
      // Handle special client-side commands
      if (data.action === 'clear') {
        clearCommands();
        return;
      }

      if (data.action === 'watch' && data.data) {
        addToWatchlist(data.data.symbol, data.data.exchange);
      }

      if (data.action === 'unwatch' && data.data) {
        removeFromWatchlist(data.data.symbol, '');
      }

      if (data.action === 'chain' && data.data) {
        const optionPanel = panels.find(p => p.id === 'optionchain');
        if (optionPanel && !optionPanel.visible) {
          togglePanel('optionchain');
        }
      }

      if (data.action === 'alert' && data.data) {
        addAlert({
          symbol: data.data.symbol,
          exchange: data.data.exchange,
          condition: data.data.condition,
          targetPrice: data.data.price,
          sound: true,
          repeat: false,
        });
      }

      if (data.action === 'export' && data.data) {
        const target = data.data.target;
        // This is a bit tricky as we need the data here.
        // For now, we'll just show a message that the user should use the panel buttons,
        // OR we can implement a basic version if we import hooks here.
        // Let's implement it for Orders and Trades as an example.
        addCommand({
          input: cmd,
          output: `Exporting ${target}... Use the Download icon in the corresponding panel for the full CSV.`,
          success: true,
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }

      addCommand({
        input: cmd,
        output: data.output,
        success: data.status === 'success',
        timestamp: new Date().toLocaleTimeString()
      });

    } catch (error) {
      addCommand({
        input: cmd,
        output: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        setInput(suggestions[selectedIndex].cmd + ' ');
        setSelectedIndex(0);
        return;
      }
    }
    
    // Escape to blur and hide suggestions
    if (e.key === 'Escape') {
      inputRef.current?.blur();
      setIsFocused(false);
    }
  };

  return (
    <div className="p-2 bg-[#08080d] border-t border-[#1e1e30] shrink-0">
      <div className="relative max-w-4xl mx-auto">
        {/* Autocomplete Dropdown */}
        {isFocused && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 w-full bg-[#0e0e16] border border-[#2a2a42] rounded-sm mb-1 py-1 z-[100] shadow-2xl max-h-[220px] overflow-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-1 text-[9px] text-zinc-600 font-bold uppercase tracking-widest border-b border-[#1e1e30] mb-1 flex justify-between">
              <span>Suggestions (↑↓ to navigate, Enter to accept)</span>
              <span>{selectedIndex + 1} / {suggestions.length}</span>
            </div>
            {suggestions.map((s, i) => (
              <div
                key={s.cmd}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                  i === selectedIndex ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500' : 'hover:bg-[#1e1e30] text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => {
                  setInput(s.cmd + ' ');
                  inputRef.current?.focus();
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold">{s.cmd}</span>
                  <span className="text-[10px] opacity-60 italic">{s.hint}</span>
                </div>
                <span className="text-[9px] opacity-50 uppercase font-bold tracking-tighter">{s.desc}</span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative group">
          <div className={`absolute inset-0 bg-emerald-500/5 rounded transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`} />
          
          <div className={`flex items-center gap-3 px-3 h-8 bg-[#0a0a12] border transition-all duration-200 ${
            isFocused ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'border-[#1e1e30] group-hover:border-[#2a2a42]'
          }`}>
            <Terminal size={14} className={isFocused ? 'text-emerald-400' : 'text-zinc-500'} />
            
            <input
              ref={inputRef}
              data-command-input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleKeyDown}
              placeholder='Type /help for commands...'
              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none font-mono"
            />

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-zinc-600 font-bold px-1.5 py-0.5 border border-[#1e1e30] rounded">/</span>
              <button 
                type="submit" 
                className={`p-1 rounded transition-colors ${
                  input.trim() ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-zinc-700'
                }`}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
