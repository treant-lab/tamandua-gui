import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { ensureElevatedForAgentAction } from '@/lib/privileges';
import type { DriverStatus } from './ComponentStatusDashboard';

interface DriverOperationResult {
  operation: string;
  success: boolean;
  message: string | null;
}

interface DriverStatusDisplayProps {
  driver: DriverStatus;
}

export function DriverStatusDisplay({ driver }: DriverStatusDisplayProps) {
  const { requireAuth } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [operationLoading, setOperationLoading] = useState(false);

  // Load driver handler
  const handleLoadDriver = useCallback(async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Load Kernel Driver',
      message: 'Load the Tamandua kernel driver for enhanced monitoring? This requires administrator privileges.',
      confirmText: 'Load Driver',
      variant: 'warning',
    });
    if (!confirmed) return;

    setOperationLoading(true);
    try {
      const result = await invoke<DriverOperationResult>('load_driver');
      if (result.success) {
        toast.success('Driver Loaded', result.message || 'Kernel driver loaded successfully');
      } else {
        toast.error('Load Failed', result.message || 'Failed to load kernel driver');
      }
    } catch (err) {
      toast.error('Load Failed', String(err));
    } finally {
      setOperationLoading(false);
    }
  }, [requireAuth, confirm, toast]);

  // Unload driver handler
  const handleUnloadDriver = useCallback(async () => {
    const authed = await requireAuth();
    if (!authed) return;
    const elevated = await ensureElevatedForAgentAction(confirm, toast);
    if (!elevated) return;

    const confirmed = await confirm({
      title: 'Unload Kernel Driver',
      message: 'Unload the kernel driver? Some monitoring capabilities will be reduced.',
      confirmText: 'Unload',
      variant: 'danger',
    });
    if (!confirmed) return;

    setOperationLoading(true);
    try {
      const result = await invoke<DriverOperationResult>('unload_driver');
      if (result.success) {
        toast.success('Driver Unloaded', result.message || 'Kernel driver unloaded');
      } else {
        toast.error('Unload Failed', result.message || 'Failed to unload driver');
      }
    } catch (err) {
      toast.error('Unload Failed', String(err));
    } finally {
      setOperationLoading(false);
    }
  }, [requireAuth, confirm, toast]);

  const formatNumber = (n: number | null) => {
    if (n === null) return 'N/A';
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            Driver
          </CardTitle>
          <Badge variant={driver.loaded ? 'success' : 'destructive'}>
            {driver.loaded ? 'Loaded' : 'Not Loaded'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {driver.version && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">{driver.version}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Events Captured</span>
            <span className="font-mono">{formatNumber(driver.events_captured)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Event</span>
            <span className="font-mono">{formatDate(driver.last_event_at)}</span>
          </div>
          {driver.error && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
              {driver.error}
            </div>
          )}
          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            {!driver.loaded ? (
              <Button
                onClick={handleLoadDriver}
                disabled={operationLoading}
                variant="default"
                size="sm"
                className="flex-1"
              >
                {operationLoading ? (
                  <>
                    <span className="animate-spin mr-2 w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Load Driver
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleUnloadDriver}
                disabled={operationLoading}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {operationLoading ? (
                  <>
                    <span className="animate-spin mr-2 w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    Unloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Unload Driver
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
