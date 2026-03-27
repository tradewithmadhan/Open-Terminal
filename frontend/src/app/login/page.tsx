'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ArrowRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { healthApi } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [host, setHost] = useState('http://127.0.0.1:5000');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setMessage('Please enter your API key');
      setStatus('error');
      return;
    }

    setStatus('testing');
    setMessage('Testing connection...');

    try {
      const { data } = await healthApi.updateConfig({
        api_key: apiKey.trim(),
        host: host.trim(),
      });

      if (data.status === 'success') {
        setStatus('success');
        setMessage('Connected! Redirecting...');
        setTimeout(() => router.push('/'), 1500);
      } else {
        setStatus('error');
        setMessage(data.message || 'Connection failed');
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setStatus('error');
      setMessage(error.response?.data?.message || 'Cannot reach terminal backend. Is it running on port 8000?');
    }
  };

  return (
    <div className="h-screen w-screen bg-[#08080d] flex items-center justify-center">
      <div className="w-[420px] space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap size={24} className="text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-wider text-emerald-400">OPEN-TERMINAL</h1>
          </div>
          <p className="text-zinc-600 text-sm">Connect to your OpenAlgo instance</p>
        </div>

        {/* Form */}
        <div className="space-y-4 bg-[#0e0e16] border border-[#1e1e30] rounded-sm p-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">OpenAlgo Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full bg-[#08080d] border border-[#2a2a42] rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#448aff] transition-colors"
              placeholder="http://127.0.0.1:5000"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              className="w-full bg-[#08080d] border border-[#2a2a42] rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#448aff] transition-colors"
              placeholder="Enter your OpenAlgo API key"
              autoFocus
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={status === 'testing'}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 py-2.5 rounded-sm text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {status === 'testing' ? (
              <><Loader2 size={14} className="animate-spin" /> Testing...</>
            ) : (
              <><ArrowRight size={14} /> Connect</>
            )}
          </button>

          {/* Status message */}
          {message && (
            <div className={`flex items-center gap-2 text-xs ${
              status === 'success' ? 'text-emerald-400' :
              status === 'error' ? 'text-red-400' : 'text-zinc-400'
            }`}>
              {status === 'success' && <CheckCircle size={12} />}
              {status === 'error' && <XCircle size={12} />}
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-zinc-700">
          Make sure OpenAlgo is running before connecting
        </p>
      </div>
    </div>
  );
}
