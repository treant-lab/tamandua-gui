import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { ensureElevatedForAgentAction } from '@/lib/privileges';
import { usePrivilegeStatus } from '@/hooks/useTauri';

// Types matching the Rust backend
export interface DriverStatusInfo {
  loaded: boolean;
  connected: boolean;
  version: string | null;
  service_name: string;
  driver_path: string | null;
  usermode_fallback: boolean;
  consecutive_failures: number;
  /** Total events captured via driver. null until telemetry connects. */
  events_captured: number | null;
  last_communication: string | null;
  error: string | null;
  install_available: boolean;
}

export interface DriverOperationResult {
  operation: string;
  success: boolean;
  message: string | null;
}

export interface AgentStoppingInfo {
  reason: string;
  restart_scheduled: boolean;
}

export interface AgentStartInfo {
  service_name: string;
  started: boolean;
  message: string;
}

type OperationState = 'idle' | 'loading' | 'success' | 'error';

export function AgentControl() {
  const { requireAuth } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: privilege } = usePrivilegeStatus();
  const isMac = privilege?.platform === 'macos' || privilege?.platform === 'darwin' || /Mac/i.test(navigator.platform);

  const [driverStatus, setDriverStatus] = useState<DriverStatusInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [driverOperation, setDriverOperation] = useState<OperationState>('idle');
  const [agentOperation, setAgentOperation] = useState<OperationState>('idle');

  // Fetch driver status
  const fetchDriverStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await invoke<DriverStatusInfo>('get_driver_status');
      setDriverStatus(status);
    } catch (err) {
      console.error('Failed to fetch driver status:', err);
      setDriverStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchDriverStatus();
    const interval = setInterval(fetchDriverStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchDriverStatus]);

  // Load driver
  const handleLoadDriver = async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Load Kernel Driver',
      message: 'This will load the Tamandua kernel driver for enhanced monitoring capabilities. This requires administrator privileges.',
      confirmText: 'Load Driver',
      variant: 'warning',
    });
    if (!confirmed) return;

    setDriverOperation('loading');
    try {
      const result = await invoke<DriverOperationResult>('load_driver');
      if (result.success) {
        toast.success('Driver Loaded', result.message || 'Kernel driver loaded successfully');
        setDriverOperation('success');
      } else {
        toast.error('Driver Load Failed', result.message || 'Failed to load kernel driver');
        setDriverOperation('error');
      }
      // Refresh status
      await fetchDriverStatus();
    } catch (err) {
      console.error('Failed to load driver:', err);
      toast.error('Driver Load Failed', String(err));
      setDriverOperation('error');
    } finally {
      setTimeout(() => setDriverOperation('idle'), 2000);
    }
  };

  // Unload driver
  const handleUnloadDriver = async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Unload Kernel Driver',
      message: 'This will unload the Tamandua kernel driver. Some monitoring capabilities will be reduced and the agent will fall back to user-mode collection.',
      confirmText: 'Unload Driver',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDriverOperation('loading');
    try {
      const result = await invoke<DriverOperationResult>('unload_driver');
      if (result.success) {
        toast.success('Driver Unloaded', result.message || 'Kernel driver unloaded successfully');
        setDriverOperation('success');
      } else {
        toast.error('Driver Unload Failed', result.message || 'Failed to unload kernel driver');
        setDriverOperation('error');
      }
      // Refresh status
      await fetchDriverStatus();
    } catch (err) {
      console.error('Failed to unload driver:', err);
      toast.error('Driver Unload Failed', String(err));
      setDriverOperation('error');
    } finally {
      setTimeout(() => setDriverOperation('idle'), 2000);
    }
  };

  // Stop agent
  const handleStartAgent = async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Start Agent',
      message: 'This will start the local Tamandua agent service. Administrator privileges are required.',
      confirmText: 'Start Agent',
      variant: 'warning',
    });
    if (!confirmed) return;

    setAgentOperation('loading');
    try {
      const result = await invoke<AgentStartInfo>('start_agent');
      toast.success(
        result.started ? 'Agent Start Requested' : 'Agent Already Running',
        `${result.service_name}: ${result.message}`
      );
      setAgentOperation('success');
      setTimeout(fetchDriverStatus, 2500);
    } catch (err) {
      console.error('Failed to start agent:', err);
      toast.error('Start Failed', String(err));
      setAgentOperation('error');
    } finally {
      setTimeout(() => setAgentOperation('idle'), 2000);
    }
  };

  const handleStopAgent = async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Stop Agent',
      message: 'This will stop the Tamandua agent service. The endpoint will no longer be protected until the agent is restarted. Are you sure?',
      confirmText: 'Stop Agent',
      variant: 'danger',
    });
    if (!confirmed) return;

    setAgentOperation('loading');
    try {
      const result = await invoke<AgentStoppingInfo>('stop_agent');
      toast.warning('Agent Stopping', result.reason);
      setAgentOperation('success');
    } catch (err) {
      console.error('Failed to stop agent:', err);
      toast.error('Stop Failed', String(err));
      setAgentOperation('error');
    } finally {
      setTimeout(() => setAgentOperation('idle'), 2000);
    }
  };

  // Restart agent
  const handleRestartAgent = async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Restart Agent',
      message: 'This will restart the Tamandua agent service. There may be a brief gap in protection during the restart.',
      confirmText: 'Restart Agent',
      variant: 'warning',
    });
    if (!confirmed) return;

    setAgentOperation('loading');
    try {
      const result = await invoke<AgentStoppingInfo>('restart_agent');
      toast.info('Agent Restarting', result.reason);
      setAgentOperation('success');
    } catch (err) {
      console.error('Failed to restart agent:', err);
      toast.error('Restart Failed', String(err));
      setAgentOperation('error');
    } finally {
      setTimeout(() => setAgentOperation('idle'), 2000);
    }
  };

  const getDriverStatusBadge = () => {
    if (!driverStatus) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    if (driverStatus.loaded && driverStatus.connected) {
      return <Badge variant="success">Loaded</Badge>;
    }
    if (driverStatus.loaded && !driverStatus.connected) {
      return <Badge variant="warning">Loaded (Disconnected)</Badge>;
    }
    if (driverStatus.usermode_fallback) {
      return <Badge variant="secondary">User-Mode Fallback</Badge>;
    }
    return <Badge variant="outline">Not Loaded</Badge>;
  };

  return (
    <Card className="border-l-4 border-yellow-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Agent Control
            </CardTitle>
            <CardDescription>
              {isMac ? 'Manage the LaunchDaemon-backed agent service' : 'Manage the kernel driver and agent service'}
            </CardDescription>
          </div>
          {!isMac && getDriverStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Driver Status Section */}
        {!isMac && <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Driver Status</h4>

          {loadingStatus && !driverStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              Loading driver status...
            </div>
          ) : driverStatus ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Service</span>
                <p className="font-mono font-medium">{driverStatus.service_name}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Version</span>
                <p className="font-mono font-medium">{driverStatus.version || 'N/A'}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Events Captured</span>
                <p className="font-mono font-medium">
                  {driverStatus.events_captured !== null
                    ? driverStatus.events_captured.toLocaleString()
                    : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Last Communication</span>
                <p className="font-mono font-medium text-xs">
                  {driverStatus.last_communication
                    ? new Date(driverStatus.last_communication).toLocaleTimeString()
                    : 'Never'}
                </p>
              </div>
              {driverStatus.error && (
                <div className="col-span-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <span className="text-destructive text-sm">{driverStatus.error}</span>
                </div>
              )}
              {driverStatus.usermode_fallback && (
                <div className="col-span-2 p-3 bg-warning-500/10 border border-warning-500/30 rounded-lg">
                  <span className="text-warning-500 text-sm">
                    Running in user-mode fallback. Some monitoring capabilities may be limited.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              Unable to retrieve driver status
            </div>
          )}

          {/* Driver Control Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleLoadDriver}
              disabled={driverOperation === 'loading' || (driverStatus?.loaded ?? false)}
              variant="outline"
              size="sm"
            >
              {driverOperation === 'loading' ? (
                <>
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Load Driver
                </>
              )}
            </Button>
            <Button
              onClick={handleUnloadDriver}
              disabled={driverOperation === 'loading' || !(driverStatus?.loaded ?? false)}
              variant="outline"
              size="sm"
            >
              {driverOperation === 'loading' ? (
                <>
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Unloading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Unload Driver
                </>
              )}
            </Button>
            <Button
              onClick={fetchDriverStatus}
              disabled={loadingStatus}
              variant="ghost"
              size="sm"
            >
              <svg className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>
        </div>}

        {/* Agent Service Section */}
        <div className={`space-y-3 ${isMac ? '' : 'pt-4 border-t border-border'}`}>
          <h4 className="text-sm font-medium text-muted-foreground">{isMac ? 'LaunchDaemon Service' : 'Agent Service'}</h4>
          <p className="text-xs text-muted-foreground">
            {isMac
              ? 'Control the Tamandua LaunchDaemon. macOS asks for administrator authorization only when a privileged service action runs.'
              : 'Control the Tamandua agent service. Stopping the agent will leave this endpoint unprotected.'}
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleStartAgent}
              disabled={agentOperation === 'loading'}
              variant="outline"
              size="sm"
            >
              {agentOperation === 'loading' ? (
                <>
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                  </svg>
                  Start Agent
                </>
              )}
            </Button>
            <Button
              onClick={handleRestartAgent}
              disabled={agentOperation === 'loading'}
              variant="outline"
              size="sm"
            >
              {agentOperation === 'loading' ? (
                <>
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Restarting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restart Agent
                </>
              )}
            </Button>
            <Button
              onClick={handleStopAgent}
              disabled={agentOperation === 'loading'}
              variant="destructive"
              size="sm"
            >
              {agentOperation === 'loading' ? (
                <>
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Stopping...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Agent
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3 bg-warning-500/10 border border-warning-500/30 rounded-lg text-xs text-warning-500">
          {isMac
            ? 'Service actions may trigger the macOS administrator authorization prompt and can temporarily affect endpoint protection.'
            : 'These actions require administrator privileges and may temporarily affect endpoint protection.'}
        </div>
      </CardContent>
    </Card>
  );
}
