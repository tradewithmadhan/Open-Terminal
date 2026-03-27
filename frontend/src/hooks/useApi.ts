import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi, portfolioApi, orderApi, marketApi } from '@/lib/api-client';

// ─── Health ─────────────────────────────────────────
export function useHealth(enabled = true) {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check().then(r => r.data),
    refetchInterval: 30000,
    enabled,
  });
}

// ─── Funds ──────────────────────────────────────────
export function useFunds(enabled = true) {
  return useQuery({
    queryKey: ['funds'],
    queryFn: () => portfolioApi.funds().then(r => r.data),
    refetchInterval: 10000,
    enabled,
  });
}

// ─── Positions ──────────────────────────────────────
export function usePositions(enabled = true) {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => portfolioApi.positions().then(r => r.data),
    refetchInterval: 5000,
    enabled,
  });
}

// ─── Market Data ─────────────────────────────────────
export function useMultiQuotes(
  symbols: Array<{ symbol: string; exchange: string }>,
  enabled = true
) {
  return useQuery({
    queryKey: ['multiquotes', symbols.map(s => `${s.symbol}:${s.exchange}`).join(',')],
    queryFn: () => marketApi.multiQuote(symbols).then(r => r.data),
    refetchInterval: 30000,
    enabled: enabled && symbols.length > 0,
  });
}

// ─── Order Book ─────────────────────────────────────
export function useOrderBook(enabled = true) {
  return useQuery({
    queryKey: ['orderbook'],
    queryFn: () => portfolioApi.orderbook().then(r => r.data),
    refetchInterval: 5000,
    enabled,
  });
}

// ─── Trade Book ─────────────────────────────────────
export function useTradeBook(enabled = true) {
  return useQuery({
    queryKey: ['tradebook'],
    queryFn: () => portfolioApi.tradebook().then(r => r.data),
    refetchInterval: 10000,
    enabled,
  });
}

// ─── Holdings ───────────────────────────────────────
export function useHoldings(enabled = true) {
  return useQuery({
    queryKey: ['holdings'],
    queryFn: () => portfolioApi.holdings().then(r => r.data),
    refetchInterval: 60000,
    enabled,
  });
}

// ─── Place Order ────────────────────────────────────
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof orderApi.place>[0]) => orderApi.place(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orderbook'] });
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['funds'] });
    },
  });
}

// ─── Cancel Order ───────────────────────────────────
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderid, strategy }: { orderid: string; strategy?: string }) =>
      orderApi.cancel(orderid, strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orderbook'] });
    },
  });
}
// ─── Exit All Positions ────────────────────────────
export function useExitAllPositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (strategy?: string) => orderApi.closeAll(strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['orderbook'] });
    },
  });
}
// ─── Cancel All Orders ──────────────────────────────
export function useCancelAllOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (strategy?: string) => orderApi.cancelAll(strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orderbook'] });
    },
  });
}
