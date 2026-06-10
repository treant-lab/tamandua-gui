import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Cpu, MemoryStick, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CollectorMetrics } from '@/hooks/usePerformance';

interface CollectorPerformanceProps {
  collectors: CollectorMetrics[];
  className?: string;
  view?: 'grid' | 'chart';
}

const COLLECTOR_COLORS: Record<string, string> = {
  process: '#2fc471',
  file: '#5b9cf2',
  network: '#a855f7',
  dns: '#f5a524',
  registry: '#f0506e',
  default: '#6b7280',
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function CollectorCard({ collector }: { collector: CollectorMetrics }) {
  const color = COLLECTOR_COLORS[collector.name] || COLLECTOR_COLORS.default;
  const hasErrors = collector.errors > 0;

  return (
    <div
      className={cn(
        'rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]',
        hasErrors && 'ring-1 ring-warning-500/30'
      )}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
          <span className="font-medium capitalize" style={{ color: 'var(--fg)' }}>
            {collector.name}
          </span>
        </div>
        {hasErrors && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--high)' }}>
            <AlertTriangle className="w-3 h-3" />
            <span>{collector.errors}</span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          <div>
            <p className="text-[10px] uppercase" style={{ color: 'var(--subtle)' }}>CPU</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color }}>
              {collector.cpuPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <MemoryStick className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          <div>
            <p className="text-[10px] uppercase" style={{ color: 'var(--subtle)' }}>Memory</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color }}>
              {formatBytes(collector.memoryBytes)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          <div>
            <p className="text-[10px] uppercase" style={{ color: 'var(--subtle)' }}>Events/s</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color }}>
              {collector.eventsPerSec}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase" style={{ color: 'var(--subtle)' }}>Total</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--fg-2)' }}>
            {formatNumber(collector.totalEvents)}
          </p>
        </div>
      </div>

      {/* CPU Progress Bar */}
      <div className="mt-3">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--surface-2)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(collector.cpuPercent * 10, 100)}%`,
              background: color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CollectorMetrics; value: number }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const collector = payload[0].payload;
  const color = COLLECTOR_COLORS[collector.name] || COLLECTOR_COLORS.default;

  return (
    <div
      className="px-3 py-2 rounded-lg shadow-lg border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--hairline)',
      }}
    >
      <p className="text-sm font-semibold capitalize mb-2" style={{ color }}>
        {collector.name}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--muted)' }}>CPU</span>
          <span style={{ color: 'var(--fg-2)' }}>{collector.cpuPercent.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--muted)' }}>Memory</span>
          <span style={{ color: 'var(--fg-2)' }}>{formatBytes(collector.memoryBytes)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--muted)' }}>Events/s</span>
          <span style={{ color: 'var(--fg-2)' }}>{collector.eventsPerSec}</span>
        </div>
      </div>
    </div>
  );
}

export function CollectorPerformance({
  collectors,
  className,
  view = 'grid',
}: CollectorPerformanceProps) {
  const sortedCollectors = useMemo(() => {
    return [...collectors].sort((a, b) => b.cpuPercent - a.cpuPercent);
  }, [collectors]);

  const totalCpu = useMemo(() => {
    return collectors.reduce((sum, c) => sum + c.cpuPercent, 0);
  }, [collectors]);

  const totalMemory = useMemo(() => {
    return collectors.reduce((sum, c) => sum + c.memoryBytes, 0);
  }, [collectors]);

  const totalEvents = useMemo(() => {
    return collectors.reduce((sum, c) => sum + c.eventsPerSec, 0);
  }, [collectors]);

  if (collectors.length === 0) {
    return (
      <div
        className={cn('rounded-xl p-6 text-center', className)}
        style={{ background: 'var(--surface)' }}
      >
        <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} />
        <p style={{ color: 'var(--muted)' }}>No collector data available</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl p-4', className)} style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          Collector Performance
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--emerald-400)' }} />
            <span style={{ color: 'var(--muted)' }}>Total:</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--emerald-400)' }}>
              {totalCpu.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MemoryStick className="w-3.5 h-3.5" style={{ color: 'var(--med)' }} />
            <span className="font-semibold tabular-nums" style={{ color: 'var(--med)' }}>
              {formatBytes(totalMemory)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" style={{ color: 'var(--high)' }} />
            <span className="font-semibold tabular-nums" style={{ color: 'var(--high)' }}>
              {totalEvents}/s
            </span>
          </div>
        </div>
      </div>

      {view === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {sortedCollectors.map((collector) => (
            <CollectorCard key={collector.name} collector={collector} />
          ))}
        </div>
      ) : (
        /* Chart View */
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedCollectors}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 60 }}
            >
              <XAxis
                type="number"
                tick={{ fill: 'var(--subtle)', fontSize: 10 }}
                axisLine={{ stroke: 'var(--hairline)' }}
                tickLine={false}
                domain={[0, 'auto']}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--fg-2)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar
                dataKey="cpuPercent"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              >
                {sortedCollectors.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={COLLECTOR_COLORS[entry.name] || COLLECTOR_COLORS.default}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
