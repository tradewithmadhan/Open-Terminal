// ─── Core Enums ─────────────────────────────────────
export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'CDS' | 'BCD' | 'MCX' | 'NSE_INDEX' | 'BSE_INDEX';
export type ProductType = 'MIS' | 'CNC' | 'NRML';
export type PriceType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type Action = 'BUY' | 'SELL';
export type OrderStatus = 'complete' | 'open' | 'pending' | 'rejected' | 'cancelled';

// ─── Market Data ────────────────────────────────────
export interface QuoteData {
  ltp: number;
  bid: number;
  ask: number;
  volume: number;
  oi: number;
}

export interface WatchlistItem {
  symbol: string;
  exchange: Exchange;
  ltp: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  oi: number;
}

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface MarketDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
  ltp: number;
  totalbuyqty: number;
  totalsellqty: number;
}

export interface HistoryCandle {
  timestamp: number;  // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Orders ─────────────────────────────────────────
export interface OrderData {
  orderid: string;
  symbol: string;
  exchange: string;
  action: Action;
  quantity: string;
  price: number;
  trigger_price: number;
  pricetype: PriceType;
  product: ProductType;
  order_status: OrderStatus;
  average_price: number;
  timestamp: string;
}

// ─── Portfolio ──────────────────────────────────────
export interface PositionData {
  symbol: string;
  exchange: string;
  product: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
}

export interface FundsData {
  availablecash: number;
  collateral: number;
  m2mrealized: number;
  m2munrealized: number;
  utiliseddebits: number;
  totalMargin: number;
  usedPercent: number;
}

export interface HoldingData {
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  pnl: number;
}

// ─── Options ────────────────────────────────────────
export interface OptionLeg {
  symbol: string;
  label: string;
  ltp: number;
  bid: number;
  ask: number;
  volume: number;
  oi: number;
  lotsize: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionChainRow {
  strike: number;
  ce: OptionLeg;
  pe: OptionLeg;
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// ─── Connection ─────────────────────────────────────
export interface ConnectionStatus {
  api: 'online' | 'offline' | 'checking';
  websocket: 'connected' | 'disconnected' | 'connecting';
  mode: 'live' | 'paper';
  lastCheck: string;
}

// ─── Terminal ───────────────────────────────────────
export interface TerminalCommand {
  input: string;
  output: string;
  timestamp: string;
  success: boolean;
}

export interface PanelConfig {
  id: string;
  title: string;
  visible: boolean;
  minimized: boolean;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export type Layouts = Record<string, LayoutItem[]>;

// ─── Chart Settings ─────────────────────────────────
export interface IndicatorSettings {
  enabled: boolean;
  period: number;
  color: string;
}

export interface ChartSettings {
  showVolume: boolean;
  indicators: {
    sma: IndicatorSettings;
    ema: IndicatorSettings;
    cpr: IndicatorSettings;
  };
}

export interface BarData {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
