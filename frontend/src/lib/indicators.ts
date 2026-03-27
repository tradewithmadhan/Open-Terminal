import { LineData, Time } from 'lightweight-charts';

interface OHLCV {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: OHLCV[], period: number): LineData[] {
  const sma: LineData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    sma.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  
  return sma;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: OHLCV[], period: number): LineData[] {
  const ema: LineData[] = [];
  const k = 2 / (period + 1);
  
  // Start with SMA as the first EMA value if enough data
  if (data.length < period) return [];
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  
  let previousEma = sum / period;
  ema.push({
    time: data[period - 1].time,
    value: previousEma,
  });
  
  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i].close - previousEma) * k + previousEma;
    ema.push({
      time: data[i].time,
      value: currentEma,
    });
    previousEma = currentEma;
  }
  
  return ema;
}

export interface CPRResult {
  pivot: LineData[];
  tc: LineData[];
  bc: LineData[];
}

/**
 * Calculate Daily CPR levels from intraday data
 */
export function calculateCPR(data: OHLCV[]): CPRResult {
  const result: CPRResult = { pivot: [], tc: [], bc: [] };
  if (data.length === 0) return result;

  const days: { date: string, high: number, low: number, close: number }[] = [];
  let currentDay: any = null;

  // Group by day to get daily OHLC
  data.forEach(item => {
    const dateStr = new Date((item.time as number) * 1000).toISOString().split('T')[0];
    if (!currentDay || currentDay.date !== dateStr) {
      if (currentDay) days.push(currentDay);
      currentDay = { date: dateStr, high: item.high, low: item.low, close: item.close };
    } else {
      currentDay.high = Math.max(currentDay.high, item.high);
      currentDay.low = Math.min(currentDay.low, item.low);
      currentDay.close = item.close; // Last close of the day
    }
  });
  if (currentDay) days.push(currentDay);

  // For each day, calculate CPR based on PREVIOUS day
  data.forEach(item => {
    const dateStr = new Date((item.time as number) * 1000).toISOString().split('T')[0];
    const currentDayIdx = days.findIndex(d => d.date === dateStr);
    
    if (currentDayIdx > 0) {
      const prevDay = days[currentDayIdx - 1];
      const pivot = (prevDay.high + prevDay.low + prevDay.close) / 3;
      const bc = (prevDay.high + prevDay.low) / 2;
      const tc = (pivot - bc) + pivot;

      result.pivot.push({ time: item.time, value: pivot });
      result.tc.push({ time: item.time, value: tc });
      result.bc.push({ time: item.time, value: bc });
    }
  });

  return result;
}
