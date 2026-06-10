import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import { useEventListener } from './useTauri';

// Types
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  fields?: Record<string, unknown>;
  span?: string;
  target?: string;
  file?: string;
  line?: number;
}

export interface LogFilter {
  levels?: LogLevel[];
  modules?: string[];
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface LogStreamConfig {
  buffer_size?: number;
  levels?: LogLevel[];
  modules?: string[];
}

type WireLogEntry = Omit<LogEntry, 'id' | 'level' | 'module'> & {
  id?: string;
  level?: string;
  module?: string | null;
};

function normalizeLogEntry(log: WireLogEntry, index: number): LogEntry {
  const level = String(log.level || 'INFO').toUpperCase();
  const normalizedLevel: LogLevel =
    level === 'DEBUG' || level === 'WARN' || level === 'ERROR' ? level : 'INFO';
  const module = log.module || 'agent';

  return {
    ...log,
    id: log.id || `${log.timestamp}-${module}-${index}`,
    level: normalizedLevel,
    module,
    fields: log.fields || undefined,
  };
}

// Color mappings for log levels
export function getLogLevelColor(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    DEBUG: 'text-gray-400 bg-gray-800',
    INFO: 'text-blue-400 bg-blue-900/30',
    WARN: 'text-yellow-400 bg-yellow-900/30',
    ERROR: 'text-red-400 bg-red-900/30',
  };
  return colors[level] || 'text-gray-400 bg-gray-800';
}

export function getLogLevelBorderColor(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    DEBUG: 'border-l-gray-500',
    INFO: 'border-l-blue-500',
    WARN: 'border-l-yellow-500',
    ERROR: 'border-l-red-500',
  };
  return colors[level] || 'border-l-gray-500';
}

// Hook for real-time log streaming
export function useLogStream(
  onLog: (log: LogEntry) => void,
  enabled: boolean = true
) {
  const callbackRef = useRef(onLog);
  callbackRef.current = onLog;

  useEffect(() => {
    if (!enabled) return;
    return undefined;
  }, [enabled]);

  // Also listen for real Tauri events when available
  useEventListener<LogEntry>('agent-log', (log) => {
    if (enabled) {
      callbackRef.current(log);
    }
  });
}

// Hook for fetching historical logs
export function useLogs(filter: LogFilter) {
  return useQuery<LogEntry[]>({
    queryKey: ['logs', filter],
    queryFn: async () => {
      const level = filter.levels?.length === 1 ? filter.levels[0] : undefined;
      let logs = (await invoke<WireLogEntry[]>('get_logs', {
        since: filter.from,
        level,
        limit: filter.limit || 1000,
      })).map(normalizeLogEntry);

      if (filter.levels && filter.levels.length > 1) {
        logs = logs.filter(log => filter.levels!.includes(log.level));
      }
      if (filter.modules && filter.modules.length > 0) {
        logs = logs.filter(log =>
          filter.modules!.some(m => log.module.includes(m))
        );
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        logs = logs.filter(log =>
          log.message.toLowerCase().includes(searchLower) ||
          log.module.toLowerCase().includes(searchLower)
        );
      }
      if (filter.to) {
        const toDate = new Date(filter.to);
        logs = logs.filter(log => new Date(log.timestamp) <= toDate);
      }

      return logs.slice(filter.offset || 0, (filter.offset || 0) + (filter.limit || 1000));
    },
    refetchInterval: false,
  });
}

// Hook for getting available modules
export function useLogModules() {
  return useQuery<string[]>({
    queryKey: ['log-modules'],
    queryFn: () => invoke<string[]>('get_log_modules'),
    staleTime: 60000,
  });
}

// Hook for managing log display with buffering and filtering
export function useLogViewer(maxLines: number = 1000) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<LogFilter>({});
  const pausedLogsRef = useRef<LogEntry[]>([]);

  // Load initial logs
  const { data: initialLogs, isLoading } = useLogs({ ...filter, limit: maxLines });

  useEffect(() => {
    if (initialLogs) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  // Handle incoming stream logs
  const handleNewLog = useCallback((log: LogEntry) => {
    // Apply filters
    if (filter.levels && filter.levels.length > 0) {
      if (!filter.levels.includes(log.level)) return;
    }
    if (filter.modules && filter.modules.length > 0) {
      if (!filter.modules.some(m => log.module.includes(m))) return;
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      if (!log.message.toLowerCase().includes(searchLower) &&
          !log.module.toLowerCase().includes(searchLower)) {
        return;
      }
    }

    if (isPaused) {
      pausedLogsRef.current = [log, ...pausedLogsRef.current].slice(0, maxLines);
    } else {
      setLogs(prev => [log, ...prev].slice(0, maxLines));
    }
  }, [filter, isPaused, maxLines]);

  useLogStream(handleNewLog, !isPaused);

  // Resume streaming and merge paused logs
  const resume = useCallback(() => {
    if (pausedLogsRef.current.length > 0) {
      setLogs(prev => [...pausedLogsRef.current, ...prev].slice(0, maxLines));
      pausedLogsRef.current = [];
    }
    setIsPaused(false);
  }, [maxLines]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
    pausedLogsRef.current = [];
  }, []);

  const updateFilter = useCallback((newFilter: Partial<LogFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
  }, []);

  // Export logs to file
  const exportLogs = useCallback((format: 'json' | 'txt' = 'json') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(logs, null, 2);
      filename = `tamandua-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      mimeType = 'application/json';
    } else {
      content = logs.map(log =>
        `[${log.timestamp}] [${log.level.padEnd(5)}] [${log.module}] ${log.message}${
          log.fields ? ' ' + JSON.stringify(log.fields) : ''
        }`
      ).join('\n');
      filename = `tamandua-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [logs]);

  return {
    logs,
    isLoading,
    isPaused,
    pendingCount: pausedLogsRef.current.length,
    filter,
    pause,
    resume,
    clear,
    updateFilter,
    exportLogs,
  };
}
