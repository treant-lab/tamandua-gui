import { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { PerformanceDataPoint, PerformanceStats } from '@/hooks/usePerformance';

interface PerformanceChartProps {
  title: string;
  data: PerformanceDataPoint[];
  dataKey: keyof Omit<PerformanceDataPoint, 'timestamp'>;
  stats: PerformanceStats;
  color?: 'green' | 'blue' | 'red' | 'yellow' | 'purple';
  unit?: string;
  formatValue?: (value: number) => string;
  showThreshold?: boolean;
  thresholdValue?: number;
  thresholdLabel?: string;
  height?: number;
  className?: string;
  showArea?: boolean;
  showStats?: boolean;
}

const COLOR_CONFIG = {
  green: {
    stroke: '#2fc471',
    fill: 'rgba(47, 196, 113, 0.15)',
    gradient: ['rgba(47, 196, 113, 0.3)', 'rgba(47, 196, 113, 0.02)'],
    dot: '#2fc471',
    glow: '0 0 8px rgba(47, 196, 113, 0.5)',
  },
  blue: {
    stroke: '#5b9cf2',
    fill: 'rgba(91, 156, 242, 0.15)',
    gradient: ['rgba(91, 156, 242, 0.3)', 'rgba(91, 156, 242, 0.02)'],
    dot: '#5b9cf2',
    glow: '0 0 8px rgba(91, 156, 242, 0.5)',
  },
  red: {
    stroke: '#f0506e',
    fill: 'rgba(240, 80, 110, 0.15)',
    gradient: ['rgba(240, 80, 110, 0.3)', 'rgba(240, 80, 110, 0.02)'],
    dot: '#f0506e',
    glow: '0 0 8px rgba(240, 80, 110, 0.5)',
  },
  yellow: {
    stroke: '#f5a524',
    fill: 'rgba(245, 165, 36, 0.15)',
    gradient: ['rgba(245, 165, 36, 0.3)', 'rgba(245, 165, 36, 0.02)'],
    dot: '#f5a524',
    glow: '0 0 8px rgba(245, 165, 36, 0.5)',
  },
  purple: {
    stroke: '#a855f7',
    fill: 'rgba(168, 85, 247, 0.15)',
    gradient: ['rgba(168, 85, 247, 0.3)', 'rgba(168, 85, 247, 0.02)'],
    dot: '#a855f7',
    glow: '0 0 8px rgba(168, 85, 247, 0.5)',
  },
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${bytes} B/s`;
}

const defaultFormatValue = (value: number, unit?: string): string => {
  if (unit === 'bytes') return formatBytes(value);
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === '/s') return `${Math.round(value)}/s`;
  return value.toFixed(1);
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: PerformanceDataPoint }>;
  label?: number;
  formatValue: (value: number) => string;
  color: string;
}

function CustomTooltip({ active, payload, formatValue, color }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  const timestamp = data.payload.timestamp;

  return (
    <div
      className="px-3 py-2 rounded-lg shadow-lg border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--hairline)',
      }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
        {format(new Date(timestamp), 'HH:mm:ss')}
      </p>
      <p className="text-sm font-semibold" style={{ color }}>
        {formatValue(data.value)}
      </p>
    </div>
  );
}

export function PerformanceChart({
  title,
  data,
  dataKey,
  stats,
  color = 'green',
  unit,
  formatValue,
  showThreshold = false,
  thresholdValue = 90,
  thresholdLabel = 'Threshold',
  height = 200,
  className,
  showArea = true,
  showStats = true,
}: PerformanceChartProps) {
  const colors = COLOR_CONFIG[color];
  const gradientId = `chart-gradient-${dataKey}-${color}`;

  const valueFormatter = useMemo(() => {
    return formatValue || ((v: number) => defaultFormatValue(v, unit));
  }, [formatValue, unit]);

  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      formattedTime: format(new Date(point.timestamp), 'HH:mm'),
    }));
  }, [data]);

  const domain = useMemo(() => {
    const values = data.map(d => d[dataKey] as number);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const padding = (max - min) * 0.15;
    return [Math.max(0, min - padding), max + padding];
  }, [data, dataKey]);

  return (
    <div className={cn('rounded-xl p-4', className)} style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: colors.stroke }}
          >
            {valueFormatter(stats.current)}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.gradient[0]} />
                <stop offset="100%" stopColor={colors.gradient[1]} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--hairline)"
              vertical={false}
            />

            <XAxis
              dataKey="formattedTime"
              tick={{ fill: 'var(--subtle)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--hairline)' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            <YAxis
              domain={domain}
              tick={{ fill: 'var(--subtle)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(value) => {
                if (unit === 'bytes') {
                  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)}M`;
                  if (value >= 1024) return `${(value / 1024).toFixed(0)}K`;
                  return `${value}`;
                }
                return value.toFixed(0);
              }}
            />

            <Tooltip
              content={
                <CustomTooltip
                  formatValue={valueFormatter}
                  color={colors.stroke}
                />
              }
            />

            {showThreshold && (
              <ReferenceLine
                y={thresholdValue}
                stroke="var(--crit)"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{
                  value: thresholdLabel,
                  position: 'right',
                  fill: 'var(--crit)',
                  fontSize: 10,
                }}
              />
            )}

            {showArea && (
              <Area
                type="monotone"
                dataKey={dataKey}
                fill={`url(#${gradientId})`}
                stroke="none"
                isAnimationActive={true}
                animationDuration={500}
              />
            )}

            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={colors.stroke}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: colors.dot,
                stroke: 'var(--surface)',
                strokeWidth: 2,
                style: { boxShadow: colors.glow },
              }}
              isAnimationActive={true}
              animationDuration={500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      {showStats && (
        <div
          className="mt-4 pt-4 grid grid-cols-3 gap-4 text-center"
          style={{ borderTop: '1px solid var(--hairline)' }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
              Min
            </p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--fg-2)' }}>
              {valueFormatter(stats.min)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
              Avg
            </p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--fg-2)' }}>
              {valueFormatter(stats.avg)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
              Max
            </p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--fg-2)' }}>
              {valueFormatter(stats.max)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
