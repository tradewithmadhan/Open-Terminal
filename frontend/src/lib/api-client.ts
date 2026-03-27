import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Health ─────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/api/health'),
  getConfig: () => api.get('/api/config'),
  updateConfig: (data: { api_key?: string; host?: string; ws_url?: string }) =>
    api.post('/api/config', data),
  getAnalyzer: () => api.get('/api/analyzer'),
  toggleAnalyzer: (mode: boolean) => api.post(`/api/analyzer?mode=${mode}`),
};

// ─── Market Data ────────────────────────────────────
export const marketApi = {
  quote: (symbol: string, exchange: string) =>
    api.post('/api/market/quotes', { symbol, exchange }),
  multiQuote: (symbols: Array<{ symbol: string; exchange: string }>) =>
    api.post('/api/market/multiquotes', { symbols }),
  depth: (symbol: string, exchange: string) =>
    api.post('/api/market/depth', { symbol, exchange }),
  history: (symbol: string, exchange: string, interval: string, start_date: string, end_date: string) =>
    api.post('/api/market/history', { symbol, exchange, interval, start_date, end_date }),
};

// ─── Orders ─────────────────────────────────────────
export const orderApi = {
  place: (data: {
    symbol: string; action: 'BUY' | 'SELL'; exchange: string;
    pricetype: string; product: string; quantity: string;
    price?: string; trigger_price?: string; strategy?: string;
  }) => api.post('/api/orders/place', { strategy: 'TERMINAL', ...data }),

  modify: (data: {
    orderid: string; symbol: string; action: string; exchange: string;
    pricetype: string; product: string; quantity: string; price: string;
    trigger_price?: string;
  }) => api.post('/api/orders/modify', data),

  cancel: (orderid: string, strategy?: string) =>
    api.post('/api/orders/cancel', { orderid, strategy }),
  cancelAll: (strategy?: string) =>
    api.post('/api/orders/cancel-all', { strategy }),
  closeAll: (strategy?: string) =>
    api.post('/api/orders/close-all', { strategy }),
  status: (orderid: string) =>
    api.post(`/api/orders/status?orderid=${orderid}`),
};

// ─── Portfolio ──────────────────────────────────────
export const portfolioApi = {
  funds: () => api.get('/api/portfolio/funds'),
  positions: () => api.get('/api/portfolio/positions'),
  orderbook: () => api.get('/api/portfolio/orderbook'),
  tradebook: () => api.get('/api/portfolio/tradebook'),
  holdings: () => api.get('/api/portfolio/holdings'),
  margin: (positions: any[]) => api.post('/api/portfolio/margin', positions),
};

// ─── Options ────────────────────────────────────────
export const optionsApi = {
  chain: (underlying: string, exchange: string, expiry_date: string, strike_count?: number) =>
    api.post('/api/options/chain', { underlying, exchange, expiry_date, strike_count }),
  greeks: (symbol: string, exchange: string, extras?: Record<string, any>) =>
    api.post('/api/options/greeks', { symbol, exchange, ...extras }),
  expiry: (symbol: string, exchange: string, instrument_type: string) =>
    api.post('/api/options/expiry', { symbol, exchange, instrument_type }),
  symbol: (underlying: string, exchange: string, expiry_date: string, option_type: string, offset: string) =>
    api.post('/api/options/symbol', { underlying, exchange, expiry_date, option_type, offset }),
};

// ─── Command ────────────────────────────────────────
export const commandApi = {
  execute: (command: string) => api.post('/api/command/execute', { command }),
};
