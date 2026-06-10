import { Badge } from '@/components/ui/badge';
import type { PressureLevel } from './ComponentStatusDashboard';

interface PressureLevelDisplayProps {
  level: PressureLevel;
}

export function PressureLevelDisplay({ level }: PressureLevelDisplayProps) {
  const getConfig = (level: PressureLevel) => {
    switch (level) {
      case 'none':
        return {
          label: 'Normal',
          variant: 'success' as const,
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
        };
      case 'light':
        return {
          label: 'Light Pressure',
          variant: 'success' as const,
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        };
      case 'moderate':
        return {
          label: 'Moderate Pressure',
          variant: 'warning' as const,
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
      case 'heavy':
        return {
          label: 'Heavy Pressure',
          variant: 'warning' as const,
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'critical':
        return {
          label: 'Critical Pressure',
          variant: 'destructive' as const,
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
    }
  };

  const config = getConfig(level);

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}
