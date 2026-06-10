import { useState, useMemo } from 'react';
import { Cpu, MemoryStick, Activity, Wifi, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PerformanceChart } from './PerformanceChart';
import { Sparkline } from './Sparkline';
import { TimeRangeSelector } from './TimeRangeSelector';
import { CollectorPerformance } from './CollectorPerformance';
import {
  usePerformanceMetrics,
  useRealtimeMetrics,
  useSparklineData,
  type TimeRange,
} from '@/hooks/usePerformance';

interface PerformanceGridProps {
  className?: string;
  showCollectors?: boolean;
  compact?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'yellow' | 'purple';
  sparklineData: number[];
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  alertThreshold?: number;
  className?: string;
}

const COLOR_STYLES = {
  green: {
    iconBg: 'var(--emerald-glow)',
    iconColor: 'var(--emerald-400)',
    valueColor: 'var(--emerald-400)',
    trendUp: 'var(--crit)',
    trendDown: 'var(--emerald-400)',
  },
  blue: {
    iconBg: 'var(--med-bg)',
    iconColor: 'var(--med)',
    valueColor: 'var(--med)',
    trendUp: 'var(--crit)',
    trendDown: 'var(--emerald-400)',
  },
  red: {
    iconBg: 'var(--crit-bg)',
    iconColor: 'var(--crit)',
    valueColor: 'var(--crit)',
    trendUp: 'var(--crit)',
    trendDown: 'var(--emerald-400)',
  },
  yellow: {
    iconBg: 'var(--high-bg)',
    iconColor: 'var(--high)',
    valueColor: 'var(--high)',
    trendUp: 'var(--high)',
    trendDown: 'var(--emerald-400)',
  },
  purple: {
    iconBg: 'rgba(168, 85, 247, 0.1)',
    iconColor: '#a855f7',
    valueColor: '#a855f7',
    trendUp: 'var(--crit)',
    trendDown: 'var(--emerald-400)',
  },
};

function MetricCard({
  title,
  value,
  unit = '',
  icon,
  color,
  sparklineData,
  trend,
  trendValue,
  alertThreshold,
  className,
}: MetricCardProps) {
  const styles = COLOR_STYLES[color];
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const isAlert = alertThreshold !== undefined && numericValue > alertThreshold;

  return (
    <div
      className={cn(
        'rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]',
        isAlert && 'ring-1 ring-crit/30',
        className
      )}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="p-2 rounded-lg"
            style={{ background: styles.iconBg }}
          >
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
              {title}
            </p>
            <div className="flex items-baseline gap-1">
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: isAlert ? 'var(--crit)' : styles.valueColor }}
              >
                {typeof value === 'number' ? value.toFixed(1) : value}
              </span>
              {unit && (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {unit}
                </span>
              )}
            </div>
          </div>
        </div>

        {trend && trendValue !== undefined && (
          <div
            className="flex items-center gap-0.5 text-xs font-medium"
            style={{
              color: trend === 'up' ? styles.trendUp : trend === 'down' ? styles.trendDown : 'var(--muted)',
            }}
          >
            {trend === 'up' && <ArrowUp className="w-3 h-3" />}
            {trend === 'down' && <ArrowDown className="w-3 h-3" />}
            {trendValue.toFixed(1)}%
          </div>
        )}
      </div>

      <Sparkline
        data={sparklineData}
        color={color}
        height={40}
        showAlert={!!alertThreshold}
        alertThreshold={alertThreshold}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}`;
  return `${bytes}`;
}

function formatBytesUnit(bytes: number): string {
  if (bytes >= 1024 * 1024) return 'MB/s';
  if (bytes >= 1024) return 'KB/s';
  return 'B/s';
}

export function PerformanceGrid({
  className,
  showCollectors = true,
  compact = false,
}: PerformanceGridProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('5min');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: metrics, isLoading, refetch } = usePerformanceMetrics(timeRange);
  const { metrics: realtimeMetrics, isConnected } = useRealtimeMetrics();

  // Sparkline data for cards
  const cpuSparkline = useSparklineData('cpu');
  const memorySparkline = useSparklineData('memory');
  const eventsSparkline = useSparklineData('eventsPerSec');
  const networkInSparkline = useSparklineData('networkIn');
  const networkOutSparkline = useSparklineData('networkOut');

  // Calculate trends
  const calculateTrend = (data: number[]): { trend: 'up' | 'down' | 'stable'; value: number } => {
    if (data.length < 2) return { trend: 'stable', value: 0 };
    const recent = data.slice(-5);
    const older = data.slice(-10, -5);
    if (recent.length === 0 || older.length === 0) return { trend: 'stable', value: 0 };

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    if (olderAvg === 0) return { trend: 'stable', value: 0 };

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (Math.abs(change) < 2) return { trend: 'stable', value: change };
    return { trend: change > 0 ? 'up' : 'down', value: Math.abs(change) };
  };

  const cpuTrend = useMemo(() => calculateTrend(cpuSparkline), [cpuSparkline]);
  const memoryTrend = useMemo(() => calculateTrend(memorySparkline), [memorySparkline]);
  const eventsTrend = useMemo(() => calculateTrend(eventsSparkline), [eventsSparkline]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading && !realtimeMetrics) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: 'var(--surface)' }}
            >
              <div className="h-4 w-20 rounded mb-2" style={{ background: 'var(--surface-2)' }} />
              <div className="h-8 w-16 rounded mb-3" style={{ background: 'var(--surface-2)' }} />
              <div className="h-10 rounded" style={{ background: 'var(--surface-2)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
            Performance Monitor
          </h2>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'animate-pulse' : ''
              )}
              style={{
                background: isConnected ? 'var(--emerald-400)' : 'var(--muted)',
                boxShadow: isConnected ? '0 0 6px var(--emerald-400)' : 'none',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)' }}
            title="Refresh"
          >
            <RefreshCw
              className={cn('w-4 h-4', isRefreshing && 'animate-spin')}
              style={{ color: 'var(--muted)' }}
            />
          </button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="CPU Usage"
          value={realtimeMetrics?.cpu ?? metrics?.cpu.current ?? 0}
          unit="%"
          icon={<Cpu className="w-4 h-4" style={{ color: 'var(--emerald-400)' }} />}
          color="green"
          sparklineData={cpuSparkline}
          trend={cpuTrend.trend}
          trendValue={cpuTrend.value}
          alertThreshold={90}
        />
        <MetricCard
          title="Memory"
          value={realtimeMetrics?.memoryPercent ?? metrics?.memory.current ?? 0}
          unit="%"
          icon={<MemoryStick className="w-4 h-4" style={{ color: 'var(--med)' }} />}
          color="blue"
          sparklineData={memorySparkline}
          trend={memoryTrend.trend}
          trendValue={memoryTrend.value}
          alertThreshold={85}
        />
        <MetricCard
          title="Events/sec"
          value={realtimeMetrics?.eventsPerSec ?? metrics?.eventsPerSec.current ?? 0}
          unit="/s"
          icon={<Activity className="w-4 h-4" style={{ color: 'var(--high)' }} />}
          color="yellow"
          sparklineData={eventsSparkline}
          trend={eventsTrend.trend}
          trendValue={eventsTrend.value}
        />
        <MetricCard
          title="Network In"
          value={formatBytes(realtimeMetrics?.networkIn ?? metrics?.networkIn.current ?? 0)}
          unit={formatBytesUnit(realtimeMetrics?.networkIn ?? metrics?.networkIn.current ?? 0)}
          icon={<ArrowDown className="w-4 h-4" style={{ color: '#a855f7' }} />}
          color="purple"
          sparklineData={networkInSparkline}
        />
        <MetricCard
          title="Network Out"
          value={formatBytes(realtimeMetrics?.networkOut ?? metrics?.networkOut.current ?? 0)}
          unit={formatBytesUnit(realtimeMetrics?.networkOut ?? metrics?.networkOut.current ?? 0)}
          icon={<ArrowUp className="w-4 h-4" style={{ color: 'var(--crit)' }} />}
          color="red"
          sparklineData={networkOutSparkline}
        />
      </div>

      {/* Detailed Charts */}
      {!compact && metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PerformanceChart
            title="CPU Usage"
            data={metrics.dataPoints}
            dataKey="cpu"
            stats={metrics.cpu}
            color="green"
            unit="%"
            showThreshold
            thresholdValue={90}
            thresholdLabel="Alert"
          />
          <PerformanceChart
            title="Memory Usage"
            data={metrics.dataPoints}
            dataKey="memory"
            stats={metrics.memory}
            color="blue"
            unit="%"
            showThreshold
            thresholdValue={85}
            thresholdLabel="Warning"
          />
          <PerformanceChart
            title="Events per Second"
            data={metrics.dataPoints}
            dataKey="eventsPerSec"
            stats={metrics.eventsPerSec}
            color="yellow"
            unit="/s"
          />
          <PerformanceChart
            title="Network I/O"
            data={metrics.dataPoints}
            dataKey="networkIn"
            stats={metrics.networkIn}
            color="purple"
            unit="bytes"
            formatValue={(v) => {
              if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB/s`;
              if (v >= 1024) return `${(v / 1024).toFixed(1)} KB/s`;
              return `${v} B/s`;
            }}
          />
        </div>
      )}

      {/* Collector Performance */}
      {showCollectors && realtimeMetrics?.collectors && (
        <CollectorPerformance
          collectors={realtimeMetrics.collectors}
          view="grid"
        />
      )}
    </div>
  );
}
