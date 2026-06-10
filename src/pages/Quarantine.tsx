import { useState, useMemo } from 'react';
import {
  Shield,
  Archive,
  HardDrive,
  Calendar,
  AlertTriangle,
  BarChart2,
  List,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import clsx from 'clsx';
import { formatBytes } from '../lib/utils';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import {
  useQuarantineVaultStats,
  useQuarantinedFiles,
  useQuarantineStatistics,
  useRestoreFile,
  useDeleteQuarantinedFile,
  useBulkDeleteQuarantined,
  useDeleteExpiredFiles,
  useSubmitToVirusTotal,
  useExportQuarantinedFile,
  useGetFileHexDump,
  useExportQuarantineReport,
  type QuarantinedFile,
  type QuarantineFilter,
} from '../hooks/useQuarantine';
import {
  QuarantineList,
  QuarantineDetails,
  QuarantineStats,
  QuarantineActions,
  HexViewer,
} from '../components/quarantine';

type Tab = 'files' | 'statistics';

export function Quarantine() {
  // State
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [filter, setFilter] = useState<QuarantineFilter>({ limit: 50 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<QuarantinedFile | null>(null);
  const [hexViewerFileId, setHexViewerFileId] = useState<string | null>(null);

  // UI hooks
  const toast = useToast();
  const confirm = useConfirm();

  // Queries
  const { data: vaultStats, isLoading: isLoadingStats } = useQuarantineVaultStats();
  const { data: files, isLoading: isLoadingFiles } = useQuarantinedFiles(filter);
  const { data: statistics, isLoading: isLoadingStatistics } = useQuarantineStatistics(30);

  // Mutations
  const restoreFile = useRestoreFile();
  const deleteFile = useDeleteQuarantinedFile();
  const bulkDelete = useBulkDeleteQuarantined();
  const deleteExpired = useDeleteExpiredFiles();
  const submitVT = useSubmitToVirusTotal();
  const exportFile = useExportQuarantinedFile();
  const getHexDump = useGetFileHexDump();
  const exportReport = useExportQuarantineReport();

  // Calculate expired count
  const expiredCount = useMemo(() => {
    if (!files) return 0;
    return files.filter((f) => {
      try {
        const expiresAt = parseISO(f.expires_at);
        if (isNaN(expiresAt.getTime())) return false;
        return differenceInDays(expiresAt, new Date()) <= 0;
      } catch {
        return false;
      }
    }).length;
  }, [files]);

  // Find hex viewer file
  const hexViewerFile = useMemo(() => {
    if (!hexViewerFileId || !files) return null;
    return files.find((f) => f.id === hexViewerFileId);
  }, [hexViewerFileId, files]);

  // Handlers
  const handleRestore = async (fileId: string, options: { path?: string; scanAfter: boolean }) => {
    try {
      await restoreFile.mutateAsync({
        file_id: fileId,
        restore_path: options.path,
        scan_after_restore: options.scanAfter,
      });
      setSelectedFile(null);
      toast.success('File restored', 'The file has been restored successfully');
    } catch (error) {
      console.error('Failed to restore file:', error);
      toast.error('Restore failed', String(error));
    }
  };

  const handleDelete = async (fileId: string) => {
    const confirmed = await confirm({
      title: 'Delete File Permanently',
      message: 'This action cannot be undone. The file will be permanently deleted from the quarantine vault.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteFile.mutateAsync(fileId);
      setSelectedFile(null);
      toast.success('File deleted', 'The file has been permanently deleted');
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Delete failed', String(error));
    }
  };

  const handleSubmitVT = async (fileId: string) => {
    try {
      const result = await submitVT.mutateAsync(fileId);
      toast.success(
        'Submitted to VirusTotal',
        `Detections: ${result.positives}/${result.total}`
      );
    } catch (error) {
      console.error('Failed to submit to VirusTotal:', error);
      toast.error('VirusTotal submission failed', String(error));
    }
  };

  const handleExport = async (fileId: string) => {
    try {
      const savePath = await save({
        defaultPath: `quarantined_file_${fileId}`,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });

      if (!savePath) return;

      await exportFile.mutateAsync({ fileId, exportPath: savePath });
      toast.success('File exported', savePath);
    } catch (error) {
      console.error('Failed to export file:', error);
      toast.error('Export failed', String(error));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirm({
      title: 'Delete Selected Files',
      message: `Are you sure you want to permanently delete ${selectedIds.size} file(s)? This action cannot be undone.`,
      confirmText: 'Delete All',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const result = await bulkDelete.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      toast.success(
        'Files deleted',
        `${result.success_count} deleted, ${result.failed_count} failed`
      );
    } catch (error) {
      console.error('Failed to delete selected files:', error);
      toast.error('Delete failed', String(error));
    }
  };

  const handleDeleteExpired = async () => {
    const confirmed = await confirm({
      title: 'Delete Expired Files',
      message: 'This will permanently delete all files that have exceeded their retention period. Continue?',
      confirmText: 'Delete Expired',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      const result = await deleteExpired.mutateAsync();
      toast.success(
        'Expired files deleted',
        `${result.success_count} deleted, ${result.failed_count} failed`
      );
    } catch (error) {
      console.error('Failed to delete expired files:', error);
      toast.error('Delete failed', String(error));
    }
  };

  const handleExportReport = async (format: 'csv' | 'json') => {
    try {
      const savePath = await save({
        defaultPath: `quarantine_report_${Date.now()}.${format}`,
        filters: [
          format === 'csv'
            ? { name: 'CSV', extensions: ['csv'] }
            : { name: 'JSON', extensions: ['json'] },
        ],
      });

      if (!savePath) return;

      const data = await exportReport.mutateAsync({ format, filter });
      await writeTextFile(savePath, data);
      toast.success('Report exported', savePath);
    } catch (error) {
      console.error('Failed to export report:', error);
      toast.error('Export failed', String(error));
    }
  };

  const handleLoadHex = async (fileId: string, offset: number, length: number) => {
    return getHexDump.mutateAsync({ fileId, offset, length });
  };

  return (
    <div className="sentinel-page space-y-6">
      {/* Header */}
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Containment · Vault</div>
          <h1 className="flex items-center gap-3">
            <Archive className="w-7 h-7" style={{ color: 'var(--high)' }} />
            <span>Quarantine Manager</span>
          </h1>
          <p>Manage quarantined files and view vault statistics</p>
        </div>
      </div>

      {/* Vault Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VaultCard
          title="Total Files"
          value={vaultStats?.total_files ?? 0}
          icon={Shield}
          color="blue"
          isLoading={isLoadingStats}
        />
        <VaultCard
          title="Vault Size"
          value={vaultStats ? `${formatBytes(vaultStats.total_size_bytes)} / ${formatBytes(vaultStats.max_size_bytes)}` : '-'}
          icon={HardDrive}
          color="purple"
          isLoading={isLoadingStats}
          progress={vaultStats ? (vaultStats.total_size_bytes / vaultStats.max_size_bytes) * 100 : 0}
        />
        <VaultCard
          title="Oldest File"
          value={
            vaultStats?.oldest_file_date
              ? format(parseISO(vaultStats.oldest_file_date), 'MMM d, yyyy')
              : 'N/A'
          }
          icon={Calendar}
          color="green"
          isLoading={isLoadingStats}
        />
        <VaultCard
          title="Expiring Soon"
          value={vaultStats?.files_expiring_soon ?? 0}
          icon={AlertTriangle}
          color={vaultStats && vaultStats.files_expiring_soon > 0 ? 'orange' : 'gray'}
          isLoading={isLoadingStats}
          subtitle="< 7 days"
        />
      </div>

      {/* Severity Breakdown */}
      {vaultStats && (
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'color-mix(in srgb, var(--fg) 10%, transparent)',
          }}
        >
          <h2
            className="text-sm font-medium uppercase tracking-wider mb-3"
            style={{ color: 'var(--muted)' }}
          >
            Files by Severity
          </h2>
          <div className="flex space-x-4">
            <SeverityBadge label="Critical" count={vaultStats.files_by_severity.critical} color="crit" />
            <SeverityBadge label="High" count={vaultStats.files_by_severity.high} color="high" />
            <SeverityBadge label="Medium" count={vaultStats.files_by_severity.medium} color="medium" />
            <SeverityBadge label="Low" count={vaultStats.files_by_severity.low} color="low" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="border-b"
        style={{ borderColor: 'color-mix(in srgb, var(--fg) 15%, transparent)' }}
      >
        <div className="flex space-x-8">
          <TabButton
            active={activeTab === 'files'}
            onClick={() => setActiveTab('files')}
            icon={List}
            label="Quarantined Files"
          />
          <TabButton
            active={activeTab === 'statistics'}
            onClick={() => setActiveTab('statistics')}
            icon={BarChart2}
            label="Statistics"
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'files' ? (
        <div className="space-y-4">
          {/* Bulk Actions */}
          <QuarantineActions
            selectedCount={selectedIds.size}
            expiredCount={expiredCount}
            onDeleteSelected={handleDeleteSelected}
            onDeleteExpired={handleDeleteExpired}
            onExportReport={handleExportReport}
            isDeletingSelected={bulkDelete.isPending}
            isDeletingExpired={deleteExpired.isPending}
            isExporting={exportReport.isPending}
          />

          {/* Files List */}
          <QuarantineList
            files={files || []}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onFileSelect={setSelectedFile}
            filter={filter}
            onFilterChange={setFilter}
            isLoading={isLoadingFiles}
          />
        </div>
      ) : (
        <QuarantineStats statistics={statistics} isLoading={isLoadingStatistics} />
      )}

      {/* File Details Panel */}
      {selectedFile && (
        <QuarantineDetails
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onSubmitVT={handleSubmitVT}
          onExport={handleExport}
          onViewHex={(fileId) => setHexViewerFileId(fileId)}
          isRestoring={restoreFile.isPending}
          isDeleting={deleteFile.isPending}
          isSubmittingVT={submitVT.isPending}
        />
      )}

      {/* Hex Viewer */}
      {hexViewerFile && (
        <HexViewer
          fileId={hexViewerFile.id}
          filename={hexViewerFile.filename}
          onClose={() => setHexViewerFileId(null)}
          onLoadHex={handleLoadHex}
        />
      )}
    </div>
  );
}

interface VaultCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'gray';
  isLoading?: boolean;
  progress?: number;
  subtitle?: string;
}

function VaultCard({ title, value, icon: Icon, color, isLoading, progress, subtitle }: VaultCardProps) {
  const iconColors: Record<string, string> = {
    blue: 'var(--info)',
    purple: 'var(--purple-400, #a78bfa)',
    green: 'var(--emerald-400)',
    orange: 'var(--high)',
    gray: 'var(--muted)',
  };

  const progressColors: Record<string, string> = {
    blue: 'var(--info)',
    purple: 'var(--purple-400, #a78bfa)',
    green: 'var(--emerald-400)',
    orange: 'var(--high)',
    gray: 'var(--muted)',
  };

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'color-mix(in srgb, var(--fg) 10%, transparent)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{title}</p>
          {isLoading ? (
            <div
              className="h-8 w-24 animate-pulse rounded mt-1"
              style={{ backgroundColor: 'color-mix(in srgb, var(--fg) 20%, transparent)' }}
            />
          ) : (
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--fg)' }}>{value}</p>
          )}
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: 'var(--fg-2)' }}>{subtitle}</p>
          )}
          {progress !== undefined && (
            <div
              className="mt-2 w-full rounded-full h-1.5"
              style={{ backgroundColor: 'color-mix(in srgb, var(--fg) 15%, transparent)' }}
            >
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: progressColors[color],
                }}
              />
            </div>
          )}
        </div>
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: `color-mix(in srgb, ${iconColors[color]} 15%, transparent)`,
            borderColor: `color-mix(in srgb, ${iconColors[color]} 30%, transparent)`,
            color: iconColors[color],
          }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColors[color] }} />
        </div>
      </div>
    </div>
  );
}

interface SeverityBadgeProps {
  label: string;
  count: number;
  color: 'crit' | 'high' | 'medium' | 'low';
}

function SeverityBadge({ label, count, color }: SeverityBadgeProps) {
  const colorMap: Record<string, string> = {
    crit: 'var(--crit)',
    high: 'var(--high)',
    medium: 'var(--medium)',
    low: 'var(--info)',
  };

  const severityColor = colorMap[color];

  return (
    <div
      className="flex items-center space-x-2 px-3 py-2 rounded-lg border"
      style={{
        backgroundColor: `color-mix(in srgb, ${severityColor} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${severityColor} 30%, transparent)`,
        color: severityColor,
      }}
    >
      <span className="text-sm">{label}:</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
}

function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center space-x-2 pb-4 border-b-2 transition-colors'
      )}
      style={{
        borderColor: active ? 'var(--primary)' : 'transparent',
        color: active ? 'var(--fg)' : 'var(--muted)',
      }}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

export default Quarantine;
