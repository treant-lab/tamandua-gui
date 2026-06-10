import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HealthStatus } from './ComponentStatusDashboard';

interface HealthStatusDisplayProps {
  health: HealthStatus;
}

export function HealthStatusDisplay({ health }: HealthStatusDisplayProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid';
      return date.toLocaleString();
    } catch {
      return 'Invalid';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success' as const;
      case 'degraded':
        return 'warning' as const;
      case 'unhealthy':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Health Checks
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Last check: {formatDate(health.last_check_at)}
            </span>
            <Badge variant={getStatusVariant(health.status)}>
              {health.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {health.checks.map((check) => (
            <div
              key={check.name}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                check.passed
                  ? 'border-success-500/30 bg-success-500/5'
                  : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="flex items-center gap-3">
                {check.passed ? (
                  <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <div>
                  <span className="font-medium capitalize">
                    {check.name.replace(/_/g, ' ')}
                  </span>
                  {check.message && (
                    <p className="text-xs text-muted-foreground">{check.message}</p>
                  )}
                </div>
              </div>
              <Badge variant={check.passed ? 'success' : 'destructive'} className="text-xs">
                {check.passed ? 'PASS' : 'FAIL'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
