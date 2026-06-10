import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

// =============================================================================
// Types
// =============================================================================

export type QuickActionType =
  | 'quick_scan'
  | 'full_scan'
  | 'update_rules'
  | 'test_connection'
  | 'export_logs'
  | 'network_isolate'
  | 'kill_process'
  | 'restart_agent';

export interface QuickActionDefinition {
  id: QuickActionType;
  label: string;
  description: string;
  icon: string;
  shortcut: string;
  shortcutLabel: string;
  dangerous: boolean;
  requiresInput?: 'pid';
}

export interface QuickActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// =============================================================================
// Action Definitions
// =============================================================================

export const QUICK_ACTIONS: QuickActionDefinition[] = [
  {
    id: 'quick_scan',
    label: 'Quick Scan',
    description: 'Scan common locations for threats',
    icon: 'Zap',
    shortcut: 'ctrl+shift+q',
    shortcutLabel: 'Ctrl+Shift+Q',
    dangerous: false,
  },
  {
    id: 'full_scan',
    label: 'Full Scan',
    description: 'Complete system scan',
    icon: 'Search',
    shortcut: 'ctrl+shift+s',
    shortcutLabel: 'Ctrl+Shift+S',
    dangerous: false,
  },
  {
    id: 'update_rules',
    label: 'Update Rules',
    description: 'Refresh YARA/Sigma rules',
    icon: 'RefreshCw',
    shortcut: 'ctrl+shift+u',
    shortcutLabel: 'Ctrl+Shift+U',
    dangerous: false,
  },
  {
    id: 'test_connection',
    label: 'Test Connection',
    description: 'Check backend connectivity',
    icon: 'Wifi',
    shortcut: 'ctrl+shift+t',
    shortcutLabel: 'Ctrl+Shift+T',
    dangerous: false,
  },
  {
    id: 'export_logs',
    label: 'Export Logs',
    description: 'Download agent logs',
    icon: 'Download',
    shortcut: 'ctrl+shift+e',
    shortcutLabel: 'Ctrl+Shift+E',
    dangerous: false,
  },
  {
    id: 'network_isolate',
    label: 'Network Isolate',
    description: 'Emergency network isolation',
    icon: 'ShieldOff',
    shortcut: 'ctrl+shift+i',
    shortcutLabel: 'Ctrl+Shift+I',
    dangerous: true,
  },
  {
    id: 'kill_process',
    label: 'Kill Process',
    description: 'Terminate a process by PID',
    icon: 'XCircle',
    shortcut: 'ctrl+shift+k',
    shortcutLabel: 'Ctrl+Shift+K',
    dangerous: true,
    requiresInput: 'pid',
  },
  {
    id: 'restart_agent',
    label: 'Restart Agent',
    description: 'Restart the EDR agent',
    icon: 'RotateCcw',
    shortcut: 'ctrl+shift+r',
    shortcutLabel: 'Ctrl+Shift+R',
    dangerous: true,
  },
];

// =============================================================================
// useQuickAction Hook
// =============================================================================

export function useQuickAction(action: QuickActionType) {
  const queryClient = useQueryClient();

  const executeMutation = useMutation({
    mutationFn: async (params?: { pid?: number }): Promise<QuickActionResult> => {
      try {
        switch (action) {
          case 'quick_scan':
            await invoke('start_scan', {
              path: '',
              recursive: false,
              scanArchives: false,
            });
            return { success: true, message: 'Quick scan initiated.' };

          case 'full_scan':
            await invoke('start_scan', {
              path: '/',
              recursive: true,
              scanArchives: false,
            });
            return { success: true, message: 'Full scan initiated.' };

          case 'update_rules':
            await invoke('reload_rules');
            return { success: true, message: 'Detection rules updated.' };

          case 'test_connection':
            const connected = await invoke<boolean>('test_connection');
            return {
              success: connected,
              message: connected
                ? 'Connection to backend successful.'
                : 'Connection to backend failed.',
            };

          case 'export_logs':
            const content = await invoke<string>('export_logs', { format: 'txt' });
            return {
              success: true,
              message: 'Logs exported from agent buffer.',
              data: { bytes: content.length },
            };

          case 'network_isolate':
            await invoke('isolate_network');
            return { success: true, message: 'Network isolation enabled.' };

          case 'kill_process':
            if (!params?.pid) {
              return {
                success: false,
                message: 'PID is required.',
              };
            }
            await invoke('kill_process', { pid: params.pid });
            return {
              success: true,
              message: `Process ${params.pid} terminated.`,
            };

          case 'restart_agent':
            await invoke('restart_agent');
            return { success: true, message: 'Agent restart initiated.' };

          default:
            return {
              success: false,
              message: `Unknown action: ${action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Action failed',
        };
      }
    },
    onSuccess: (result) => {
      // Show toast notification
      toast({
        title: result.success ? 'Success' : 'Error',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });

      // Invalidate relevant queries
      if (result.success) {
        switch (action) {
          case 'quick_scan':
          case 'full_scan':
            queryClient.invalidateQueries({ queryKey: ['scans'] });
            break;
          case 'test_connection':
            queryClient.invalidateQueries({ queryKey: ['status'] });
            break;
          case 'network_isolate':
            queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
            break;
          case 'kill_process':
            queryClient.invalidateQueries({ queryKey: ['processes'] });
            break;
          case 'restart_agent':
            queryClient.invalidateQueries({ queryKey: ['status'] });
            queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
            break;
        }
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Action failed',
        variant: 'destructive',
      });
    },
  });

  return {
    execute: executeMutation.mutate,
    executeAsync: executeMutation.mutateAsync,
    isLoading: executeMutation.isPending,
    isSuccess: executeMutation.isSuccess,
    isError: executeMutation.isError,
    error: executeMutation.error,
    result: executeMutation.data,
    reset: executeMutation.reset,
  };
}

// =============================================================================
// useKeyboardShortcuts Hook
// =============================================================================

interface ShortcutHandler {
  action: QuickActionType;
  handler: () => void;
}

export function useKeyboardShortcuts(
  handlers: ShortcutHandler[],
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Build shortcut string from event
      const parts: string[] = [];
      if (event.ctrlKey || event.metaKey) parts.push('ctrl');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');
      parts.push(event.key.toLowerCase());
      const shortcut = parts.join('+');

      // Find matching action
      const actionDef = QUICK_ACTIONS.find((a) => a.shortcut === shortcut);
      if (!actionDef) return;

      // Find handler for this action
      const handlerDef = handlers.find((h) => h.action === actionDef.id);
      if (!handlerDef) return;

      // Prevent default behavior and execute handler
      event.preventDefault();
      event.stopPropagation();
      handlerDef.handler();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}

// =============================================================================
// useQuickActionsPanel Hook
// =============================================================================

export function useQuickActionsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<QuickActionDefinition | null>(null);
  const [pidInput, setPidInput] = useState('');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setConfirmAction(null);
    setPidInput('');
  }, []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const requestConfirmation = useCallback((action: QuickActionDefinition) => {
    setConfirmAction(action);
  }, []);

  const cancelConfirmation = useCallback(() => {
    setConfirmAction(null);
    setPidInput('');
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmAction) {
          cancelConfirmation();
        } else if (isOpen) {
          close();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, confirmAction, close, cancelConfirmation]);

  return {
    isOpen,
    open,
    close,
    toggle,
    confirmAction,
    requestConfirmation,
    cancelConfirmation,
    pidInput,
    setPidInput,
  };
}
