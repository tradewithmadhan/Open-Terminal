'use client';

import { ReactNode } from 'react';
import { GripVertical, Minus, X, Maximize2 } from 'lucide-react';

interface PanelWrapperProps {
  title: string;
  children: ReactNode;
  minimized?: boolean;
  maximized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  headerExtra?: ReactNode;
  className?: string;
  draggable?: boolean;
}

export function PanelWrapper({
  title, children, minimized = false, maximized = false,
  onMinimize, onMaximize, onClose, headerExtra, className = '',
  draggable = false,
}: PanelWrapperProps) {
  return (
    <div className={`flex flex-col h-full bg-[#0e0e16] border border-[#1e1e30] rounded-sm overflow-hidden ${className} ${maximized ? 'border-emerald-500/30' : ''}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-2 h-7 bg-[#0a0a12] border-b border-[#1e1e30] shrink-0 ${draggable ? 'panel-drag-handle cursor-move' : ''}`}>
        <div className="flex items-center gap-1">
          {draggable && !maximized && <GripVertical size={10} className="text-[#2a2a42]" />}
          <span className={`text-[10px] font-semibold tracking-[0.15em] uppercase select-none ${maximized ? 'text-emerald-400' : 'text-[#4a4a60]'}`}>
            {title} {maximized ? '(FULL SCREEN)' : ''}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {headerExtra}
          {onMaximize && !minimized && (
            <button 
              onClick={onMaximize} 
              className={`p-1 rounded transition-colors ${maximized ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-[#1e1e30] text-[#4a4a60]'}`}
              title={maximized ? "Restore" : "Full Screen"}
            >
              <Maximize2 size={10} />
            </button>
          )}
          {onMinimize && !maximized && (
            <button onClick={onMinimize} className="p-1 hover:bg-[#1e1e30] rounded transition-colors" title="Minimize">
              <Minus size={10} className="text-[#4a4a60]" />
            </button>
          )}
          {onClose && !maximized && (
            <button onClick={onClose} className="p-1 hover:bg-red-500/20 rounded transition-colors" title="Close">
              <X size={10} className="text-[#4a4a60] hover:text-red-400" />
            </button>
          )}
          {maximized && onMaximize && (
             <button onClick={onMaximize} className="p-1 hover:bg-[#1e1e30] rounded transition-colors" title="Close Full Screen">
               <X size={10} className="text-[#4a4a60]" />
             </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!minimized && <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</div>}
    </div>
  );
}
