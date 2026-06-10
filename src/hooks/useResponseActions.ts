import { invoke } from '@tauri-apps/api/tauri';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

// Types
export type ResponseActionType =
  | 'kill_process'
  | 'quarantine_file'
  | 'block_ip'
  | 'block_domain'
  | 'isolate_host'
  | 'restore_file'
  | 'unblock_ip'
  | 'unblock_domain'
  | 'unisolate_host';

export type ActionResult = 'success' | 'failed' | 'pending' | 'reverted';
export type ActionTrigger = 'rule' | 'manual' | 'automated';

export interface ResponseAction {
  id: string;
  action_type: ResponseActionType;
  timestamp: string;
  target: string;
  target_details: {
    process_name?: string;
    process_id?: number;
    file_path?: string;
    file_hash?: string;
    ip_address?: string;
    domain?: string;
    hostname?: string;
    port?: number;
  };
  result: ActionResult;
  triggered_by: ActionTrigger;
  triggered_rule?: string;
  triggered_user?: string;
  agent_id: string;
  hostname: string;
  related_alert_id?: string;
  related_alert_message?: string;
  error_message?: string;
  duration_ms?: number;
  can_undo: boolean;
  undo_action_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ResponseActionFilter {
  action_types?: ResponseActionType[];
  results?: ActionResult[];
  triggers?: ActionTrigger[];
  date_from?: string;
  date_to?: string;
  search?: string;
  agent_id?: string;
  limit?: number;
  offset?: number;
}

export interface ResponseActionStats {
  total_actions: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  by_type: Record<ResponseActionType, number>;
  by_trigger: Record<ActionTrigger, number>;
  recent_trend: 'increasing' | 'decreasing' | 'stable';
  avg_response_time_ms: number;
}

export interface UndoResult {
  success: boolean;
  undo_action_id?: string;
  error_message?: string;
}

export type ResponseCommandResult = unknown;

function invalidateResponseActionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['response-actions'] });
  queryClient.invalidateQueries({ queryKey: ['response-action-stats'] });
  queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
  queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
}

// Hook for fetching response actions with filtering
export function useResponseActions(filter?: ResponseActionFilter) {
  return useQuery<ResponseAction[]>({
    queryKey: ['response-actions', filter],
    queryFn: () => invoke<ResponseAction[]>('get_response_actions', { filter }),
    refetchInterval: 30000,
  });
}

// Hook for fetching a single response action
export function useResponseAction(actionId: string | null) {
  return useQuery<ResponseAction>({
    queryKey: ['response-action', actionId],
    queryFn: async () => {
      const actions = await invoke<ResponseAction[]>('get_response_actions', {
        filter: { search: actionId, limit: 500 },
      });
      const action = actions.find((item) => item.id === actionId);
      if (!action) throw new Error('Action not found');
      return action;
    },
    enabled: !!actionId,
  });
}

// Hook for fetching response action statistics
export function useResponseActionStats(filter?: ResponseActionFilter) {
  return useQuery<ResponseActionStats>({
    queryKey: ['response-action-stats', filter],
    queryFn: () => invoke<ResponseActionStats>('get_response_action_stats', { filter }),
    refetchInterval: 60000,
  });
}

// Hook for undoing an action
export function useUndoAction() {
  const queryClient = useQueryClient();

  return useMutation<UndoResult, Error, string>({
    mutationFn: (actionId: string) => invoke<UndoResult>('undo_response_action', { actionId }),
    onSuccess: () => {
      invalidateResponseActionQueries(queryClient);
    },
  });
}

export function useBlockIp() {
  const queryClient = useQueryClient();

  return useMutation<ResponseCommandResult, Error, string>({
    mutationFn: (ip: string) => invoke<ResponseCommandResult>('block_ip', { ip }),
    onSuccess: () => invalidateResponseActionQueries(queryClient),
  });
}

export function useUnblockIp() {
  const queryClient = useQueryClient();

  return useMutation<ResponseCommandResult, Error, string>({
    mutationFn: (ip: string) => invoke<ResponseCommandResult>('unblock_ip', { ip }),
    onSuccess: () => invalidateResponseActionQueries(queryClient),
  });
}

export function useBlockDomain() {
  const queryClient = useQueryClient();

  return useMutation<ResponseCommandResult, Error, string>({
    mutationFn: (domain: string) => invoke<ResponseCommandResult>('block_domain', { domain }),
    onSuccess: () => invalidateResponseActionQueries(queryClient),
  });
}

export function useUnblockDomain() {
  const queryClient = useQueryClient();

  return useMutation<ResponseCommandResult, Error, string>({
    mutationFn: (domain: string) => invoke<ResponseCommandResult>('unblock_domain', { domain }),
    onSuccess: () => invalidateResponseActionQueries(queryClient),
  });
}

export function useIsolateHost() {
  const queryClient = useQueryClient();

  return useMutation<ResponseCommandResult, Error>({
    mutationFn: () => invoke<ResponseCommandResult>('isolate_network'),
    onSuccess: () => invalidateResponseActionQueries(queryClient),
  });
}

export function useRestoreHost() {
  const queryClient = useQueryClient();

  return useMutation<ResponseCommandResult, Error>({
    mutationFn: () => invoke<ResponseCommandResult>('restore_network'),
    onSuccess: () => invalidateResponseActionQueries(queryClient),
  });
}

// Hook for virtualized/paginated action list
export function useVirtualizedResponseActions(filter?: ResponseActionFilter) {
  const [allActions, setAllActions] = useState<ResponseAction[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { data: initialActions, isLoading, refetch } = useResponseActions({
    ...filter,
    limit: 50,
    offset: 0,
  });

  // Reset when filter changes
  useEffect(() => {
    setAllActions([]);
    setHasMore(true);
  }, [JSON.stringify(filter)]);

  // Set initial actions
  useEffect(() => {
    if (initialActions && allActions.length === 0) {
      setAllActions(initialActions);
      if (initialActions.length < 50) {
        setHasMore(false);
      }
    }
  }, [initialActions, allActions.length]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const newActions = await invoke<ResponseAction[]>('get_response_actions', {
        filter: { ...filter, limit: 50, offset: allActions.length },
      });

      if (newActions.length < 50) {
        setHasMore(false);
      }

      setAllActions((prev) => [...prev, ...newActions]);
    } catch (error) {
      console.error('Failed to load more actions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [filter, allActions.length, isLoadingMore, hasMore]);

  return {
    actions: allActions.length > 0 ? allActions : initialActions || [],
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refetch,
  };
}

// Utility functions
export function getActionTypeLabel(type: ResponseActionType): string {
  const labels: Record<ResponseActionType, string> = {
    kill_process: 'Kill Process',
    quarantine_file: 'Quarantine File',
    block_ip: 'Block IP',
    block_domain: 'Block Domain',
    isolate_host: 'Isolate Host',
    restore_file: 'Restore File',
    unblock_ip: 'Unblock IP',
    unblock_domain: 'Unblock Domain',
    unisolate_host: 'Unisolate Host',
  };
  return labels[type] || type;
}

export function getActionTypeColor(type: ResponseActionType): string {
  const colors: Record<ResponseActionType, string> = {
    kill_process: 'bg-red-600',
    quarantine_file: 'bg-orange-600',
    block_ip: 'bg-purple-600',
    block_domain: 'bg-fuchsia-600',
    isolate_host: 'bg-yellow-600',
    restore_file: 'bg-green-600',
    unblock_ip: 'bg-blue-600',
    unblock_domain: 'bg-indigo-600',
    unisolate_host: 'bg-teal-600',
  };
  return colors[type] || 'bg-gray-600';
}

export function getResultColor(result: ActionResult): string {
  const colors: Record<ActionResult, string> = {
    success: 'text-green-500 bg-green-900/20',
    failed: 'text-red-500 bg-red-900/20',
    pending: 'text-yellow-500 bg-yellow-900/20',
    reverted: 'text-blue-500 bg-blue-900/20',
  };
  return colors[result] || 'text-gray-400 bg-gray-700';
}

export function getTriggerLabel(trigger: ActionTrigger): string {
  const labels: Record<ActionTrigger, string> = {
    rule: 'Detection Rule',
    manual: 'Manual',
    automated: 'Automated',
  };
  return labels[trigger] || trigger;
}

export function getTriggerColor(trigger: ActionTrigger): string {
  const colors: Record<ActionTrigger, string> = {
    rule: 'bg-primary-600',
    manual: 'bg-gray-600',
    automated: 'bg-cyan-600',
  };
  return colors[trigger] || 'bg-gray-600';
}

export function isReversibleAction(type: ResponseActionType): boolean {
  return ['quarantine_file', 'block_ip', 'block_domain', 'isolate_host'].includes(type);
}

export function getUndoActionType(type: ResponseActionType): ResponseActionType | null {
  const undoMap: Partial<Record<ResponseActionType, ResponseActionType>> = {
    quarantine_file: 'restore_file',
    block_ip: 'unblock_ip',
    block_domain: 'unblock_domain',
    isolate_host: 'unisolate_host',
  };
  return undoMap[type] || null;
}
