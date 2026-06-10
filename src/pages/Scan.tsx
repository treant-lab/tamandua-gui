import { useState } from 'react';
import { useStartScan, useScanStatus, useCancelScan, useScanProgressListener } from '../hooks/useTauri';
import { Search, FolderOpen, PlayCircle, XCircle } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { formatDateSafe } from '../utils/dateUtils';
import { useToast } from '../components/Toast';
import clsx from 'clsx';

export function Scan() {
  const [scanPath, setScanPath] = useState('');
  const [recursive, setRecursive] = useState(true);
  const [scanType, setScanType] = useState<'quick' | 'full' | 'custom'>('quick');
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  const startScan = useStartScan();
  const { data: scanResult } = useScanStatus(activeScanId);
  const cancelScan = useCancelScan();
  const toast = useToast();

  useScanProgressListener((progress) => {
    console.log('Scan progress:', progress);
  });

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      }) as string;

      if (selected) {
        setScanPath(selected);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleStartScan = async () => {
    if (!scanPath) {
      toast.warning('No path selected', 'Please select a directory to scan');
      return;
    }

    try {
      await startScan.mutateAsync({
        path: scanPath,
        recursive,
        scanType,
      });
      setActiveScanId(null);
      toast.info('Scan started', scanPath);
    } catch (error) {
      console.error('Failed to start scan:', error);
      toast.error('Failed to start scan', String(error));
    }
  };

  const handleCancelScan = async () => {
    if (!activeScanId) return;

    try {
      await cancelScan.mutateAsync(activeScanId);
      setActiveScanId(null);
      toast.info('Scan cancelled');
    } catch (error) {
      console.error('Failed to cancel scan:', error);
      toast.error('Failed to cancel scan', String(error));
    }
  };

  const isScanning = scanResult?.status === 'running';
  const scanComplete = scanResult?.status === 'completed';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--fg)' }}>Scan</h1>
        <p className="mt-1" style={{ color: 'var(--muted)' }}>
          On-demand malware scanning
        </p>
      </div>

      {/* Scan Configuration */}
      <div
        className="rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--fg)' }}>
          Scan Configuration
        </h2>

        <div className="space-y-4">
          {/* Path Selection */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg)' }}>
              Scan Path
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                placeholder="/path/to/scan"
                className="flex-1 rounded-lg px-3 py-2 border transition-colors focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--fg)',
                }}
                disabled={isScanning}
              />
              <button
                onClick={handleBrowse}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--fg)',
                }}
                disabled={isScanning}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Browse</span>
              </button>
            </div>
          </div>

          {/* Scan Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg)' }}>
              Scan Type
            </label>
            <div className="grid grid-cols-3 gap-4">
              <ScanTypeOption
                value="quick"
                selected={scanType === 'quick'}
                onSelect={() => setScanType('quick')}
                title="Quick Scan"
                description="Scan common locations"
                disabled={isScanning}
              />
              <ScanTypeOption
                value="full"
                selected={scanType === 'full'}
                onSelect={() => setScanType('full')}
                title="Full Scan"
                description="Complete system scan"
                disabled={isScanning}
              />
              <ScanTypeOption
                value="custom"
                selected={scanType === 'custom'}
                onSelect={() => setScanType('custom')}
                title="Custom Scan"
                description="User-defined path"
                disabled={isScanning}
              />
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--emerald-400)' }}
                disabled={isScanning}
              />
              <span className="text-sm">Scan subdirectories recursively</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            {!isScanning ? (
              <button
                onClick={handleStartScan}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: 'var(--emerald-400)',
                  color: 'var(--bg)',
                }}
                disabled={startScan.isPending}
              >
                <PlayCircle className="w-5 h-5" />
                <span>Start Scan</span>
              </button>
            ) : (
              <button
                onClick={handleCancelScan}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: 'var(--crit)',
                  color: 'white',
                }}
                disabled={cancelScan.isPending}
              >
                <XCircle className="w-5 h-5" />
                <span>Cancel Scan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scan Progress */}
      {scanResult && (
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--fg)' }}>
            Scan Progress
          </h2>

          {/* Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Status</span>
              <StatusBadge status={scanResult.status} />
            </div>

            {/* Progress Bar */}
            {isScanning && (
              <div
                className="w-full rounded-full h-3"
                style={{ backgroundColor: 'var(--bg)' }}
              >
                <div
                  className="h-3 rounded-full transition-all animate-pulse"
                  style={{
                    width: '50%',
                    backgroundColor: 'var(--emerald-400)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatItem
              label="Files Scanned"
              value={scanResult.files_scanned.toLocaleString()}
            />
            <StatItem
              label="Threats Found"
              value={scanResult.threats_found.toLocaleString()}
              highlight={scanResult.threats_found > 0}
            />
            <StatItem
              label="Started At"
              value={formatDateSafe(scanResult.started_at, 'p')}
            />
            <StatItem
              label="Duration"
              value={
                scanResult.completed_at
                  ? formatDurationSafe(scanResult.started_at, scanResult.completed_at)
                  : 'In progress'
              }
            />
          </div>

          {/* Findings */}
          {scanResult.findings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--fg)' }}>
                Threats Detected ({scanResult.findings.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scanResult.findings.map((finding, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--crit)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <SeverityBadge severity={finding.severity} />
                          <span className="font-medium" style={{ color: 'var(--fg)' }}>
                            {finding.threat_name}
                          </span>
                        </div>
                        <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                          {finding.file_path}
                        </p>
                        <div className="flex items-center space-x-4 text-xs" style={{ color: 'var(--muted)' }}>
                          <span>Method: {finding.detection_method}</span>
                          <span>SHA256: {finding.sha256.substring(0, 16)}...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scanComplete && scanResult.findings.length === 0 && (
            <div
              className="text-center py-8 rounded-lg border"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--emerald-400) 10%, transparent)',
                borderColor: 'var(--emerald-400)',
              }}
            >
              <Search className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--emerald-400)' }} />
              <p className="font-medium" style={{ color: 'var(--emerald-400)' }}>
                No threats detected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ScanTypeOptionProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  disabled: boolean;
}

function ScanTypeOption({
  selected,
  onSelect,
  title,
  description,
  disabled,
}: ScanTypeOptionProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={clsx(
        'p-4 rounded-lg border-2 transition-colors text-left',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={{
        backgroundColor: selected
          ? 'color-mix(in srgb, var(--emerald-400) 15%, transparent)'
          : 'var(--bg)',
        borderColor: selected ? 'var(--emerald-400)' : 'var(--border)',
      }}
    >
      <div className="font-medium mb-1" style={{ color: 'var(--fg)' }}>{title}</div>
      <div className="text-sm" style={{ color: 'var(--muted)' }}>{description}</div>
    </button>
  );
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      <div
        className="text-2xl font-bold"
        style={{ color: highlight ? 'var(--crit)' : 'var(--fg)' }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = () => {
    switch (status) {
      case 'running':
        return {
          backgroundColor: 'color-mix(in srgb, var(--info) 20%, transparent)',
          color: 'var(--info)',
        };
      case 'completed':
        return {
          backgroundColor: 'color-mix(in srgb, var(--emerald-400) 20%, transparent)',
          color: 'var(--emerald-400)',
        };
      case 'failed':
        return {
          backgroundColor: 'color-mix(in srgb, var(--crit) 20%, transparent)',
          color: 'var(--crit)',
        };
      case 'cancelled':
        return {
          backgroundColor: 'color-mix(in srgb, var(--muted) 20%, transparent)',
          color: 'var(--muted)',
        };
      default:
        return {
          backgroundColor: 'var(--surface)',
          color: 'var(--muted)',
        };
    }
  };

  return (
    <span
      className="px-2 py-1 rounded-md text-xs font-medium"
      style={getStatusStyle()}
    >
      {status.toUpperCase()}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const getSeverityStyle = () => {
    switch (severity) {
      case 'critical':
        return {
          backgroundColor: 'color-mix(in srgb, var(--crit) 20%, transparent)',
          color: 'var(--crit)',
        };
      case 'high':
        return {
          backgroundColor: 'color-mix(in srgb, var(--high) 20%, transparent)',
          color: 'var(--high)',
        };
      case 'medium':
        return {
          backgroundColor: 'color-mix(in srgb, var(--med) 20%, transparent)',
          color: 'var(--med)',
        };
      case 'low':
        return {
          backgroundColor: 'color-mix(in srgb, var(--low) 20%, transparent)',
          color: 'var(--low)',
        };
      default:
        return {
          backgroundColor: 'color-mix(in srgb, var(--info) 20%, transparent)',
          color: 'var(--info)',
        };
    }
  };

  return (
    <span
      className="px-2 py-1 rounded-md text-xs font-medium"
      style={getSeverityStyle()}
    >
      {severity.toUpperCase()}
    </span>
  );
}

function formatDurationSafe(startValue: string | null | undefined, endValue: string | null | undefined): string {
  if (!startValue || !endValue) return '-';
  try {
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';

    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  } catch {
    return '-';
  }
}
