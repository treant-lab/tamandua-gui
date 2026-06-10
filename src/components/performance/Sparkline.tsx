import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  color?: 'green' | 'blue' | 'red' | 'yellow' | 'purple';
  height?: number;
  width?: number;
  showAlert?: boolean;
  alertThreshold?: number;
  className?: string;
  animate?: boolean;
}

const COLOR_MAP = {
  green: {
    stroke: 'var(--emerald-400)',
    fill: 'var(--emerald-glow)',
    alert: 'var(--crit)',
  },
  blue: {
    stroke: 'var(--med)',
    fill: 'rgba(91, 156, 242, 0.1)',
    alert: 'var(--crit)',
  },
  red: {
    stroke: 'var(--crit)',
    fill: 'rgba(240, 80, 110, 0.1)',
    alert: 'var(--crit)',
  },
  yellow: {
    stroke: 'var(--high)',
    fill: 'rgba(245, 165, 36, 0.1)',
    alert: 'var(--crit)',
  },
  purple: {
    stroke: '#a855f7',
    fill: 'rgba(168, 85, 247, 0.1)',
    alert: 'var(--crit)',
  },
};

export function Sparkline({
  data,
  color = 'green',
  height = 32,
  width,
  showAlert = false,
  alertThreshold = 90,
  className,
  animate = true,
}: SparklineProps) {
  const chartData = useMemo(() => {
    return data.map((value, index) => ({ value, index }));
  }, [data]);

  const colors = COLOR_MAP[color];
  const currentValue = data[data.length - 1] || 0;
  const isAlert = showAlert && currentValue > alertThreshold;
  const strokeColor = isAlert ? colors.alert : colors.stroke;

  // Calculate domain for better visualization
  const minValue = Math.min(...data, 0);
  const maxValue = Math.max(...data, 1);
  const padding = (maxValue - minValue) * 0.1;

  if (data.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ height, width: width || '100%' }}
      >
        <div
          className="text-xs"
          style={{ color: 'var(--muted)' }}
        >
          No data
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} style={{ height, width: width || '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis
            domain={[minValue - padding, maxValue + padding]}
            hide
          />
          <defs>
            <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={animate}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Current value indicator dot */}
      {data.length > 0 && (
        <div
          className="absolute right-1 w-1.5 h-1.5 rounded-full"
          style={{
            background: strokeColor,
            top: '50%',
            transform: 'translateY(-50%)',
            boxShadow: `0 0 4px ${strokeColor}`,
          }}
        />
      )}
    </div>
  );
}
