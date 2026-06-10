import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';

function unsupportedCapability(feature: string): Promise<never> {
  return Promise.reject(new Error(`${feature} is unavailable on this endpoint build.`));
}

// Types
export interface Schedule {
  id: string;
  name: string;
  scan_type: 'quick' | 'full' | 'custom';
  frequency: ScheduleFrequency;
  frequency_display: string;
  next_run: string | null;
  last_run: string | null;
  enabled: boolean;
  status: 'enabled' | 'disabled' | 'running' | 'completed' | 'failed';
  paths: string[];
  options: ScanOptions;
  detection_action: DetectionAction;
  created_at: string;
  updated_at: string;
}

export type ScheduleFrequency =
  | { type: 'once'; datetime: string }
  | { type: 'daily'; time: string }
  | { type: 'weekly'; days: string[]; time: string }
  | { type: 'monthly'; day: number; time: string }
  | { type: 'cron'; expression: string };

export interface ScanOptions {
  scan_archives: boolean;
  follow_symlinks: boolean;
  cpu_priority: 'low' | 'normal' | 'high';
  skip_if_on_battery: boolean;
  wake_to_scan: boolean;
}

export type DetectionAction =
  | { type: 'alert' }
  | { type: 'quarantine' }
  | { type: 'custom'; action_name: string; params: Record<string, unknown> };

export interface ScheduleConfig {
  name: string;
  scan_type: 'quick' | 'full' | 'custom';
  frequency: ScheduleFrequency;
  paths: string[];
  options: ScanOptions;
  detection_action: DetectionAction;
}

export interface ScheduleHistory {
  id: string;
  schedule_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  files_scanned: number;
  threats_found: number;
  duration_ms: number | null;
  error_message: string | null;
}

export interface ScheduleRunningStatus {
  schedule_id: string;
  started_at: string;
  files_scanned: number;
  total_files: number;
  progress_percent: number;
  threats_found: number;
  current_path: string;
}

export type QuickSchedulePreset = 'daily_quick_scan' | 'weekly_full_scan';

// Default values
export const defaultScanOptions: ScanOptions = {
  scan_archives: true,
  follow_symlinks: false,
  cpu_priority: 'normal',
  skip_if_on_battery: false,
  wake_to_scan: false,
};

export const defaultScheduleConfig: ScheduleConfig = {
  name: '',
  scan_type: 'quick',
  frequency: { type: 'daily', time: '12:00' },
  paths: [],
  options: defaultScanOptions,
  detection_action: { type: 'alert' },
};

// Hooks

/**
 * Hook to fetch all schedules
 */
export function useSchedules() {
  return useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: () => invoke<Schedule[]>('get_schedules'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to fetch a specific schedule
 */
export function useSchedule(scheduleId: string | null) {
  return useQuery<Schedule>({
    queryKey: ['schedule', scheduleId],
    queryFn: () => invoke<Schedule>('get_schedule', { scheduleId }),
    enabled: !!scheduleId,
  });
}

/**
 * Hook to create a new schedule
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: ScheduleConfig) =>
      invoke<Schedule>('create_schedule', { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Hook to update an existing schedule
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      config,
    }: {
      scheduleId: string;
      config: ScheduleConfig;
    }) => invoke<Schedule>('update_schedule', { scheduleId, config }),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
    },
  });
}

/**
 * Hook to delete a schedule
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      invoke('delete_schedule', { scheduleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Hook to enable/disable a schedule
 */
export function useSetScheduleEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      enabled,
    }: {
      scheduleId: string;
      enabled: boolean;
    }) => invoke('set_schedule_enabled', { scheduleId, enabled }),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
    },
  });
}

/**
 * Hook to run a schedule immediately
 */
export function useRunScheduleNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      invoke('run_schedule_now', { scheduleId }),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['scheduleRunning', scheduleId] });
    },
  });
}

/**
 * Hook to get schedule run history
 */
export function useScheduleHistory(scheduleId: string | null, limit?: number) {
  return useQuery<ScheduleHistory[]>({
    queryKey: ['scheduleHistory', scheduleId, limit],
    queryFn: () =>
      invoke<ScheduleHistory[]>('get_schedule_history', { scheduleId, limit }),
    enabled: !!scheduleId,
    refetchInterval: (query) => {
      // Refresh more often if there's a running scan
      const hasRunning = query.state.data?.some((h) => h.status === 'running');
      return hasRunning ? 5000 : 30000;
    },
  });
}

/**
 * Hook to get running status of a schedule
 */
export function useScheduleRunningStatus(scheduleId: string | null) {
  return useQuery<ScheduleRunningStatus | null>({
    queryKey: ['scheduleRunning', scheduleId],
    queryFn: () =>
      invoke<ScheduleRunningStatus | null>('get_schedule_running_status', {
        scheduleId,
      }),
    enabled: !!scheduleId,
    refetchInterval: (data) => (data ? 2000 : 10000),
  });
}

/**
 * Hook to cancel a running scheduled scan
 */
export function useCancelScheduledScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      invoke('cancel_scheduled_scan', { scheduleId }),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['scheduleRunning', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['scheduleHistory', scheduleId] });
    },
  });
}

/**
 * Hook to create a quick schedule preset
 */
export function useCreateQuickSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preset: QuickSchedulePreset) =>
      unsupportedCapability(`Quick schedule preset ${preset}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Hook to listen for schedule-related events
 */
export function useScheduleEventListener(
  callback: (event: ScheduleEvent) => void
) {
  const memoizedCallback = useCallback(callback, [callback]);

  useEffect(() => {
    const unlisten = listen<ScheduleEvent>('schedule-event', (event) => {
      memoizedCallback(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [memoizedCallback]);
}

export interface ScheduleEvent {
  type:
    | 'schedule_started'
    | 'schedule_completed'
    | 'schedule_failed'
    | 'schedule_cancelled'
    | 'schedule_progress';
  schedule_id: string;
  data?: Record<string, unknown>;
}

// Utility functions

/**
 * Format a schedule frequency for display
 */
export function formatFrequency(frequency: ScheduleFrequency): string {
  switch (frequency.type) {
    case 'once':
      return `Once at ${frequency.datetime}`;
    case 'daily':
      return `Daily at ${frequency.time}`;
    case 'weekly':
      return frequency.days.length > 0
        ? `Every ${frequency.days.join(', ')} at ${frequency.time}`
        : `Weekly at ${frequency.time}`;
    case 'monthly':
      return `Monthly on day ${frequency.day} at ${frequency.time}`;
    case 'cron':
      return `Cron: ${frequency.expression}`;
  }
}

/**
 * Format scan type for display
 */
export function formatScanType(type: Schedule['scan_type']): string {
  switch (type) {
    case 'quick':
      return 'Quick Scan';
    case 'full':
      return 'Full Scan';
    case 'custom':
      return 'Custom Scan';
  }
}

/**
 * Format status for display
 */
export function formatStatus(status: Schedule['status']): string {
  switch (status) {
    case 'enabled':
      return 'Enabled';
    case 'disabled':
      return 'Disabled';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
  }
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: Schedule['status']): string {
  switch (status) {
    case 'enabled':
      return 'bg-green-900 text-green-200';
    case 'disabled':
      return 'bg-gray-700 text-gray-300';
    case 'running':
      return 'bg-blue-900 text-blue-200';
    case 'completed':
      return 'bg-green-900 text-green-200';
    case 'failed':
      return 'bg-red-900 text-red-200';
  }
}

/**
 * Parse time string to hours and minutes
 */
export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Format hours and minutes to time string
 */
export function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get weekday options
 */
export function getWeekdayOptions(): { value: string; label: string }[] {
  return [
    { value: 'Monday', label: 'Monday' },
    { value: 'Tuesday', label: 'Tuesday' },
    { value: 'Wednesday', label: 'Wednesday' },
    { value: 'Thursday', label: 'Thursday' },
    { value: 'Friday', label: 'Friday' },
    { value: 'Saturday', label: 'Saturday' },
    { value: 'Sunday', label: 'Sunday' },
  ];
}
