import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { platform } from '@tauri-apps/api/os';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DriverStatusDisplay } from './DriverStatusDisplay';
import { CollectorGrid } from './CollectorGrid';
import { BackendStatusDisplay } from './BackendStatusDisplay';
import { PressureLevelDisplay } from './PressureLevelDisplay';
import { HealthStatusDisplay } from './HealthStatusDisplay';
import { WslStatusDisplay } from './WslStatusDisplay';

export interface ComponentStatus {
  driver: DriverStatus;
  collectors: CollectorStatus[];
  backend: BackendStatus;
  pressure_level: PressureLevel;
  health: HealthStatus;
  uptime_seconds: number;
}

export interface DriverStatus {
  loaded: boolean;
  version: string | null;
  /** Total events captured via driver. null until telemetry connects. */
  events_captured: number | null;
  last_event_at: string | null;
  error: string | null;
}

export interface CollectorStatus {
  name: string;
  running: boolean;
  events_per_second: number;
  total_events: number;
  errors: number;
  last_error: string | null;
  cpu_percent: number;
  memory_bytes: number;
}

export interface BackendStatus {
  connected: boolean;
  url: string;
  latency_ms: number | null;
  events_queued: number;
  events_sent: number;
  last_sync_at: string | null;
  error: string | null;
}

export type PressureLevel = 'none' | 'light' | 'moderate' | 'heavy' | 'critical';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  last_check_at: string | null;
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  message: string | null;
}

export function ComponentStatusDashboard() {
  const [status, setStatus] = useState<ComponentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWindows, setIsWindows] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);

  useEffect(() => {
    // Detect platform
    const detectPlatform = async () => {
      try {
        const p = await platform();
        setIsWindows(p === 'win32');
        setIsMac(p === 'darwin');
      } catch {
        // Fallback to navigator check
        setIsWindows(navigator.platform.toLowerCase().includes('win'));
        setIsMac(navigator.platform.toLowerCase().includes('mac'));
      }
    };
    detectPlatform();
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [result, profile] = await Promise.all([
          invoke<ComponentStatus>('get_component_status'),
          invoke<string>('get_performance_profile').catch(() => null),
        ]);
        setStatus(result);
        setActiveProfile(profile);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Connection Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Component Status</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Uptime: {formatUptime(status.uptime_seconds)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PressureLevelDisplay level={status.pressure_level} />
          <Badge variant={status.health.status === 'healthy' ? 'success' : status.health.status === 'degraded' ? 'warning' : 'destructive'}>
            {status.health.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isMac && <DriverStatusDisplay driver={status.driver} />}
        <BackendStatusDisplay backend={status.backend} />
      </div>

      {/* WSL Status - Windows only, poll every 30s to reduce process spawning */}
      {isWindows && <WslStatusDisplay refreshInterval={30000} />}

      <CollectorGrid
        collectors={status.collectors}
        queuedEvents={status.backend.events_queued}
        activeProfile={activeProfile}
      />

      <HealthStatusDisplay health={status.health} />
    </div>
  );
}
