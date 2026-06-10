import { useState } from 'react';
import {
  Schedule,
  useSchedules,
  useDeleteSchedule,
  useSetScheduleEnabled,
  useRunScheduleNow,
  formatScanType,
  getStatusColor,
} from '../../hooks/useSchedules';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

// Safe date formatting helpers
function formatDateSafe(dateStr: string | null | undefined, formatStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatStr);
  } catch {
    return '-';
  }
}

function formatDistanceSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

interface ScheduleListProps {
  onEdit: (schedule: Schedule) => void;
  onCreate: () => void;
}

export function ScheduleList({ onEdit, onCreate }: ScheduleListProps) {
  const { data: schedules, isLoading, error } = useSchedules();
  const deleteSchedule = useDeleteSchedule();
  const setEnabled = useSetScheduleEnabled();
  const runNow = useRunScheduleNow();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <p className="text-red-400">Failed to load schedules</p>
        <p className="text-sm text-gray-500 mt-2">{String(error)}</p>
      </div>
    );
  }

  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-lg font-semibold mb-2">No Scheduled Scans</h3>
        <p className="text-gray-400 mb-6">
          Create a scheduled scan to automatically protect your system
        </p>
        <button onClick={onCreate} className="btn-primary">
          Create Schedule
        </button>
      </div>
    );
  }

  const handleToggleEnabled = async (schedule: Schedule) => {
    try {
      await setEnabled.mutateAsync({
        scheduleId: schedule.id,
        enabled: !schedule.enabled,
      });
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      await deleteSchedule.mutateAsync(scheduleId);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    try {
      await runNow.mutateAsync(scheduleId);
    } catch (err) {
      console.error('Failed to run schedule:', err);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-4 font-medium text-gray-400">
              Name
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-400">
              Type
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-400">
              Frequency
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-400">
              Next Run
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-400">
              Last Run
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-400">
              Status
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => (
            <tr
              key={schedule.id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-4 px-4">
                <div className="font-medium">{schedule.name}</div>
                {schedule.paths.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {schedule.paths.length} path(s)
                  </div>
                )}
              </td>
              <td className="py-4 px-4">
                <span className="badge bg-gray-700">
                  {formatScanType(schedule.scan_type)}
                </span>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{schedule.frequency_display}</span>
                </div>
              </td>
              <td className="py-4 px-4">
                {schedule.next_run ? (
                  <div className="text-sm">
                    <div>{formatDateSafe(schedule.next_run, 'PPp')}</div>
                    <div className="text-gray-500">
                      {formatDistanceSafe(schedule.next_run)}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </td>
              <td className="py-4 px-4">
                {schedule.last_run ? (
                  <div className="text-sm">
                    <div>{formatDateSafe(schedule.last_run, 'PPp')}</div>
                    <div className="text-gray-500">
                      {formatDistanceSafe(schedule.last_run)}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500">Never</span>
                )}
              </td>
              <td className="py-4 px-4">
                <span className={clsx('badge', getStatusColor(schedule.status))}>
                  {schedule.status === 'running' && (
                    <span className="mr-1 inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  )}
                  {schedule.status.charAt(0).toUpperCase() +
                    schedule.status.slice(1)}
                </span>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center justify-end space-x-2">
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => handleToggleEnabled(schedule)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      schedule.enabled
                        ? 'text-green-400 hover:bg-green-900/30'
                        : 'text-gray-500 hover:bg-gray-700'
                    )}
                    title={schedule.enabled ? 'Disable' : 'Enable'}
                    disabled={setEnabled.isPending}
                  >
                    {schedule.enabled ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>

                  {/* Run Now */}
                  <button
                    onClick={() => handleRunNow(schedule.id)}
                    className="p-2 rounded-lg text-blue-400 hover:bg-blue-900/30 transition-colors"
                    title="Run Now"
                    disabled={
                      schedule.status === 'running' || runNow.isPending
                    }
                  >
                    <PlayCircle className="w-4 h-4" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => onEdit(schedule)}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-700 transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors"
                    title="Delete"
                    disabled={deleteSchedule.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
