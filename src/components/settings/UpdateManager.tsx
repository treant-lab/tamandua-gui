import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface UpdateInfo {
  update_available: boolean;
  current_version: string;
  latest_version: string | null;
  release_notes: string | null;
  download_size: number | null;
}

export interface UpdateProgress {
  version: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'ready' | 'error';

export function UpdateManager() {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  // Listen for update events
  useEffect(() => {
    const listeners = [
      listen<UpdateInfo>('update-check-result', (event) => {
        setUpdateInfo(event.payload);
        setUpdateState(event.payload.update_available ? 'available' : 'idle');
      }),
      listen<UpdateProgress>('update-progress', (event) => {
        setProgress(event.payload);
        setUpdateState('downloading');
      }),
      listen<{ version: string }>('update-installing', () => {
        setUpdateState('installing');
      }),
      listen<{ version: string; requires_restart: boolean }>('update-ready', () => {
        setUpdateState('ready');
      }),
      listen<{ message: string; recoverable: boolean }>('update-error', (event) => {
        setError(event.payload.message);
        setUpdateState('error');
      }),
    ];

    return () => {
      listeners.forEach((unlisten) => unlisten.then((fn) => fn()));
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    setUpdateState('checking');
    setError(null);
    try {
      const result = await invoke<UpdateInfo>('check_for_updates');
      setUpdateInfo(result);
      setUpdateState(result.update_available ? 'available' : 'idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUpdateState('error');
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    setUpdateState('downloading');
    setError(null);
    try {
      await invoke('download_update');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUpdateState('error');
    }
  }, []);

  // installUpdate is called automatically by the agent after download completes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _installUpdate = useCallback(async () => {
    setUpdateState('installing');
    setError(null);
    try {
      await invoke('install_update');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUpdateState('error');
    }
  }, []);

  const restartApp = useCallback(async () => {
    try {
      await invoke('restart_app');
    } catch (err) {
      console.error('Failed to restart:', err);
    }
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = () => {
    switch (updateState) {
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
      case 'available':
        return <Badge variant="warning">Update Available</Badge>;
      case 'downloading':
        return <Badge variant="secondary">Downloading...</Badge>;
      case 'installing':
        return <Badge variant="secondary">Installing...</Badge>;
      case 'ready':
        return <Badge variant="success">Ready to Restart</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="success">Up to Date</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Agent Updates
              </CardTitle>
              <CardDescription>
                Check, download, and apply updates for the local Tamandua agent service
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Version */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <span className="text-sm text-muted-foreground">Agent Version</span>
              <p className="font-mono font-medium">{updateInfo?.current_version || '0.1.0'}</p>
            </div>
            {updateInfo?.latest_version && updateInfo.update_available && (
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Available Version</span>
                <p className="font-mono font-medium text-primary">{updateInfo.latest_version}</p>
              </div>
            )}
          </div>

          {/* Download Progress */}
          {updateState === 'downloading' && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Downloading v{progress.version}</span>
                <span>{formatBytes(progress.downloaded_bytes)} / {formatBytes(progress.total_bytes)}</span>
              </div>
              <Progress value={progress.percent} />
            </div>
          )}

          {/* Installing */}
          {updateState === 'installing' && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <div className="animate-spin">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <span>Installing update...</span>
            </div>
          )}

          {/* Ready to Restart */}
          {updateState === 'ready' && (
            <div className="p-3 bg-success-500/10 border border-success-500/30 rounded-lg">
              <p className="text-sm text-success-500 font-medium mb-2">
                Update installed successfully! Restart to apply changes.
              </p>
            </div>
          )}

          {/* Error */}
          {updateState === 'error' && error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Release Notes */}
          {updateInfo?.release_notes && updateState === 'available' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReleaseNotes(true)}
              className="w-full"
            >
              View Release Notes
            </Button>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {updateState === 'checking' ? (
              <Button disabled className="flex-1">
                <span className="animate-spin mr-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </span>
                Checking...
              </Button>
            ) : (updateState === 'idle' || updateState === 'error') ? (
              <Button onClick={checkForUpdates} className="flex-1">
                Check for Updates
              </Button>
            ) : null}

            {updateState === 'available' && (
              <Button onClick={downloadUpdate} className="flex-1">
                Download Update
                {updateInfo?.download_size && (
                  <span className="ml-2 text-xs opacity-70">
                    ({formatBytes(updateInfo.download_size)})
                  </span>
                )}
              </Button>
            )}

            {updateState === 'ready' && (
              <Button onClick={restartApp} className="flex-1">
                Restart GUI
              </Button>
            )}
          </div>

          <div className="space-y-1 text-center">
            <p className="text-xs text-muted-foreground">
              Agent updates are signed and verified before installation.
            </p>
            <p className="text-xs text-muted-foreground">
              This panel manages the local agent service. GUI self-update uses the separate Tauri updater feed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Release Notes Dialog */}
      <Dialog open={showReleaseNotes} onOpenChange={setShowReleaseNotes}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>What's New in v{updateInfo?.latest_version}</DialogTitle>
            <DialogDescription>Release notes and changes</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[300px] overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert">
              {updateInfo?.release_notes || 'No release notes available.'}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseNotes(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowReleaseNotes(false);
              downloadUpdate();
            }}>
              Download Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
