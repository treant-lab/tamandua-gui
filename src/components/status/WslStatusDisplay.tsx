import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface WslStatus {
  available: boolean;
  installed: boolean;
  running: boolean;
  version: string | null;
  kernel_version: string | null;
  default_distro: string | null;
  distros: WslDistro[];
  error: string | null;
}

export interface WslDistro {
  name: string;
  state: string;
  version: number;
  is_default: boolean;
}

interface WslStatusDisplayProps {
  refreshInterval?: number;
}

export function WslStatusDisplay({ refreshInterval = 5000 }: WslStatusDisplayProps) {
  const [status, setStatus] = useState<WslStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await invoke<WslStatus>('get_wsl_status');
        setStatus(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (loading && !status) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <WslIcon />
            WSL Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !status) {
    return (
      <Card className="border-destructive">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <WslIcon />
            WSL Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  // Don't render if WSL is not available (non-Windows)
  if (!status.available && status.error?.includes('only available on Windows')) {
    return null;
  }

  const getOverallStatus = () => {
    if (!status.available) return { label: 'Not Available', variant: 'secondary' as const };
    if (!status.installed) return { label: 'Not Installed', variant: 'secondary' as const };
    if (status.running) return { label: 'Running', variant: 'success' as const };
    return { label: 'Stopped', variant: 'warning' as const };
  };

  const overallStatus = getOverallStatus();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <WslIcon />
            WSL Status
          </CardTitle>
          <Badge variant={overallStatus.variant}>
            {overallStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          {/* Version Info */}
          {status.version && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">WSL Version</span>
              <span className="font-mono">{status.version}</span>
            </div>
          )}
          {status.kernel_version && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kernel</span>
              <span className="font-mono text-xs">{status.kernel_version}</span>
            </div>
          )}

          {/* Distros */}
          {status.distros.length > 0 && (
            <div className="mt-3">
              <div className="text-muted-foreground mb-2">Distributions</div>
              <div className="space-y-2">
                {status.distros.map((distro) => (
                  <div
                    key={distro.name}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{distro.name}</span>
                      {distro.is_default && (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        WSL{distro.version}
                      </Badge>
                    </div>
                    <Badge
                      variant={distro.state === 'Running' ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {distro.state}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No distros message */}
          {status.installed && status.distros.length === 0 && (
            <div className="p-2 bg-muted/50 rounded text-muted-foreground text-center">
              No distributions installed
            </div>
          )}

          {/* Error message */}
          {status.error && !status.error.includes('only available on Windows') && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
              {status.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WslIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {/* Linux/Penguin icon for WSL */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 2C9.24 2 7 4.24 7 7v2c0 1.1-.9 2-2 2v2c1.1 0 2 .9 2 2v2c0 2.76 2.24 5 5 5s5-2.24 5-5v-2c0-1.1.9-2 2-2v-2c-1.1 0-2-.9-2-2V7c0-2.76-2.24-5-5-5z"
      />
      <circle cx="10" cy="8" r="1" fill="currentColor" />
      <circle cx="14" cy="8" r="1" fill="currentColor" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
    </svg>
  );
}
