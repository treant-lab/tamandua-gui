import { invoke } from '@tauri-apps/api/tauri';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import { useEventListener } from './useTauri';

// Types
export type EventType =
  | 'process'
  | 'file'
  | 'network'
  | 'registry'
  | 'alert'
  | 'response'
  | 'system'
  | string;
export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TelemetryEvent {
  id: string;
  event_type: EventType;
  severity: EventSeverity;
  timestamp: string;
  message: string;
  agent_id: string;
  hostname: string;

  // Process fields
  process_name?: string;
  process_id?: number;
  parent_process_id?: number;
  command_line?: string;
  exe_path?: string;
  user?: string;

  // File fields
  file_path?: string;
  file_action?: string;
  file_hash?: string;

  // Network fields
  remote_ip?: string;
  remote_port?: number;
  local_port?: number;
  protocol?: string;
  direction?: string;

  // Registry fields (Windows)
  registry_key?: string;
  registry_value?: string;
  registry_action?: string;

  // Alert fields
  alert_source?: string;
  alert_severity?: string;
  rule_name?: string;
  mitre_tactics?: string[];

  // Raw data
  raw_data?: Record<string, unknown>;
}

export interface EventFilter {
  event_types?: EventType[];
  severities?: EventSeverity[];
  search?: string;
  date_from?: string;
  date_to?: string;
  agent_id?: string;
  limit?: number;
  offset?: number;
}

export interface EventFilterPreset {
  id: string;
  name: string;
  filter: EventFilter;
  created_at: string;
}

export interface EventStatistics {
  events_per_hour: { hour: string; count: number }[];
  event_type_distribution: { event_type: EventType; count: number }[];
  top_processes: { process_name: string; count: number }[];
  total_events: number;
  time_range_hours: number;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'evtx';
  filter: EventFilter;
  include_raw_data: boolean;
}

export interface ScheduledExport {
  id: string;
  name: string;
  filter: EventFilter;
  format: 'csv' | 'json' | 'evtx';
  schedule: string; // cron expression
  destination: string; // path or URL
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

function unsupportedCapability(feature: string): Promise<never> {
  return Promise.reject(new Error(`${feature} is unavailable on this endpoint build.`));
}

// Hook for fetching events with pagination
export function useEvents(filter: EventFilter) {
  return useQuery<TelemetryEvent[]>({
    queryKey: ['events', filter],
    queryFn: () => invoke<TelemetryEvent[]>('get_events', { filter }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Hook for fetching a single event by ID
export function useEvent(eventId: string | null) {
  return useQuery<TelemetryEvent>({
    queryKey: ['event', eventId],
    queryFn: () => invoke<TelemetryEvent>('get_event', { eventId }),
    enabled: !!eventId,
  });
}

// Hook for fetching related events
export function useRelatedEvents(eventId: string | null) {
  return useQuery<TelemetryEvent[]>({
    queryKey: ['related-events', eventId],
    queryFn: () => invoke<TelemetryEvent[]>('get_related_events', { eventId }),
    enabled: !!eventId,
  });
}

// Hook for fetching event statistics
export function useEventStatistics(filter: EventFilter) {
  return useQuery<EventStatistics>({
    queryKey: ['event-statistics', filter],
    queryFn: () => invoke<EventStatistics>('get_event_statistics', { filter }),
    refetchInterval: 60000, // Refresh every minute
  });
}

// Hook for fetching event count for pagination
export function useEventCount(filter: EventFilter) {
  return useQuery<number>({
    queryKey: ['event-count', filter],
    queryFn: () => invoke<number>('get_event_count', { filter }),
  });
}

// Hook for exporting events
export function useExportEvents() {
  return useMutation({
    mutationFn: (options: ExportOptions) =>
      invoke<string>('export_events', { options }),
  });
}

// Hook for filter presets
export function useFilterPresets() {
  return useQuery<EventFilterPreset[]>({
    queryKey: ['filter-presets'],
    queryFn: () => invoke<EventFilterPreset[]>('get_filter_presets'),
  });
}

export function useSaveFilterPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, filter }: { name: string; filter: EventFilter }) =>
      invoke<EventFilterPreset>('save_filter_preset', { name, filter }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
    },
  });
}

export function useDeleteFilterPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (presetId: string) =>
      invoke('delete_filter_preset', { presetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
    },
  });
}

// Hook for scheduled exports
export function useScheduledExports() {
  return useQuery<ScheduledExport[]>({
    queryKey: ['scheduled-exports'],
    queryFn: () => invoke<ScheduledExport[]>('get_scheduled_exports'),
  });
}

export function useCreateScheduledExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exportConfig: Omit<ScheduledExport, 'id' | 'last_run' | 'next_run'>) =>
      unsupportedCapability(`Scheduled export creation for ${exportConfig.name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports'] });
    },
  });
}

export function useDeleteScheduledExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exportId: string) =>
      unsupportedCapability(`Scheduled export deletion for ${exportId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-exports'] });
    },
  });
}

// Hook for creating detection rule from event
export function useCreateDetectionRule() {
  return useMutation({
    mutationFn: ({ eventId, ruleType }: { eventId: string; ruleType: 'yara' | 'sigma' }) =>
      invoke<string>('create_detection_rule_from_event', { eventId, ruleType }),
  });
}

// Hook for real-time event streaming
export function useEventStream(callback: (event: TelemetryEvent) => void) {
  useEventListener<TelemetryEvent>('new-event', callback);
}

// Hook for managing infinite scroll with virtual list
export function useVirtualizedEvents(filter: EventFilter) {
  const [allEvents, setAllEvents] = useState<TelemetryEvent[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { data: initialEvents, isLoading } = useEvents({ ...filter, limit: 100, offset: 0 });

  // Initialize events when filter changes
  const resetEvents = useCallback(() => {
    setAllEvents([]);
    setHasMore(true);
  }, []);

  // Keep the first page in sync. The page can mount before the agent has
  // events; when data arrives later, replace the initial empty list.
  useEffect(() => {
    if (initialEvents) {
      setAllEvents(initialEvents);
      setHasMore(initialEvents.length >= 100);
    }
  }, [initialEvents, filter]);

  const loadMoreEvents = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const newEvents = await invoke<TelemetryEvent[]>('get_events', {
        filter: { ...filter, limit: 100, offset: allEvents.length },
      });

      if (newEvents.length < 100) {
        setHasMore(false);
      }

      setAllEvents(prev => [...prev, ...newEvents]);
    } catch (error) {
      console.error('Failed to load more events:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [filter, allEvents.length, isLoadingMore, hasMore]);

  return {
    events: allEvents,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreEvents,
    resetEvents,
  };
}

// Utility functions
export function getEventTypeLabel(type: EventType): string {
  const labels: Record<string, string> = {
    process: 'Process',
    process_create: 'Process Created',
    process_terminate: 'Process Terminated',
    file: 'File',
    file_create: 'File Created',
    file_modify: 'File Modified',
    file_delete: 'File Deleted',
    file_rename: 'File Renamed',
    network: 'Network',
    network_connect: 'Network Connection',
    network_listen: 'Network Listener',
    dns_query: 'DNS Query',
    registry: 'Registry',
    registry_set: 'Registry Set',
    registry_delete: 'Registry Delete',
    alert: 'Alert',
    response: 'Response',
    system: 'System',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getEventTypeColor(type: EventType): string {
  const category = type.startsWith('process_')
    ? 'process'
    : type.startsWith('file_')
      ? 'file'
      : type.startsWith('network_') || type.startsWith('dns_')
        ? 'network'
        : type.startsWith('registry_')
          ? 'registry'
          : type.startsWith('alert_')
            ? 'alert'
            : type.startsWith('response_') || type.startsWith('remediation_')
              ? 'response'
              : type;

  const colors: Record<string, string> = {
    process: 'bg-blue-600',
    file: 'bg-green-600',
    network: 'bg-purple-600',
    registry: 'bg-orange-600',
    alert: 'bg-red-600',
    response: 'bg-yellow-600',
    system: 'bg-gray-600',
  };
  return colors[category] || 'bg-gray-600';
}

export function getSeverityColor(severity: EventSeverity): string {
  const colors: Record<EventSeverity, string> = {
    critical: 'text-red-500 bg-red-900/20',
    high: 'text-orange-500 bg-orange-900/20',
    medium: 'text-yellow-500 bg-yellow-900/20',
    low: 'text-blue-500 bg-blue-900/20',
    info: 'text-gray-400 bg-gray-700',
  };
  return colors[severity] || 'text-gray-400 bg-gray-700';
}
