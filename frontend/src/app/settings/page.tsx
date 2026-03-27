'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { CommandBar } from '@/components/layout/CommandBar';
import { ToastManager, showToast } from '@/components/common/ToastManager';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { healthApi } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Settings as SettingsIcon, 
  Terminal, 
  Bell, 
  Database, 
  Monitor, 
  ChevronRight,
  Save,
  RotateCcw,
  Loader2,
  ChevronLeft,
  Download,
  Upload,
  FileJson
} from 'lucide-react';

export default function SettingsPage() {
  const { defaults, setDefaults, updateLotSize } = useTerminalStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('api');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // States
  const [apiConfig, setApiConfig] = useState({ host: '', api_key: '' });
  const [tradingConfig, setTradingConfig] = useState({
    strategy: defaults?.strategy || 'TERMINAL',
    quantity: defaults?.quantity || '1',
    product: defaults?.product || 'MIS',
    pricetype: defaults?.pricetype || 'MARKET',
    autoConfirm: defaults?.autoConfirm || false,
  });

  // Sync state if defaults change after hydration
  useEffect(() => {
    if (defaults) {
      setTradingConfig(prev => ({
        ...prev,
        strategy: defaults.strategy || prev.strategy,
        quantity: defaults.quantity || prev.quantity,
        product: defaults.product || prev.product,
        pricetype: defaults.pricetype || prev.pricetype,
        autoConfirm: defaults.autoConfirm !== undefined ? defaults.autoConfirm : prev.autoConfirm
      }));
    }
  }, [defaults]);

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const { data } = await healthApi.getConfig();
        setApiConfig({ host: data.host || 'http://127.0.0.1:8000', api_key: '' });
      } catch (err) {
        console.error('Failed to fetch config', err);
      }
      setIsLoading(false);
    };
    fetchConfig();
  }, []);

  // Back shortcut (Alt+B)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    if (activeTab === 'api') {
      try {
        const { data } = await healthApi.updateConfig({ 
          host: apiConfig.host, 
          // only send api_key if user typed something
          ...(apiConfig.api_key.trim() ? { api_key: apiConfig.api_key } : {})
        });
        if (data.status === 'success') {
          showToast('success', 'API Updated', data.message || 'Connected correctly');
        } else {
          showToast('error', 'API Error', data.message || 'Failed to connect');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showToast('error', 'API Update Failed', errorMsg);
      }
    } else if (activeTab === 'trading') {
      setDefaults({
        strategy: tradingConfig.strategy,
        quantity: tradingConfig.quantity,
        product: tradingConfig.product,
        pricetype: tradingConfig.pricetype,
        autoConfirm: tradingConfig.autoConfirm,
      });
      showToast('success', 'Settings Saved', 'Trading defaults updated');
    } else {
      showToast('info', 'Settings Saved', 'Preferences saved');
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    if (activeTab === 'trading') {
      setTradingConfig({
        strategy: defaults?.strategy || 'TERMINAL',
        quantity: defaults?.quantity || '1',
        product: defaults?.product || 'MIS',
        pricetype: defaults?.pricetype || 'MARKET',
        autoConfirm: defaults?.autoConfirm || false,
      });
    } else if (activeTab === 'api') {
      setApiConfig({ ...apiConfig, api_key: '' });
    }
    showToast('info', 'Settings Reset', 'Modifications reverted');
  };
  
  const handleExportData = () => {
    try {
      const state = useTerminalStore.getState();
      const exportData = {
        version: 1.0,
        timestamp: new Date().toISOString(),
        watchlist: state.watchlist,
        watchlistGroups: state.watchlistGroups,
        savedLayouts: state.savedLayouts,
        savedPanels: state.savedPanels,
        defaults: state.defaults,
        chartSettings: state.chartSettings
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openterminal_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Backup Created', 'Configuration downloaded successfully');
    } catch {
      showToast('error', 'Export Failed', 'See console for details');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.watchlist || !data.savedLayouts) {
          throw new Error('Invalid backup file format');
        }
        
        // Use a partial set to avoid nuking everything if format slightly differs
        useTerminalStore.setState({
          watchlist: data.watchlist || [],
          watchlistGroups: data.watchlistGroups || [],
          savedLayouts: data.savedLayouts || {},
          savedPanels: data.savedPanels || {},
          defaults: data.defaults || state.defaults,
          chartSettings: data.chartSettings || state.chartSettings
        });
        
        showToast('success', 'Import Successful', 'Configuration restored. Refresh may be required.');
        setTimeout(() => window.location.reload(), 2000);
      } catch (err: any) {
        showToast('error', 'Import Failed', err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#08080d] text-zinc-200 overflow-hidden">
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-64 border-r border-[#1e1e30] flex flex-col shrink-0 bg-[#0a0a12]/50">
          <div className="p-4 border-b border-[#1e1e30] space-y-4">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-2 py-1.5 w-full rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all group"
            >
              <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              BACK TO TERMINAL
            </button>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white uppercase flex items-center gap-2">
                <SettingsIcon size={14} className="text-emerald-400" />
                Settings
              </h1>
              <p className="text-[10px] text-zinc-500 mt-0.5">Manage terminal preferences</p>
            </div>
          </div>
          
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            <SettingsTab 
              icon={<Shield size={14} />} 
              label="API Credentials" 
              active={activeTab === 'api'} 
              onClick={() => setActiveTab('api')} 
            />
            <SettingsTab 
              icon={<Terminal size={14} />} 
              label="Trading Defaults" 
              active={activeTab === 'trading'} 
              onClick={() => setActiveTab('trading')} 
            />
            <SettingsTab 
              icon={<Monitor size={14} />} 
              label="UI Customization" 
              active={activeTab === 'ui'} 
              onClick={() => setActiveTab('ui')} 
            />
            <SettingsTab 
              icon={<Bell size={14} />} 
              label="Notifications" 
              active={activeTab === 'notif'} 
              onClick={() => setActiveTab('notif')} 
            />
            <SettingsTab 
              icon={<Database size={14} />} 
              label="Data Storage" 
              active={activeTab === 'data'} 
              onClick={() => setActiveTab('data')} 
            />
          </nav>

          <div className="p-4 mt-auto border-t border-[#1e1e30]">
            <div className="flex gap-2">
              <button 
                onClick={handleReset}
                disabled={isSaving || isLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#1e1e30] border border-[#2a2a42] text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
                RESET
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="flex-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                SAVE
              </button>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto bg-[#08080d] p-8">
          <div key={activeTab} className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {activeTab === 'api' && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#1e1e30] pb-2">
                  <Shield size={18} className="text-emerald-400" />
                  <h2 className="text-base font-bold">API Configuration</h2>
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <Loader2 size={16} className="animate-spin" /> Loading configuration...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">API Host</label>
                      <input 
                        type="text" 
                        value={apiConfig.host}
                        onChange={(e) => setApiConfig({ ...apiConfig, host: e.target.value })}
                        className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/50" 
                      />
                      <p className="text-[9px] text-zinc-600">The base URL for OpenAlgo API calls</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">API Key</label>
                      <input 
                        type="password" 
                        placeholder="••••••••••••••••"
                        value={apiConfig.api_key}
                        onChange={(e) => setApiConfig({ ...apiConfig, api_key: e.target.value })}
                        className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/50" 
                      />
                      <p className="text-[9px] text-zinc-600">Provide a new key to update, or leave blank to keep current</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'trading' && (
              <section className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#1e1e30] pb-2">
                    <Terminal size={18} className="text-emerald-400" />
                    <h2 className="text-base font-bold">Trading Defaults</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Default Strategy Tag</label>
                      <input 
                        type="text" 
                        value={tradingConfig.strategy}
                        onChange={(e) => setTradingConfig({ ...tradingConfig, strategy: e.target.value.toUpperCase() })}
                        className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#448aff]" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Default Quantity (Multiplier)</label>
                      <input 
                        type="number" 
                        value={tradingConfig.quantity}
                        onChange={(e) => setTradingConfig({ ...tradingConfig, quantity: e.target.value })}
                        className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#448aff]" 
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Default Product</label>
                       <select 
                         value={tradingConfig.product}
                         onChange={(e) => setTradingConfig({ ...tradingConfig, product: e.target.value })}
                         className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#448aff]"
                       >
                         <option value="MIS">MIS (Intraday)</option>
                         <option value="NRML">NRML (Positional)</option>
                         <option value="CNC">CNC (Delivery)</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Default Price Type</label>
                       <select 
                         value={tradingConfig.pricetype}
                         onChange={(e) => setTradingConfig({ ...tradingConfig, pricetype: e.target.value })}
                         className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#448aff]"
                       >
                         <option value="MARKET">MARKET</option>
                         <option value="LIMIT">LIMIT</option>
                         <option value="SL-M">SL-MARKET</option>
                         <option value="SL">SL-LIMIT</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Auto-Confirm Orders</label>
                      <div className="flex items-center h-9">
                        <button 
                          onClick={() => setTradingConfig({ ...tradingConfig, autoConfirm: !tradingConfig.autoConfirm })}
                          className={`w-8 h-4 rounded-full relative transition-colors ${tradingConfig.autoConfirm ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${tradingConfig.autoConfirm ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                        <span className="ml-2 text-[11px] text-zinc-400">{tradingConfig.autoConfirm ? 'Enabled (No Confirmation)' : 'Disabled (Require Confirmation)'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 border-b border-[#1e1e30] pb-2">
                    <Database size={18} className="text-emerald-400" />
                    <h2 className="text-base font-bold">Index Lot Sizes</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(defaults.lotSizes || {
                      'NIFTY': 25,
                      'BANKNIFTY': 15,
                      'FINNIFTY': 25,
                      'MIDCPNIFTY': 50,
                      'SENSEX': 10,
                      'BANKEX': 15
                    }).map(([index, size]) => (
                      <div key={index} className="space-y-1.5 p-3 rounded bg-[#0e0e16] border border-[#1e1e30]">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">{index}</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={size}
                            onChange={(e) => updateLotSize(index, parseInt(e.target.value) || 0)}
                            className="w-full bg-[#08080d] border border-[#2a2a42] rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[#448aff]" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">These values are used to calculate total quantity in Strategy Builder and Order forms.</p>
                </div>
              </section>
            )}

            {activeTab === 'ui' && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#1e1e30] pb-2">
                  <Monitor size={18} className="text-emerald-400" />
                  <h2 className="text-base font-bold">UI Customization</h2>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Theme</label>
                    <select className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#448aff]">
                      <option>Night Market (Dark)</option>
                      <option disabled>Light Theme (Coming Soon)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Price Format</label>
                    <select className="w-full bg-[#0e0e16] border border-[#2a2a42] rounded px-3 py-2 text-xs text-zinc-200 outline-none focus:border-[#448aff]">
                      <option>2 Decimals (0.00)</option>
                      <option disabled>4 Decimals (0.0000) - Coming Soon</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'notif' && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#1e1e30] pb-2">
                  <Bell size={18} className="text-emerald-400" />
                  <h2 className="text-base font-bold">Notifications</h2>
                </div>
                <div className="flex flex-col items-center justify-center p-12 text-zinc-500 bg-[#0e0e16]/50 rounded border border-[#1e1e30] border-dashed">
                  <Bell size={32} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">Notification Settings</p>
                  <p className="text-xs mt-1">Coming in OpenTerminal v1.1</p>
                </div>
              </section>
            )}

            {activeTab === 'data' && (
              <section className="space-y-6">
                <div className="flex items-center gap-2 border-b border-[#1e1e30] pb-2">
                  <Database size={18} className="text-emerald-400" />
                  <h2 className="text-base font-bold">Data Management</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-[#0e0e16] border border-[#1e1e30] rounded-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded">
                        <Download size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Export Configuration</h3>
                        <p className="text-[10px] text-zinc-500">Download all your settings, layouts and watchlists as a JSON file.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleExportData}
                      className="w-full py-2 bg-[#1e1e30] border border-[#2a2a42] text-[10px] text-zinc-300 rounded-sm hover:bg-[#252540] transition-colors flex items-center justify-center gap-2"
                    >
                      <FileJson size={14} />
                      GENERATE BACKUP (.JSON)
                    </button>
                  </div>

                  <div className="p-6 bg-[#0e0e16] border border-[#1e1e30] rounded-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded">
                        <Upload size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Import Configuration</h3>
                        <p className="text-[10px] text-zinc-500">Restore your terminal from a previously exported JSON backup.</p>
                      </div>
                    </div>
                    <label className="w-full py-2 bg-[#1e1e30] border border-[#2a2a42] text-[10px] text-zinc-300 rounded-sm hover:bg-[#252540] transition-colors flex items-center justify-center gap-2 cursor-pointer">
                      <Upload size={14} />
                      UPLOAD BACKUP FILE
                      <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-sm">
                  <p className="text-[10px] text-amber-200 leading-relaxed italic">
                    Note: Importing a configuration will overwrite your current settings, watchlists, and layouts. The application will automatically reload to apply changes.
                  </p>
                </div>
              </section>
            )}

          </div>
        </div>
      </div>

      <CommandBar />
      <ToastManager />
    </div>
  );
}

interface SettingsTabProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function SettingsTab({ icon, label, active, onClick }: SettingsTabProps) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-3 py-2 rounded-sm text-[11px] transition-all group
        ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1e1e30]'}
      `}
    >
      <div className="flex items-center gap-2.5">
        <span className={active ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400'}>{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <ChevronRight size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'opacity-100' : ''}`} />
    </button>
  );
}
