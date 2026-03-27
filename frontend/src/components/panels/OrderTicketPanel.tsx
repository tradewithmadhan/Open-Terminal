'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { orderApi } from '@/lib/api-client';
import { formatPrice } from '@/lib/formatters';
import { EXCHANGES, PRODUCTS, PRICE_TYPES } from '@/lib/constants';
import type { Exchange, Action, PriceType, ProductType } from '@/lib/types';
import { showToast } from '@/components/common/ToastManager';

export function OrderTicketPanel() {
  const { activeSymbol, watchlist, defaults } = useTerminalStore();

  // Form state
  const [action, setAction] = useState<Action>('BUY');
  const [exchange, setExchange] = useState<Exchange>(defaults.exchange);
  const [product, setProduct] = useState<ProductType>('MIS');
  const [priceType, setPriceType] = useState<PriceType>('MARKET');
  const [quantity, setQuantity] = useState(defaults.quantity);
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [confirmEnabled, setConfirmEnabled] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  // Advanced order state
  const [orderMode, setOrderMode] = useState<'regular' | 'bracket' | 'cover'>('regular');
  const [slPrice, setSlPrice] = useState('');
  const [targetPriceBO, setTargetPriceBO] = useState('');

  // Get current LTP from watchlist
  const currentItem = watchlist.find(
    w => w.symbol === activeSymbol?.symbol && w.exchange === activeSymbol?.exchange
  );
  const currentLtp = currentItem?.ltp || 0;

  // Auto-update exchange and lot sizing when active symbol changes
  useEffect(() => {
    if (activeSymbol) {
      setExchange(activeSymbol.exchange);
      // Auto-select product based on exchange
      if (['NFO', 'BFO', 'MCX', 'CDS', 'BCD'].includes(activeSymbol.exchange)) {
        setProduct('NRML');
      } else {
        setProduct('MIS');
      }

      // Sync specific lot size for indices
      const lotSize = defaults.lotSizes[activeSymbol.symbol];
      if (lotSize) {
        setQuantity(String(lotSize));
      } else if (activeSymbol.symbol.includes('NIFTY') || activeSymbol.symbol.includes('SENSEX')) {
        // Fallback for NIFTY derivatives like NIFTY25JAN25000CE
        const base = activeSymbol.symbol.startsWith('BANKNIFTY') ? 'BANKNIFTY' :
                     activeSymbol.symbol.startsWith('FINNIFTY') ? 'FINNIFTY' :
                     activeSymbol.symbol.startsWith('MIDCPNIFTY') ? 'MIDCPNIFTY' :
                     activeSymbol.symbol.startsWith('NIFTY') ? 'NIFTY' : 
                     activeSymbol.symbol.startsWith('SENSEX') ? 'SENSEX' : null;
        if (base && defaults.lotSizes[base]) {
          setQuantity(String(defaults.lotSizes[base]));
        }
      }
    }
  }, [activeSymbol, defaults.lotSizes]);

  // Pre-fill price with LTP when switching to LIMIT
  useEffect(() => {
    if (priceType === 'LIMIT' || priceType === 'SL') {
      if (currentLtp > 0 && !price) {
        setPrice(currentLtp.toString());
      }
    }
  }, [priceType, currentLtp]);

  // ─── Validation ─────────────────────────────────
  const isValid = !!(
    activeSymbol &&
    quantity &&
    parseInt(quantity) > 0 &&
    (priceType === 'MARKET' || price) &&
    ((priceType !== 'SL' && priceType !== 'SL-M') || triggerPrice) &&
    (orderMode === 'regular' || slPrice) &&
    (orderMode !== 'bracket' || targetPriceBO)
  );

  // ─── Place Order Handler ────────────────────────
  const executePlaceOrder = useCallback(async () => {
    if (!activeSymbol || !quantity) return;

    setIsPlacing(true);
    setShowConfirm(false);

    try {
      const { data } = await orderApi.place({
        strategy: defaults.strategy,
        symbol: activeSymbol.symbol,
        action: action,
        exchange: exchange,
        pricetype: priceType,
        product: product,
        quantity: quantity,
        price: (priceType === 'LIMIT' || priceType === 'SL') ? price || '0' : '0',
        trigger_price: (priceType === 'SL' || priceType === 'SL-M') ? triggerPrice || '0' : '0',
      });

      if (data.status === 'success') {
        showToast('success', 'Order Placed', `${action} ${quantity} × ${activeSymbol.symbol} — #${data.orderid}`);
      } else {
        showToast('error', 'Order Failed', data.message || 'Unknown error');
      }
    } catch (err: any) {
      showToast('error', 'Order Failed', err.response?.data?.message || err.message || 'Unknown error');
    }
    setIsPlacing(false);
  }, [activeSymbol, action, exchange, product, priceType, quantity, price, triggerPrice, defaults.strategy]);

  // ─── Bracket / Cover Execution ──────────────────
  const executeAdvancedOrder = useCallback(async () => {
    if (!activeSymbol || !quantity || !slPrice) return;
    
    setIsPlacing(true);
    setShowConfirm(false);
    
    try {
      // Step 1: Entry Order
      const entryResult = await orderApi.place({
        strategy: defaults.strategy,
        symbol: activeSymbol.symbol,
        action: action,
        exchange: exchange,
        pricetype: priceType,
        product: product,
        quantity: quantity,
        price: (priceType === 'LIMIT' || priceType === 'SL') ? price || '0' : '0',
        trigger_price: (priceType === 'SL' || priceType === 'SL-M') ? triggerPrice || '0' : '0',
      });

      if (entryResult.data.status !== 'success') {
        showToast('error', 'Entry Placement Failed', entryResult.data.message);
        setIsPlacing(false);
        return;
      }

      showToast('success', 'Entry Order Placed', `#${entryResult.data.orderid}`);

      // Step 2: Stop Loss Order
      const slAction = action === 'BUY' ? 'SELL' : 'BUY';
      const slResult = await orderApi.place({
        strategy: defaults.strategy,
        symbol: activeSymbol.symbol,
        action: slAction,
        exchange: exchange,
        pricetype: 'SL',
        product: product,
        quantity: quantity,
        price: slPrice,
        trigger_price: slPrice,
      });

      if (slResult.data.status === 'success') {
        showToast('info', 'SL Leg Placed', `#${slResult.data.orderid} @ ₹${slPrice}`);
      } else {
        showToast('warning', 'SL Leg Failed', slResult.data.message);
      }

      // Step 3: Target Order (Bracket Only)
      if (orderMode === 'bracket' && targetPriceBO) {
        const tgtResult = await orderApi.place({
          strategy: defaults.strategy,
          symbol: activeSymbol.symbol,
          action: slAction,
          exchange: exchange,
          pricetype: 'LIMIT',
          product: product,
          quantity: quantity,
          price: targetPriceBO,
        });

        if (tgtResult.data.status === 'success') {
          showToast('info', 'Target Leg Placed', `#${tgtResult.data.orderid} @ ₹${targetPriceBO}`);
        } else {
          showToast('warning', 'Target Leg Failed', tgtResult.data.message);
        }
      }
    } catch (err: any) {
      showToast('error', 'Advanced Order Error', err.message);
    }
    setIsPlacing(false);
  }, [activeSymbol, action, exchange, product, priceType, quantity, price, triggerPrice, slPrice, targetPriceBO, orderMode, defaults.strategy]);

  const handlePlaceClick = useCallback(() => {
    if (!isValid) return;
    if (confirmEnabled) {
      setShowConfirm(true);
    } else {
      if (orderMode === 'regular') executePlaceOrder();
      else executeAdvancedOrder();
    }
  }, [confirmEnabled, orderMode, executePlaceOrder, executeAdvancedOrder, isValid]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlaceClick();
    }
  };

  const buttonColor = action === 'BUY'
    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400'
    : 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40 text-red-400';

  // ─── Render ─────────────────────────────────────
  return (
    <div className="flex flex-col h-full p-3 gap-3 text-xs overflow-auto">
      {/* Symbol display */}
      <div className="flex items-center justify-between shrink-0">
        {activeSymbol ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100">{activeSymbol.symbol}</span>
            {!activeSymbol.exchange.includes('_INDEX') && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e30] text-zinc-500">
                {activeSymbol.exchange}
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-600 text-[11px]">Select a symbol from watchlist</span>
        )}
        {currentLtp > 0 && (
          <span className="text-zinc-400 tabular-nums">{formatPrice(currentLtp)}</span>
        )}
      </div>

      {/* BUY / SELL toggle */}
      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <button
          onClick={() => setAction('BUY')}
          className={`py-2 rounded-sm text-[11px] font-bold tracking-wider border transition-all ${
            action === 'BUY'
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-transparent border-[#2a2a42] text-zinc-500 hover:text-zinc-300'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setAction('SELL')}
          className={`py-2 rounded-sm text-[11px] font-bold tracking-wider border transition-all ${
            action === 'SELL'
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'bg-transparent border-[#2a2a42] text-zinc-500 hover:text-zinc-300'
          }`}
        >
          SELL
        </button>
      </div>

      {/* Order Mode selector */}
      <div className="flex items-center gap-1 shrink-0">
        {[
          { value: 'regular', label: 'Regular' },
          { value: 'bracket', label: 'Bracket' },
          { value: 'cover', label: 'Cover' },
        ].map(m => (
          <button
            key={m.value}
            onClick={() => setOrderMode(m.value as any)}
            className={`flex-1 py-1 text-[10px] rounded-sm border transition-colors ${
              orderMode === m.value
                ? 'bg-[#448aff22] border-[#448aff44] text-[#448aff]'
                : 'border-[#2a2a42] text-zinc-600 hover:text-zinc-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Form fields */}
      <div className="space-y-2.5 flex-1">
        {/* Exchange */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Exchange</label>
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as Exchange)}
            className="input-field w-[140px]"
          >
            {EXCHANGES.map(ex => (
              <option key={ex.value} value={ex.value}>{ex.label}</option>
            ))}
          </select>
        </div>

        {/* Product */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Product</label>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value as ProductType)}
            className="input-field w-[140px]"
          >
            {PRODUCTS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Price Type */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Type</label>
          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as PriceType)}
            className="input-field w-[140px]"
          >
            {PRICE_TYPES.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Qty</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={handleKeyDown}
              min="1"
              className="input-field w-[90px] text-right tabular-nums"
            />
            {/* Quick multiply buttons */}
            {[2, 5, 10].map(mult => (
              <button
                key={mult}
                onClick={() => setQuantity(String(Math.max(1, parseInt(quantity || '1') * mult)))}
                className="px-1.5 py-1 text-[9px] text-zinc-500 hover:text-zinc-300 bg-[#14141f] rounded-sm hover:bg-[#1e1e30]"
              >
                ×{mult}
              </button>
            ))}
          </div>
        </div>

        {/* Price (for LIMIT, SL) */}
        {(priceType === 'LIMIT' || priceType === 'SL') && (
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={handleKeyDown}
              step="0.05"
              className="input-field w-[140px] text-right tabular-nums"
              placeholder="0.00"
            />
          </div>
        )}

        {/* Trigger Price (for SL, SL-M) */}
        {(priceType === 'SL' || priceType === 'SL-M') && (
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Trigger</label>
            <input
              type="number"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              onKeyDown={handleKeyDown}
              step="0.05"
              className="input-field w-[140px] text-right tabular-nums"
              placeholder="0.00"
            />
          </div>
        )}

        {/* Advanced Order Fields (SL / Target) */}
        {(orderMode === 'bracket' || orderMode === 'cover') && (
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Stop Loss</label>
            <input
              type="number"
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value)}
              onKeyDown={handleKeyDown}
              step="0.05"
              className="input-field w-[140px] text-right tabular-nums focus:border-red-500"
              placeholder="SL Price"
            />
          </div>
        )}

        {orderMode === 'bracket' && (
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Target</label>
            <input
              type="number"
              value={targetPriceBO}
              onChange={(e) => setTargetPriceBO(e.target.value)}
              onKeyDown={handleKeyDown}
              step="0.05"
              className="input-field w-[140px] text-right tabular-nums focus:border-emerald-500"
              placeholder="Target Price"
            />
          </div>
        )}
      </div>

      {/* Confirm toggle */}
      <div className="flex items-center justify-between text-[10px] shrink-0">
        <span className="text-zinc-500">Confirm before placing</span>
        <button
          onClick={() => setConfirmEnabled(!confirmEnabled)}
          className={`w-8 h-4 rounded-full transition-colors relative ${
            confirmEnabled ? 'bg-emerald-500/40' : 'bg-zinc-700'
          }`}
        >
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            confirmEnabled ? 'left-4' : 'left-0.5'
          }`} />
        </button>
      </div>

      {/* Place Order Button */}
      <button
        onClick={handlePlaceClick}
        disabled={!isValid || isPlacing}
        className={`w-full py-2.5 rounded-sm text-[11px] font-bold tracking-wider border transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${buttonColor}`}
      >
        {isPlacing ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            PLACING...
          </span>
        ) : (
          orderMode === 'bracket' ? `${action} BRACKET` :
          orderMode === 'cover' ? `${action} COVER` :
          `${action} ${priceType}`
        )}
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-[#0e0e16] border border-[#2a2a42] rounded-sm p-5 w-[340px] space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={16} />
              <span className="text-sm font-bold uppercase tracking-tight">Confirm Order</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Action</span>
                <span className={action === 'BUY' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {action}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Symbol</span>
                <span className="text-zinc-200">{activeSymbol?.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Quantity</span>
                <span className="text-zinc-200">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Type</span>
                <span className="text-zinc-200">
                  {orderMode.toUpperCase()} | {priceType} | {product}
                </span>
              </div>
              {orderMode !== 'regular' && (
                <div className="flex justify-between font-bold">
                  <span className="text-zinc-500">Stop Loss</span>
                  <span className="text-red-400">₹{slPrice}</span>
                </div>
              )}
              {orderMode === 'bracket' && (
                <div className="flex justify-between font-bold">
                  <span className="text-zinc-500">Target</span>
                  <span className="text-emerald-400">₹{targetPriceBO}</span>
                </div>
              )}
              {price && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Price</span>
                  <span className="text-zinc-200">₹{price}</span>
                </div>
              )}
              {currentLtp > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Current LTP</span>
                  <span className="text-zinc-200">₹{formatPrice(currentLtp)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-1.5 rounded-sm text-[10px] border border-[#2a2a42] text-zinc-500 hover:text-zinc-300 hover:bg-[#1e1e30]"
              >
                CANCEL
              </button>
               <button
                onClick={() => {
                  if (orderMode === 'regular') executePlaceOrder();
                  else executeAdvancedOrder();
                }}
                className={`flex-1 py-1.5 rounded-sm text-[10px] font-bold border ${buttonColor}`}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
