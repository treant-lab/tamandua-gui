import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import type { BackendStatus } from './ComponentStatusDashboard';

interface AgentStoppingInfo {
  reason: string;
  restart_scheduled: boolean;
}

interface BackendStatusDisplayProps {
  backend: BackendStatus;
}

export function BackendStatusDisplay({ backend }: BackendStatusDisplayProps) {
  const { requireAuth } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [operationLoading, setOperationLoading] = useState<'restart' | 'stop' | null>(null);

  // Restart agent handler
  const handleRestartAgent = useCallback(async () => {
    const authed = await requireAuth();
    if (!authed) return;

    const confirmed = await confirm({
      title: 'Restart Agent',
      message: 'This will restart the Tamandua agent. There may be a brief gap in protection.',
      confirmText: 'Restart',
      variant: 'warning',
    });
    if (!confirmed) return;

    setOperationLoading('restart');
    try {
      const result = await invoke<AgentStoppingInfo>('restart_agent');
      toast.info('Agent Restarting', result.reason);
    } catch (err) {
      toast.error('Restart Failed', String(err));
    } finally {
      setOperationLoading(null);
    }
  }, [requireAuth, confirm, toast]);

  // Stop agent handler
  const handleStopAgent = useCallback(async () => {
    const authed = await requireAuth();
    if (!authed) return;

    const confirmed = await confirm({
      title: 'Stop Agent',
      message: 'This will STOP the Tamandua agent completely. The endpoint will be UNPROTECTED until manually restarted. Are you sure?',
      confirmText: 'Stop Agent',
      variant: 'danger',
    });
    if (!confirmed) return;

    setOperationLoading('stop');
    try {
      const result = await invoke<AgentStoppingInfo>('stop_agent');
      toast.warning('Agent Stopping', result.reason);
    } catch (err) {
      toast.error('Stop Failed', String(err));
    } finally {
      setOperationLoading(null);
    }
  }, [requireAuth, confirm, toast]);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid';
      return date.toLocaleTimeString();
    } catch {
      return 'Invalid';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            Backend
          </CardTitle>
          <Badge variant={backend.connected ? 'success' : 'destructive'}>
            {backend.connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Server</span>
            <span className="font-mono text-xs truncate max-w-[180px]">{backend.url}</span>
          </div>
          {backend.latency_ms !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latency</span>
              <span className="font-mono">{backend.latency_ms}ms</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Events Sent</span>
            <span className="font-mono">{formatNumber(backend.events_sent)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Queued</span>
            <span className={`font-mono ${backend.events_queued > 100 ? 'text-warning-500' : ''}`}>
              {formatNumber(backend.events_queued)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Sync</span>
            <span className="font-mono">{formatDate(backend.last_sync_at)}</span>
          </div>
          {backend.error && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
              {backend.error}
            </div>
          )}
          {!backend.connected && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {backend.error ?? 'Backend disconnected or enrollment pending'}
            </p>
          )}

          {/* Agent Control Buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            <Button
              onClick={handleRestartAgent}
              disabled={operationLoading !== null}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {operationLoading === 'restart' ? (
                <>
                  <span className="animate-spin mr-2 w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                  Restarting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restart
                </>
              )}
            </Button>
            <Button
              onClick={handleStopAgent}
              disabled={operationLoading !== null}
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              {operationLoading === 'stop' ? (
                <>
                  <span className="animate-spin mr-2 w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                  Stopping...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Agent
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
