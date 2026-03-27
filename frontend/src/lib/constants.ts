export const EXCHANGES = [
  { value: 'NSE', label: 'NSE' },
  { value: 'BSE', label: 'BSE' },
  { value: 'NFO', label: 'NFO (F&O)' },
  { value: 'BFO', label: 'BFO' },
  { value: 'CDS', label: 'CDS (Currency)' },
  { value: 'MCX', label: 'MCX (Commodity)' },
  { value: 'NSE_INDEX', label: 'NSE Index' },
  { value: 'BSE_INDEX', label: 'BSE Index' },
] as const;

export const PRODUCTS = [
  { value: 'MIS', label: 'MIS (Intraday)' },
  { value: 'CNC', label: 'CNC (Delivery)' },
  { value: 'NRML', label: 'NRML (F&O Overnight)' },
] as const;

export const PRICE_TYPES = [
  { value: 'MARKET', label: 'Market' },
  { value: 'LIMIT', label: 'Limit' },
  { value: 'SL', label: 'Stop Loss' },
  { value: 'SL-M', label: 'SL-Market' },
] as const;

export const INTERVALS = [
  { value: '1m', label: '1 Min' },
  { value: '3m', label: '3 Min' },
  { value: '5m', label: '5 Min' },
  { value: '10m', label: '10 Min' },
  { value: '15m', label: '15 Min' },
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: 'D', label: 'Daily' },
  { value: 'W', label: 'Weekly' },
  { value: 'M', label: 'Monthly' },
] as const;

export const DEFAULT_WATCHLIST = [
  { symbol: 'NIFTY', exchange: 'NSE_INDEX' as const },
  { symbol: 'BANKNIFTY', exchange: 'NSE_INDEX' as const },
  { symbol: 'SENSEX', exchange: 'BSE_INDEX' as const },
  { symbol: 'RELIANCE', exchange: 'NSE' as const },
  { symbol: 'SBIN', exchange: 'NSE' as const },
  { symbol: 'TCS', exchange: 'NSE' as const },
  { symbol: 'INFY', exchange: 'NSE' as const },
  { symbol: 'HDFCBANK', exchange: 'NSE' as const },
];
