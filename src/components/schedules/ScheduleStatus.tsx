import {
  Schedule,
  ScheduleHistory,
  useScheduleHistory,
  useScheduleRunningStatus,
  useCancelScheduledScan,
} from '../../hooks/useSchedules';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  File,
  Bug,
  StopCircle,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInSeconds } from 'date-fns';
import clsx from 'clsx';

// Safe date formatting helpers
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDateSafe(dateStr: string | null | undefined, formatStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  try {
    return format(date, formatStr);
  } catch {
    return '-';
  }
}

function formatDistanceSafe(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '-';
  }
}

function calculateDurationSafe(startStr: string | null | undefined, endStr: string | null | undefined): number | null {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return null;
  try {
    return differenceInSeconds(end, start) * 1000;
  } catch {
    return null;
  }
}

interface ScheduleStatusProps {
  schedule: Schedule;
}

export function ScheduleStatus({ schedule }: ScheduleStatusProps) {
  const { data: history } = useScheduleHistory(schedule.id, 10);
  const { data: runningStatus } = useScheduleRunningStatus(schedule.id);
  const cancelScan = useCancelScheduledScan();

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this scan?')) {
      return;
    }

    try {
      await cancelScan.mutateAsync(schedule.id);
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Running Status */}
      {runningStatus && (
        <div className="card bg-blue-900/20 border border-blue-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-800 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold">Scan in Progress</h3>
                <p className="text-sm text-gray-400">
                  Started {formatDistanceSafe(runningStatus.started_at)}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="btn-secondary flex items-center space-x-2"
              disabled={cancelScan.isPending}
            >
              <StopCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{Math.round(runningStatus.progress_percent)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${runningStatus.progress_percent}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {runningStatus.files_scanned.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Files Scanned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300">
                {runningStatus.total_files.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Total Files</div>
            </div>
            <div className="text-center">
              <div
                className={clsx(
                  'text-2xl font-bold',
                  runningStatus.threats_found > 0
                    ? 'text-red-400'
                    : 'text-green-400'
                )}
              >
                {runningStatus.threats_found}
              </div>
              <div className="text-sm text-gray-400">Threats Found</div>
            </div>
          </div>

          {/* Current File */}
          {runningStatus.current_path && (
            <div className="mt-4 p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Currently scanning:</div>
              <div className="text-sm text-gray-300 truncate">
                {runningStatus.current_path}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last Run Summary */}
      {history && history.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Last Run Results</h3>
          <LastRunSummary run={history[0]} />
        </div>
      )}

      {/* History Chart */}
      {history && history.length > 1 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Run History</h3>
          <HistoryChart history={history} />
        </div>
      )}

      {/* Recent Runs Table */}
      {history && history.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Runs</h3>
          <HistoryTable history={history} />
        </div>
      )}

      {/* No History */}
      {(!history || history.length === 0) && !runningStatus && (
        <div className="card text-center py-8">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">No scan history yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Run this schedule to see results here
          </p>
        </div>
      )}
    </div>
  );
}

interface LastRunSummaryProps {
  run: ScheduleHistory;
}

function LastRunSummary({ run }: LastRunSummaryProps) {
  const statusIcon = {
    completed: <CheckCircle className="w-8 h-8 text-green-400" />,
    failed: <XCircle className="w-8 h-8 text-red-400" />,
    cancelled: <AlertTriangle className="w-8 h-8 text-yellow-400" />,
    running: <Activity className="w-8 h-8 text-blue-400" />,
  };

  const statusText = {
    completed: 'Completed Successfully',
    failed: 'Failed',
    cancelled: 'Cancelled',
    running: 'Running',
  };

  return (
    <div className="flex items-start space-x-4">
      <div className="p-3 bg-gray-800 rounded-lg">
        {statusIcon[run.status]}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{statusText[run.status]}</div>
        <div className="text-sm text-gray-400">
          {formatDateSafe(run.started_at, 'PPpp')}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center space-x-2 text-gray-400 mb-1">
              <File className="w-4 h-4" />
              <span className="text-sm">Files Scanned</span>
            </div>
            <div className="text-xl font-semibold">
              {run.files_scanned.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2 text-gray-400 mb-1">
              <Bug className="w-4 h-4" />
              <span className="text-sm">Threats Found</span>
            </div>
            <div
              className={clsx(
                'text-xl font-semibold',
                run.threats_found > 0 ? 'text-red-400' : 'text-green-400'
              )}
            >
              {run.threats_found}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2 text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Duration</span>
            </div>
            <div className="text-xl font-semibold">
              {run.duration_ms
                ? formatDuration(run.duration_ms)
                : calculateDurationSafe(run.started_at, run.completed_at)
                  ? formatDuration(calculateDurationSafe(run.started_at, run.completed_at)!)
                  : '-'}
            </div>
          </div>
        </div>

        {run.error_message && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <div className="text-sm text-red-400">{run.error_message}</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface HistoryChartProps {
  history: ScheduleHistory[];
}

function HistoryChart({ history }: HistoryChartProps) {
  // Simple bar chart showing files scanned and threats found
  const maxFiles = Math.max(...history.map((h) => h.files_scanned), 1);

  return (
    <div className="space-y-2">
      {history.slice(0, 7).reverse().map((run) => (
        <div key={run.id} className="flex items-center space-x-3">
          <div className="w-24 text-xs text-gray-500">
            {formatDateSafe(run.started_at, 'MMM d')}
          </div>
          <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
            <div
              className={clsx(
                'h-full transition-all',
                run.status === 'completed' ? 'bg-green-600' : 'bg-red-600'
              )}
              style={{
                width: `${(run.files_scanned / maxFiles) * 100}%`,
              }}
            />
          </div>
          <div className="w-20 text-right text-sm">
            {run.files_scanned.toLocaleString()}
          </div>
          <div
            className={clsx(
              'w-8 text-right text-sm font-medium',
              run.threats_found > 0 ? 'text-red-400' : 'text-gray-500'
            )}
          >
            {run.threats_found}
          </div>
        </div>
      ))}
      <div className="flex items-center space-x-3 text-xs text-gray-500 pt-2">
        <div className="w-24">Date</div>
        <div className="flex-1">Files Scanned</div>
        <div className="w-20 text-right">Count</div>
        <div className="w-8 text-right">Threats</div>
      </div>
    </div>
  );
}

interface HistoryTableProps {
  history: ScheduleHistory[];
}

function HistoryTable({ history }: HistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 font-medium text-gray-400">
              Date
            </th>
            <th className="text-left py-2 px-3 font-medium text-gray-400">
              Status
            </th>
            <th className="text-right py-2 px-3 font-medium text-gray-400">
              Files
            </th>
            <th className="text-right py-2 px-3 font-medium text-gray-400">
              Threats
            </th>
            <th className="text-right py-2 px-3 font-medium text-gray-400">
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((run) => (
            <tr key={run.id} className="border-b border-gray-800">
              <td className="py-2 px-3">
                {formatDateSafe(run.started_at, 'PPp')}
              </td>
              <td className="py-2 px-3">
                <StatusBadge status={run.status} />
              </td>
              <td className="py-2 px-3 text-right">
                {run.files_scanned.toLocaleString()}
              </td>
              <td className="py-2 px-3 text-right">
                <span
                  className={clsx(
                    run.threats_found > 0 ? 'text-red-400' : 'text-gray-400'
                  )}
                >
                  {run.threats_found}
                </span>
              </td>
              <td className="py-2 px-3 text-right text-gray-400">
                {run.duration_ms ? formatDuration(run.duration_ms) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: ScheduleHistory['status'] }) {
  const styles = {
    completed: 'bg-green-900 text-green-200',
    failed: 'bg-red-900 text-red-200',
    cancelled: 'bg-yellow-900 text-yellow-200',
    running: 'bg-blue-900 text-blue-200',
  };

  return (
    <span className={clsx('badge text-xs', styles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
