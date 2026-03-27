'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, WifiOff, HardDrive } from 'lucide-react';
import { 
  createChart, 
  ColorType, 
  CrosshairMode, 
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CandlestickData, 
  HistogramData,
  LineData,
  MouseEventParams,
  Time 
} from 'lightweight-charts';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { BarData } from '@/lib/types';
import { marketApi } from '@/lib/api-client';
import { formatPrice } from '@/lib/formatters';
import { calculateSMA, calculateEMA, calculateCPR } from '@/lib/indicators';
import { Settings, BarChart2, TrendingUp, ChevronDown, X } from 'lucide-react';

// Intervals to show in the toolbar
const CHART_INTERVALS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1H' },
  { value: 'D', label: 'D' },
  { value: 'W', label: 'W' },
];

// Calculate start date based on interval
function getStartDate(interval: string): string {
  const now = new Date();
  let daysBack = 5;
  switch (interval) {
    case '1m': case '3m': case '5m': daysBack = 5; break;
    case '10m': case '15m': case '30m': daysBack = 15; break;
    case '1h': daysBack = 30; break;
    case 'D': daysBack = 365; break;
    case 'W': daysBack = 730; break;
    case 'M': daysBack = 1825; break;
    default: daysBack = 5;
  }
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);
  return start.toISOString().split('T')[0];
}

function getEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface HistoryItem {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OHLCVData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// BarData is imported from lib/types

export function ChartPanel() {
  const { activeSymbol, watchlist, chartSettings, updateChartSettings, setChartHistory, getChartHistory, connection } = useTerminalStore();
  
  const [isShowingCached, setIsShowingCached] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const pivotSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const tcSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bcSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [interval, setInterval_] = useState('5m');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crosshairData, setCrosshairData] = useState<OHLCVData | null>(null);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  // Get live LTP from watchlist with fuzzy exchange matching
  const currentItem = watchlist.find(w => {
    const symMatch = w.symbol === activeSymbol?.symbol;
    if (!symMatch) return false;
    
    const uEx = activeSymbol?.exchange;
    const wEx = w.exchange;
    if (uEx === wEx) return true;
    if ((uEx === 'NSE' && wEx === 'NSE_INDEX') || (uEx === 'NSE_INDEX' && wEx === 'NSE')) return true;
    if ((uEx === 'BSE' && wEx === 'BSE_INDEX') || (uEx === 'BSE_INDEX' && wEx === 'BSE')) return true;
    
    return false;
  });

  // ─── Create chart ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0e0e16' },
        textColor: '#7a7a95',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: '#1e1e3033' },
        horzLines: { color: '#1e1e3033' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#448aff44', width: 1, labelBackgroundColor: '#1e1e30' },
        horzLine: { color: '#448aff44', width: 1, labelBackgroundColor: '#1e1e30' },
      },
      rightPriceScale: {
        borderColor: '#1e1e30',
        textColor: '#7a7a95',
      },
      timeScale: {
        borderColor: '#1e1e30',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff3d3d',
      borderUpColor: '#00e676',
      borderDownColor: '#ff3d3d',
      wickUpColor: '#00e67688',
      wickDownColor: '#ff3d3d88',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#448aff33',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay mode
    });
    
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const smaSeries = chart.addSeries(LineSeries, {
      color: chartSettings.indicators.sma.color,
      lineWidth: 2,
      visible: chartSettings.indicators.sma.enabled,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const emaSeries = chart.addSeries(LineSeries, {
      color: chartSettings.indicators.ema.color,
      lineWidth: 2,
      visible: chartSettings.indicators.ema.enabled,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const pivotSeries = chart.addSeries(LineSeries, {
      color: chartSettings.indicators?.cpr?.color || '#FF3D3D',
      lineWidth: 2,
      visible: chartSettings.indicators?.cpr?.enabled || false,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'Pivot',
    });

    const tcSeries = chart.addSeries(LineSeries, {
      color: chartSettings.indicators?.cpr?.color || '#FF3D3D',
      lineWidth: 1,
      visible: chartSettings.indicators?.cpr?.enabled || false,
      lastValueVisible: true,
      priceLineVisible: false,
      lineStyle: 2, // Dashed
      title: 'TC',
    });

    const bcSeries = chart.addSeries(LineSeries, {
      color: chartSettings.indicators?.cpr?.color || '#FF3D3D',
      lineWidth: 1,
      visible: chartSettings.indicators?.cpr?.enabled || false,
      lastValueVisible: true,
      priceLineVisible: false,
      lineStyle: 2, // Dashed
      title: 'BC',
    });

    // Crosshair subscriber
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.seriesData) {
        setCrosshairData(null);
        return;
      }
      const candleData = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (candleData) {
        const volData = param.seriesData.get(volumeSeries) as HistogramData | undefined;
        setCrosshairData({
          time: param.time,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value,
        });
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    smaSeriesRef.current = smaSeries;
    emaSeriesRef.current = emaSeries;
    pivotSeriesRef.current = pivotSeries;
    tcSeriesRef.current = tcSeries;
    bcSeriesRef.current = bcSeries;

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      pivotSeriesRef.current = null;
      tcSeriesRef.current = null;
      bcSeriesRef.current = null;
    };
  }, []);

  // Update series visibility when settings change
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: chartSettings.showVolume });
    }
    if (smaSeriesRef.current) {
      smaSeriesRef.current.applyOptions({ 
        visible: chartSettings.indicators.sma.enabled,
        color: chartSettings.indicators.sma.color 
      });
    }
    if (emaSeriesRef.current) {
      emaSeriesRef.current.applyOptions({ 
        visible: chartSettings.indicators.ema.enabled,
        color: chartSettings.indicators.ema.color 
      });
    }
    if (pivotSeriesRef.current) {
      pivotSeriesRef.current.applyOptions({ 
        visible: chartSettings.indicators?.cpr?.enabled || false,
        color: chartSettings.indicators?.cpr?.color || '#FF3D3D' 
      });
    }
    if (tcSeriesRef.current) {
      tcSeriesRef.current.applyOptions({ 
        visible: chartSettings.indicators?.cpr?.enabled || false,
        color: chartSettings.indicators?.cpr?.color || '#FF3D3D' 
      });
    }
    if (bcSeriesRef.current) {
      bcSeriesRef.current.applyOptions({ 
        visible: chartSettings.indicators?.cpr?.enabled || false,
        color: chartSettings.indicators?.cpr?.color || '#FF3D3D' 
      });
    }
  }, [chartSettings]);

  // ─── Fetch and update data ─────────────────────
  const fetchData = useCallback(async () => {
    if (!activeSymbol || !candleSeriesRef.current || !volumeSeriesRef.current || !smaSeriesRef.current || !emaSeriesRef.current || !pivotSeriesRef.current || !tcSeriesRef.current || !bcSeriesRef.current) return;

    const cacheKey = `${activeSymbol.symbol}:${activeSymbol.exchange}:${interval}`;
    
    // 1. Try cache first
    const cached = getChartHistory(cacheKey);
    if (cached && cached.length > 0) {
      const candles = cached.map(b => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close }));
      const volumes = cached.map(b => ({ 
        time: b.time as Time, 
        value: b.volume, 
        color: b.close >= b.open ? '#00e67625' : '#ff3d3d25' 
      }));
      
      candleSeriesRef.current.setData(candles);
      volumeSeriesRef.current.setData(volumes);
      
      // Indicators from cache
      const smaData = calculateSMA(cached as any, chartSettings.indicators.sma.period);
      const emaData = calculateEMA(cached as any, chartSettings.indicators.ema.period);
      smaSeriesRef.current.setData(smaData);
      emaSeriesRef.current.setData(emaData);
      
      const cprData = calculateCPR(cached as any);
      pivotSeriesRef.current.setData(cprData.pivot);
      tcSeriesRef.current.setData(cprData.tc);
      bcSeriesRef.current.setData(cprData.bc);

      setIsShowingCached(true);
      chartRef.current?.timeScale().fitContent();
    }

    // 2. Fresh fetch if online
    if (connection.isOffline) return;

    setIsLoading(true);
    setError(null);

    try {
      // For incremental loading, if we have cache, we could start from the last candle's date.
      // But we'll just use the regular getStartDate for now and let the merge handle it.
      // Optimization: use the date of the last candle as start_date
      let startDate = getStartDate(interval);
      if (cached && cached.length > 0) {
        const lastTs = cached[cached.length - 1].time;
        startDate = new Date(lastTs * 1000).toISOString().split('T')[0];
      }

      const { data } = await marketApi.history(
        activeSymbol.symbol,
        activeSymbol.exchange,
        interval,
        startDate,
        getEndDate()
      );

      if (data.status === 'success' && data.data) {
        const newBars = data.data.map((item: any) => {
          let ts = item.timestamp || item.time || item.date;
          if (typeof ts === 'string') ts = Math.floor(new Date(ts).getTime() / 1000);
          if (ts > 1000000000000) ts = Math.floor(ts / 1000);
          return {
            time: ts,
            open: Number(item.open || item.into || 0),
            high: Number(item.high || item.inth || 0),
            low: Number(item.low || item.intl || 0),
            close: Number(item.close || item.intc || 0),
            volume: Number(item.volume || item.intv || item.v || 0),
          };
        }).filter((d: any) => !isNaN(d.time) && d.open > 0);

        // Merge and sort
        const mergedBars = mergeBarArrays(cached || [], newBars);
        
        const candles: CandlestickData[] = [];
        const volumes: HistogramData[] = [];

        mergedBars.forEach((item: any) => {
          candles.push({
            time: item.time as Time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          });
          volumes.push({
            time: item.time as Time,
            value: item.volume,
            color: item.close >= item.open ? '#00e67625' : '#ff3d3d25',
          });
        });

        candleSeriesRef.current!.setData(candles);
        volumeSeriesRef.current!.setData(volumes);

        // Indicators
        const smaData = calculateSMA(mergedBars as any, chartSettings.indicators.sma.period);
        const emaData = calculateEMA(mergedBars as any, chartSettings.indicators.ema.period);
        smaSeriesRef.current!.setData(smaData);
        emaSeriesRef.current!.setData(emaData);

        const cprData = calculateCPR(mergedBars as any);
        pivotSeriesRef.current!.setData(cprData.pivot);
        tcSeriesRef.current!.setData(cprData.tc);
        bcSeriesRef.current!.setData(cprData.bc);

        // Persist to cache
        setChartHistory(cacheKey, mergedBars);
        setIsShowingCached(false);
        setLastFetchedAt(Date.now());
        
        if (!cached || cached.length === 0) {
          chartRef.current?.timeScale().fitContent();
        }
      } else if (!cached || cached.length === 0) {
        setError('No data available');
      }
    } catch (err: any) {
      console.error('Chart fetch error:', err);
      if (!cached || cached.length === 0) {
        setError('Failed to load chart data');
      }
    }

    setIsLoading(false);
  }, [activeSymbol?.symbol, activeSymbol?.exchange, interval, chartSettings.indicators.sma.period, chartSettings.indicators.ema.period, connection.isOffline, getChartHistory, setChartHistory]);

  // Fetch on symbol or interval change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh for intraday intervals
  useEffect(() => {
    if (['D', 'W', 'M'].includes(interval)) return;
    const timer = window.setInterval(fetchData, 60000);
    return () => window.clearInterval(timer);
  }, [fetchData, interval]);

  // ─── Format volume ─────────────────────────────
  const fmtVol = (v?: number) => {
    if (!v) return '—';
    if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return String(v);
  };

  // ─── Render ────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0e0e16]">
      {/* Chart header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e1e30] shrink-0">
        <div className="flex items-center gap-2">
          {activeSymbol ? (
            <>
              <span className="text-sm font-bold text-zinc-100">{activeSymbol.symbol}</span>
              {!activeSymbol.exchange.includes('_INDEX') && (
                <span className="text-[8px] px-1 py-0.5 bg-[#1e1e30] text-zinc-500 rounded font-bold uppercase">
                  {activeSymbol.exchange}
                </span>
              )}
              {currentItem && currentItem.ltp > 0 && (
                <>
                  <span className="text-sm tabular-nums text-zinc-200 ml-2">
                    {formatPrice(currentItem.ltp)}
                  </span>
                  <span className={`text-[11px] tabular-nums font-medium ${
                    currentItem.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {currentItem.change >= 0 ? '+' : ''}{formatPrice(currentItem.change)}
                    {' '}({currentItem.changePercent >= 0 ? '+' : ''}{currentItem.changePercent.toFixed(2)}%)
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-zinc-600 text-sm">Select a symbol</span>
          )}
          {isLoading && <Loader2 size={12} className="text-zinc-600 animate-spin ml-2" />}
          
          {isShowingCached && (
            <div 
              className="flex items-center gap-1 text-[9px] text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded ml-2"
              title={`Showing cached data${lastFetchedAt ? ` · Last synced at ${new Date(lastFetchedAt).toLocaleTimeString()}` : ''}`}
            >
              {connection.isOffline ? <WifiOff size={10} /> : <HardDrive size={10} />}
              <span className="font-bold uppercase tracking-wider">{connection.isOffline ? 'Offline' : 'Cached'}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Indicator Menu */}
          <div className="relative">
            <button
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              className={`p-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
                showIndicatorMenu ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e30]'
              }`}
              title="Indicators"
            >
              <TrendingUp size={14} />
              <span className="text-[10px] font-bold">INDICATORS</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${showIndicatorMenu ? 'rotate-180' : ''}`} />
            </button>

            {showIndicatorMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-[#161623] border border-[#2e2e42] rounded shadow-2xl z-50 p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-100">INDICATORS</span>
                  <button onClick={() => setShowIndicatorMenu(false)} className="text-zinc-500 hover:text-zinc-300">
                    <X size={14} />
                  </button>
                </div>

                {/* Volume Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={13} className="text-blue-400" />
                    <span className="text-[10px] text-zinc-300">Volume</span>
                  </div>
                  <button
                    onClick={() => updateChartSettings({ showVolume: !chartSettings.showVolume })}
                    className={`w-7 h-4 rounded-full transition-colors relative ${chartSettings.showVolume ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartSettings.showVolume ? 'left-3.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="h-px bg-[#2e2e42]" />

                {/* SMA Indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartSettings.indicators.sma.color }} />
                      <span className="text-[10px] text-zinc-300">SMA</span>
                    </div>
                    <button
                      onClick={() => updateChartSettings({ 
                        indicators: { ...chartSettings.indicators, sma: { ...chartSettings.indicators.sma, enabled: !chartSettings.indicators.sma.enabled } } 
                      })}
                      className={`w-7 h-4 rounded-full transition-colors relative ${chartSettings.indicators.sma.enabled ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartSettings.indicators.sma.enabled ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-[9px] text-zinc-500">Period:</span>
                    <input 
                      type="number"
                      value={chartSettings.indicators.sma.period}
                      onChange={(e) => updateChartSettings({ 
                        indicators: { ...chartSettings.indicators, sma: { ...chartSettings.indicators.sma, period: parseInt(e.target.value) || 1 } } 
                      })}
                      className="bg-[#0e0e16] border border-[#2e2e42] text-[10px] text-zinc-200 w-12 px-1 focus:border-emerald-500/50 outline-none rounded-sm"
                    />
                  </div>
                </div>

                {/* EMA Indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartSettings.indicators.ema.color }} />
                      <span className="text-[10px] text-zinc-300">EMA</span>
                    </div>
                    <button
                      onClick={() => updateChartSettings({ 
                        indicators: { ...chartSettings.indicators, ema: { ...chartSettings.indicators.ema, enabled: !chartSettings.indicators.ema.enabled } } 
                      })}
                      className={`w-7 h-4 rounded-full transition-colors relative ${chartSettings.indicators.ema.enabled ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartSettings.indicators.ema.enabled ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-[9px] text-zinc-500">Period:</span>
                    <input 
                      type="number"
                      value={chartSettings.indicators.ema.period}
                      onChange={(e) => updateChartSettings({ 
                        indicators: { ...chartSettings.indicators, ema: { ...chartSettings.indicators.ema, period: parseInt(e.target.value) || 1 } } 
                      })}
                      className="bg-[#0e0e16] border border-[#2e2e42] text-[10px] text-zinc-200 w-12 px-1 focus:border-emerald-500/50 outline-none rounded-sm"
                    />
                  </div>
                </div>

                {/* CPR Indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartSettings.indicators?.cpr?.color || '#FF3D3D' }} />
                      <span className="text-[10px] text-zinc-300">Daily CPR</span>
                    </div>
                    <button
                      onClick={() => updateChartSettings({ 
                        indicators: { ...chartSettings.indicators, cpr: { ...(chartSettings.indicators?.cpr || { enabled: false, period: 0, color: '#FF3D3D' }), enabled: !chartSettings.indicators?.cpr?.enabled } } 
                      })}
                      className={`w-7 h-4 rounded-full transition-colors relative ${chartSettings.indicators?.cpr?.enabled ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartSettings.indicators?.cpr?.enabled ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-500 pl-6 italic">Pivot, TC, and BC levels based on previous day</p>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[#1e1e30] mx-1" />

          {/* Interval selector */}
          <div className="flex items-center gap-0.5">
            {CHART_INTERVALS.map((itv) => (
              <button
                key={itv.value}
                onClick={() => setInterval_(itv.value)}
                className={`px-2 py-0.5 text-[10px] rounded-sm transition-colors ${
                  interval === itv.value
                    ? 'bg-emerald-500/10 text-emerald-400 font-bold'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1e1e30]'
                }`}
              >
                {itv.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="flex-1 relative min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Error overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e16]/80 z-10">
            <span className="text-zinc-500 text-sm font-medium">{error}</span>
          </div>
        )}

        {/* No symbol overlay */}
        {!activeSymbol && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e16] z-10">
            <span className="text-zinc-600 text-sm">Select a symbol from watchlist</span>
          </div>
        )}
      </div>

      {/* OHLCV bar (crosshair data) */}
      <div className="flex items-center gap-4 px-3 py-1 border-t border-[#1e1e30] text-[10px] shrink-0 h-6 bg-[#08080d]/50">
        {crosshairData ? (
          <>
            <span className="text-zinc-500">
              O: <span className="text-zinc-300 tabular-nums">{formatPrice(crosshairData.open)}</span>
            </span>
            <span className="text-zinc-500">
              H: <span className="text-zinc-300 tabular-nums">{formatPrice(crosshairData.high)}</span>
            </span>
            <span className="text-zinc-500">
              L: <span className="text-zinc-300 tabular-nums">{formatPrice(crosshairData.low)}</span>
            </span>
            <span className="text-zinc-500">
              C: <span className={`tabular-nums font-bold ${
                crosshairData.close >= crosshairData.open ? 'text-emerald-400' : 'text-red-400'
              }`}>{formatPrice(crosshairData.close)}</span>
            </span>
            <span className="text-zinc-500">
              V: <span className="text-zinc-300 tabular-nums">{fmtVol(crosshairData.volume)}</span>
            </span>
          </>
        ) : (
          <span className="text-zinc-600 italic">Hover chart for OHLCV data</span>
        )}
      </div>
    </div>
  );
}

// Merges two sorted bar arrays, newer bars overwrite older on same timestamp
function mergeBarArrays(base: BarData[], incoming: BarData[]): BarData[] {
  const map = new Map<number, BarData>();
  base.forEach((b) => map.set(b.time, b));
  incoming.forEach((b) => map.set(b.time, b));
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}
