import { type TimeRange } from '@/hooks/usePerformance';
import { cn } from '@/lib/utils';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1min', label: '1m' },
  { value: '5min', label: '5m' },
  { value: '15min', label: '15m' },
  { value: '1hr', label: '1h' },
  { value: '24hr', label: '24h' },
];

export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg p-0.5',
        className
      )}
      style={{ background: 'var(--surface-2)' }}
    >
      {TIME_RANGES.map(({ value: rangeValue, label }) => (
        <button
          key={rangeValue}
          onClick={() => onChange(rangeValue)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            value === rangeValue
              ? 'shadow-sm'
              : 'hover:text-foreground'
          )}
          style={{
            background: value === rangeValue ? 'var(--surface)' : 'transparent',
            color: value === rangeValue ? 'var(--emerald-400)' : 'var(--muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
