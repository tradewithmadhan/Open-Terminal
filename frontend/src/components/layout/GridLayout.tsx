'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import { PanelWrapper } from './PanelWrapper';
import type { LayoutItem, Layouts as TerminalLayouts } from '@/lib/types';

// Panel component imports
import { WatchlistPanel } from '@/components/panels/WatchlistPanel';
import { ChartPanel } from '@/components/panels/ChartPanel';
import { OrderTicketPanel } from '@/components/panels/OrderTicketPanel';
import { OrderBookPanel } from '@/components/panels/OrderBookPanel';
import { PositionsPanel } from '@/components/panels/PositionsPanel';
import { TradeBookPanel } from '@/components/panels/TradeBookPanel';
import { FundsPanel } from '@/components/panels/FundsPanel';
import { HoldingsPanel } from '@/components/panels/HoldingsPanel';
import { DepthPanel } from '@/components/panels/DepthPanel';
import { OptionChainPanel } from '@/components/panels/OptionChainPanel';
import { GreeksPanel } from '@/components/panels/GreeksPanel';
import { AlertsPanel } from '@/components/panels/AlertsPanel';
import { AnalyticsPanel } from '@/components/panels/AnalyticsPanel';
import { MarketOverviewPanel } from '@/components/panels/MarketOverviewPanel';
import { StrategyBuilderPanel } from '@/components/panels/StrategyBuilderPanel';
import { StrategyPanel } from '@/components/panels/StrategyPanel';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Panel registry
const PANEL_COMPONENTS: Record<string, React.FC> = {
  watchlist: WatchlistPanel,
  chart: ChartPanel,
  orderTicket: OrderTicketPanel,
  orderbook: OrderBookPanel,
  positions: PositionsPanel,
  tradebook: TradeBookPanel,
  funds: FundsPanel,
  holdings: HoldingsPanel,
  depth: DepthPanel,
  optionchain: OptionChainPanel,
  greeks: GreeksPanel,
  alerts: AlertsPanel,
  analytics: AnalyticsPanel,
  marketoverview: MarketOverviewPanel,
  strategyBuilder: StrategyBuilderPanel,
  strategy: StrategyPanel,
};

// Default layout (lg breakpoint: 24 columns)
const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'watchlist',    x: 0,  y: 0,  w: 4,  h: 18, minW: 3, minH: 10 },
  { i: 'chart',        x: 4,  y: 0,  w: 14, h: 12, minW: 8, minH: 8 },
  { i: 'positions',    x: 4,  y: 12, w: 14, h: 6,  minW: 8, minH: 4 },
  { i: 'orderTicket',  x: 18, y: 0,  w: 6,  h: 9,  minW: 4, minH: 6 },
  { i: 'orderbook',    x: 18, y: 9,  w: 6,  h: 6,  minW: 4, minH: 4 },
  { i: 'funds',        x: 18, y: 15, w: 6,  h: 3,  minW: 4, minH: 3 },
  { i: 'tradebook',    x: 4,  y: 12, w: 14, h: 6,  minW: 8, minH: 4 },
  { i: 'holdings',     x: 4,  y: 12, w: 14, h: 6,  minW: 8, minH: 4 },
  { i: 'depth',        x: 18, y: 9,  w: 6,  h: 6,  minW: 4, minH: 4 },
  { i: 'optionchain',  x: 4,  y: 0,  w: 14, h: 18, minW: 10, minH: 8 },
  { i: 'greeks',       x: 18, y: 0,  w: 6,  h: 15, minW: 4, minH: 6 },
  { i: 'alerts',       x: 18, y: 12, w: 6,  h: 6,  minW: 4, minH: 4 },
  { i: 'analytics',    x: 0, y: 18, w: 16, h: 8, minW: 8, minH: 6 },
  { i: 'marketoverview', x: 0, y: 18, w: 8, h: 8, minW: 5, minH: 6 },
  { i: 'strategyBuilder', x: 5, y: 0, w: 13, h: 14, minW: 8, minH: 8 },
  { i: 'strategy',     x: 18, y: 12, w: 6, h: 10, minW: 4, minH: 6 },
];

export function GridLayout() {
  const { 
    panels, 
    isEditMode, 
    savedLayouts, 
    activeLayoutName,
    pendingLayouts,
    updatePendingLayout,
    isAutosaveEnabled,
    saveLayout,
    maximizedPanelId,
    setMaximizedPanel,
    togglePanel, 
    minimizePanel
  } = useTerminalStore();

  // Determine current layouts to display
  const layouts = useMemo(() => {
    if (maximizedPanelId) {
      return { lg: [{ i: maximizedPanelId, x: 0, y: 0, w: 24, h: 22 }] };
    }

    const currentBaseLayout = (isEditMode && !isAutosaveEnabled && pendingLayouts) 
      ? pendingLayouts.lg 
      : (savedLayouts[activeLayoutName]?.lg || []);

    const visiblePanels = panels.filter(p => p.visible);
    
    const lg = visiblePanels.map(p => {
      let item = currentBaseLayout.find(l => l.i === p.id);
      if (!item) item = DEFAULT_LAYOUT.find(l => l.i === p.id);
      if (!item) item = { i: p.id, x: 0, y: 100, w: 6, h: 6, minW: 3, minH: 3 };
      if (p.minimized) return { ...item, h: 1 };
      return item;
    });

    return { lg };
  }, [isEditMode, isAutosaveEnabled, pendingLayouts, savedLayouts, activeLayoutName, panels, maximizedPanelId]);

  // Update layout changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback((_layout: any, allLayouts: any) => {
    if (!isEditMode) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitizedLg = (allLayouts.lg || []).map((item: any) => {
      const p = panels.find(panel => panel.id === item.i);
      if (p?.minimized) {
        const currentLayout = (isEditMode && !isAutosaveEnabled && pendingLayouts) 
          ? pendingLayouts.lg 
          : (savedLayouts[activeLayoutName]?.lg || []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalItem = currentLayout.find((l: any) => l.i === item.i);
        return { ...item, h: originalItem?.h || item.h };
      }
      return item;
    });

    const sanitizedLayouts = { ...allLayouts, lg: sanitizedLg };

    if (isAutosaveEnabled) {
      saveLayout(activeLayoutName, sanitizedLayouts as unknown as TerminalLayouts);
    } else {
      updatePendingLayout(sanitizedLayouts as unknown as TerminalLayouts);
    }
  }, [isEditMode, isAutosaveEnabled, activeLayoutName, saveLayout, updatePendingLayout, panels, pendingLayouts, savedLayouts]);

  return (
    <ResponsiveGridLayout
      className="layout px-1"
      layouts={layouts as any}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 }}
      rowHeight={30}
      draggableHandle=".panel-drag-handle"
      isDraggable={isEditMode && !maximizedPanelId}
      isResizable={isEditMode && !maximizedPanelId}
      onLayoutChange={handleLayoutChange}
      margin={[4, 4]}
      containerPadding={[0, 0]}
      compactType="vertical"
      verticalCompact={true}
    >
      {panels
        .filter(p => p.visible && (!maximizedPanelId || p.id === maximizedPanelId))
        .map(panel => {
          const Component = PANEL_COMPONENTS[panel.id];
          if (!Component) return null;
          const isMaximized = maximizedPanelId === panel.id;
          return (
            <div key={panel.id}>
              <PanelWrapper
                title={panel.title}
                minimized={panel.minimized}
                maximized={isMaximized}
                onMinimize={() => minimizePanel(panel.id)}
                onMaximize={() => setMaximizedPanel(isMaximized ? null : panel.id)}
                onClose={() => togglePanel(panel.id)}
                draggable={isEditMode && !isMaximized}
              >
                {!panel.minimized && <Component />}
              </PanelWrapper>
            </div>
          );
        })}
    </ResponsiveGridLayout>
  );
}
