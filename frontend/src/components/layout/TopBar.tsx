'use client';

import { 
  Zap, Settings, Wifi, WifiOff, LayoutGrid, ChevronDown, 
  Lock, Unlock, Plus, Trash2, Edit3, Save, Maximize, Minimize 
} from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { formatDate, formatTime } from '@/lib/formatters';
import { showToast } from '@/components/common/ToastManager';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function TopBar() {
  const { 
    connection, 
    panels, 
    togglePanel, 
    isEditMode, 
    toggleEditMode,
    isAutosaveEnabled,
    toggleAutosave,
    commitLayout,
    savedLayouts,
    activeLayoutName,
    setActiveLayoutName,
    saveLayout,
    createLayout,
    deleteLayout,
    resetLayout,
    pendingLayouts,
    maximizedPanelId,
    setMaximizedPanel,
    lastTickAt
  } = useTerminalStore();
  
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [showPanelMenu, setShowPanelMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isCreateBlank, setIsCreateBlank] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTickPulsing, setIsTickPulsing] = useState(false);
  
  // Tick pulse effect
  useEffect(() => {
    if (lastTickAt === 0) return;
    setIsTickPulsing(true);
    const timer = setTimeout(() => setIsTickPulsing(false), 150);
    return () => clearTimeout(timer);
  }, [lastTickAt]);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setTime(new Date()), 1000);

    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      clearInterval(t);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const toggleBrowserFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showToast('error', 'Fullscreen Error', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Close menus on click outside
  useEffect(() => {
    if (!showPanelMenu && !showLayoutMenu) return;
    const handle = () => {
      setShowPanelMenu(false);
      setShowLayoutMenu(false);
    };
    window.addEventListener('click', handle);
    return () => window.removeEventListener('click', handle);
  }, [showPanelMenu, showLayoutMenu]);

  const handleSaveLayout = () => {
    if (!newLayoutName.trim()) {
      showToast('error', 'Invalid Name', 'Please enter a name for the layout');
      return;
    }
    if (newLayoutName.trim().toLowerCase() === 'default') {
      showToast('error', 'Reserved Name', 'The name "Default" is reserved. Please choose another name.');
      return;
    }
    
    createLayout(newLayoutName.trim(), { isBlank: isCreateBlank });
    setNewLayoutName('');
    setIsCreateBlank(false);
    setShowLayoutMenu(false);
    showToast('success', 'Layout Created', `Workspace "${newLayoutName}" is ready`);
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-between px-4 h-9 bg-[#08080d] border-b border-[#1e1e30] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Zap size={14} className="text-emerald-400" />
          <span className="text-sm font-bold tracking-wider text-emerald-400">OPEN-TERMINAL</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 h-9 bg-[#08080d] border-b border-[#1e1e30] shrink-0 select-none">
      {/* Left */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer group" title="Home (Alt+H)">
          <Zap size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-bold tracking-wider text-emerald-400">OPEN-TERMINAL</span>
        </Link>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded animate-pulse ${
          connection.mode === 'live'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {connection.mode === 'live' ? '● LIVE' : '◉ PAPER'}
        </span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 mr-4">
          <span className="text-zinc-500">{formatDate(time)}</span>
          <span className="text-zinc-200 font-bold text-sm tabular-nums">{formatTime(time)}</span>
        </div>

        {/* Layout Selector */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLayoutMenu(!showLayoutMenu);
            }}
            className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium transition-colors rounded ${
              showLayoutMenu ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid size={12} />
            <span className="max-w-[80px] truncate">{activeLayoutName}</span>
            <ChevronDown size={10} className={`transition-transform duration-200 ${showLayoutMenu ? 'rotate-180' : ''}`} />
          </button>

          {showLayoutMenu && (
            <div
              className="absolute top-full left-0 mt-1 bg-[#0e0e16] border border-[#2a2a42] rounded-sm py-1 w-[220px] z-[100] shadow-2xl animate-in fade-in zoom-in duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1.5 text-[9px] text-zinc-600 font-bold uppercase tracking-widest border-b border-[#1e1e30] mb-1">
                Layout Profiles
              </div>
              
              <button
                onClick={() => { setActiveLayoutName('Default'); setShowLayoutMenu(false); }}
                className={`flex items-center justify-between w-full px-3 py-2 text-[11px] hover:bg-[#1e1e30] transition-colors ${activeLayoutName === 'Default' ? 'text-emerald-400' : 'text-zinc-400'}`}
              >
                Default
              </button>

               {Object.keys(savedLayouts)
                .filter(name => name.toLowerCase() !== 'default')
                .map(name => (
                  <div key={name} className="flex items-center group/item">
                    <button
                      onClick={() => { setActiveLayoutName(name); setShowLayoutMenu(false); }}
                      className={`flex-1 flex items-center px-3 py-2 text-[11px] hover:bg-[#1e1e30] transition-colors ${activeLayoutName === name ? 'text-emerald-400' : 'text-zinc-400'}`}
                    >
                      {name}
                    </button>
                    <button 
                      onClick={() => { deleteLayout(name); showToast('info', 'Layout Deleted', name); }}
                      className="p-2 text-zinc-700 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}

              <div className="border-t border-[#1e1e30] mt-1 space-y-0.5">
                <button
                  onClick={() => {
                    resetLayout(activeLayoutName);
                    setShowLayoutMenu(false);
                    showToast('info', 'Layout Reset', `"${activeLayoutName}" restored to default`);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[10px] text-zinc-500 hover:bg-[#1e1e30] hover:text-amber-400 transition-colors"
                >
                  <Trash2 size={10} />
                  RESET TO DEFAULT
                </button>
              </div>

              <div className="border-t border-[#1e1e30] mt-1 p-2 space-y-2">
                <input 
                  type="text" 
                  placeholder="New Layout Name..."
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  className="w-full bg-[#08080d] border border-[#2a2a42] rounded-sm px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-[#448aff]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLayout()}
                />
                <label className="flex items-center gap-2 px-1 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={isCreateBlank}
                    onChange={(e) => setIsCreateBlank(e.target.checked)}
                    className="w-3 h-3 rounded border-[#2a2a42] bg-[#08080d] text-emerald-500 focus:ring-0 focus:ring-offset-0 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">Start from Blank</span>
                </label>
                <button 
                  onClick={handleSaveLayout}
                  className="w-full flex items-center justify-center gap-1.5 py-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20"
                >
                  <Plus size={10} />
                  SAVE AS NEW
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Panel Toggle */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPanelMenu(!showPanelMenu);
            }}
            className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium transition-colors rounded ${
              showPanelMenu ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Plus size={12} />
            <span>Add Panel</span>
          </button>

          {showPanelMenu && (
            <div
              className="absolute top-full left-0 mt-1 bg-[#0e0e16] border border-[#2a2a42] rounded-sm py-1 w-[200px] z-[100] shadow-2xl animate-in fade-in zoom-in duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1.5 text-[9px] text-zinc-600 font-bold uppercase tracking-widest border-b border-[#1e1e30] mb-1">
                Workspace Panels
              </div>
              {panels.map(panel => (
                <button
                  key={panel.id}
                  onClick={() => togglePanel(panel.id)}
                  className="flex items-center justify-between w-full px-3 py-2 text-[11px] hover:bg-[#1e1e30] transition-colors group"
                >
                  <span className={panel.visible ? 'text-zinc-200' : 'text-zinc-500'}>
                    {panel.title}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    panel.visible ? 'bg-emerald-400 shadow-[0_0_5px_rgba(0,230,118,0.5)]' : 'bg-zinc-800'
                  }`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Edit Mode Controls */}
        {isEditMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutosave}
              className={`flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded transition-colors ${
                isAutosaveEnabled ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-zinc-600 bg-zinc-900 border border-zinc-800'
              }`}
              title="Toggle Autosave"
            >
              AUTOSAVE: {isAutosaveEnabled ? 'ON' : 'OFF'}
            </button>

            {!isAutosaveEnabled && (
              <>
                <button
                  onClick={() => {
                    commitLayout();
                    showToast('success', 'Layout Saved', `Layout "${activeLayoutName}" updated`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                >
                  <Save size={11} />
                  SAVE
                </button>
                <button
                  onClick={() => {
                    toggleEditMode();
                    showToast('info', 'Changes Discarded', 'Layout reverted to last save');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 transition-all"
                >
                  <Trash2 size={11} />
                  CANCEL
                </button>
              </>
            )}

            {isAutosaveEnabled && (
              <button
                onClick={toggleEditMode}
                className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                title="Lock Layout"
              >
                <Unlock size={11} />
                DONE
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={toggleEditMode}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded bg-[#1e1e30] border border-[#2a2a42] text-zinc-500 hover:text-zinc-300 transition-all"
            title="Unlock Layout for editing"
          >
            <Edit3 size={11} />
            EDIT LAYOUT
          </button>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {/* ... connection indicators ... */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] ${connection.api === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>API</span>
          <div className={`w-1.5 h-1.5 rounded-full ${
            connection.api === 'online' ? 'bg-emerald-400 shadow-[0_0_4px_rgba(0,230,118,0.5)]'
            : connection.api === 'checking' ? 'bg-amber-400 animate-pulse'
            : 'bg-red-400'
          }`} />
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e1e30]/30 border border-[#1e1e30] border-dashed">
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
            isTickPulsing ? 'bg-emerald-400 scale-125 shadow-[0_0_8px_rgba(0,230,118,0.8)]' : 'bg-zinc-800'
          }`} />
          <span className="text-[9px] text-zinc-600 font-bold tabular-nums">LIVE TICK</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] ${connection.websocket === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>WS</span>
          {connection.websocket === 'connected'
            ? <Wifi size={11} className={`transition-all duration-75 ${isTickPulsing ? 'text-emerald-400 scale-110' : 'text-emerald-500/40'}`} />
            : <WifiOff size={11} className={connection.websocket === 'connecting' ? 'text-amber-400 animate-pulse' : 'text-red-400'} />
          }
        </div>
        {/* Browser Fullscreen Toggle */}
        <button
          onClick={toggleBrowserFullScreen}
          className="p-1 hover:bg-[#1e1e30] rounded transition-colors group"
          title={isFullscreen ? "Exit Fullscreen (F11)" : "Enter Fullscreen (F11)"}
        >
          {isFullscreen 
            ? <Minimize size={13} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" /> 
            : <Maximize size={13} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          }
        </button>

        <Link 
          href="/settings" 
          className="p-1 hover:bg-[#1e1e30] rounded transition-colors group"
          title="Settings (Alt+S)"
        >
          <Settings size={13} className="text-zinc-500 group-hover:text-zinc-300 group-hover:rotate-45 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
