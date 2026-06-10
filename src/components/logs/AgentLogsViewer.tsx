import { useCallback, useRef, useState, useEffect, memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import {
  Play,
  Pause,
  Trash2,
  Download,
  ChevronDown,
  ScrollText,
  ArrowDown,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogEntry, useLogViewer, LogFilter } from '@/hooks/useLogs';
import { LogLine, LogLineCompact } from './LogLine';
import { LogFilters, LogFiltersCompact } from './LogFilters';
import { LogDetails } from './LogDetails';

interface AgentLogsViewerProps {
  maxLines?: number;
  height?: number;
  className?: string;
  compact?: boolean;
}

// Constants
const LOG_LINE_HEIGHT = 32; // Height of each log line in pixels
const LOG_LINE_EXPANDED_HEIGHT = 200; // Height when expanded

// Virtual list row renderer
const LogRow = memo(function LogRow({
  data,
  index,
  style,
}: ListChildComponentProps<{
  logs: LogEntry[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}>) {
  const { logs, expandedId, onToggleExpand } = data;
  const log = logs[index];

  if (!log) return null;

  return (
    <LogLineCompact
      log={log}
      style={style}
      onClick={() => onToggleExpand(log.id)}
    />
  );
});

export function AgentLogsViewer({
  maxLines = 1000,
  height = 500,
  className,
  compact = false,
}: AgentLogsViewerProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const {
    logs,
    isLoading,
    isPaused,
    pendingCount,
    filter,
    pause,
    resume,
    clear,
    updateFilter,
    exportLogs,
  } = useLogViewer(maxLines);

  // Auto-scroll to top when new logs arrive (logs are prepended)
  useEffect(() => {
    if (autoScroll && !isPaused && listRef.current) {
      listRef.current.scrollToItem(0, 'start');
    }
  }, [logs.length, autoScroll, isPaused]);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    // Disable auto-scroll if user scrolls away from top
    if (scrollOffset > LOG_LINE_HEIGHT * 3) {
      setAutoScroll(false);
    } else {
      setAutoScroll(true);
    }
  }, []);

  // Toggle log expansion
  const handleToggleExpand = useCallback((id: string) => {
    const log = logs.find(l => l.id === id);
    if (log) {
      setSelectedLog(selectedLog?.id === id ? null : log);
    }
  }, [logs, selectedLog]);

  // Scroll to top
  const handleScrollToTop = useCallback(() => {
    listRef.current?.scrollToItem(0, 'start');
    setAutoScroll(true);
  }, []);

  // Handle filter changes from log details
  useEffect(() => {
    const handleFilterEvent = (e: CustomEvent<Partial<LogFilter>>) => {
      updateFilter(e.detail);
    };

    window.addEventListener('log-filter', handleFilterEvent as EventListener);
    return () => {
      window.removeEventListener('log-filter', handleFilterEvent as EventListener);
    };
  }, [updateFilter]);

  // Level counts for status bar
  const levelCounts = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Item data for virtual list
  const itemData = {
    logs,
    expandedId: expandedLogId,
    onToggleExpand: handleToggleExpand,
  };

  if (compact) {
    return (
      <div className={cn('tamandua-log-viewer bg-gray-900 rounded-lg border border-gray-700', className)}>
        {/* Compact Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">Agent Logs</span>
            <Badge variant="secondary" className="text-xs">
              {logs.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <LogFiltersCompact filter={filter} onFilterChange={updateFilter} />

            <Button
              variant="ghost"
              size="icon"
              onClick={isPaused ? resume : pause}
              className="h-7 w-7"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={clear}
              className="h-7 w-7"
              title="Clear"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Compact Log List */}
        <div ref={containerRef}>
          {logs.length > 0 ? (
            <List
              ref={listRef}
              height={height}
              itemCount={logs.length}
              itemSize={LOG_LINE_HEIGHT}
              width="100%"
              itemData={itemData}
              onScroll={handleScroll}
              overscanCount={10}
            >
              {LogRow}
            </List>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <ScrollText className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No logs</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('tamandua-log-viewer overflow-hidden', className)}>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Agent Logs
            </CardTitle>

            {/* Status indicators */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {logs.length.toLocaleString()} lines
              </Badge>

              {isPaused && pendingCount > 0 && (
                <Badge variant="warning" className="animate-pulse">
                  {pendingCount} pending
                </Badge>
              )}

              {isPaused && (
                <Badge variant="outline" className="gap-1">
                  <Pause className="w-3 h-3" />
                  Paused
                </Badge>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant={isPaused ? 'default' : 'outline'}
              size="sm"
              onClick={isPaused ? resume : pause}
              className="gap-1.5"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </Button>

            {/* Export dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="gap-1.5"
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3 h-3" />
              </Button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 rounded-lg border border-gray-700 shadow-lg py-1 min-w-[120px]">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        exportLogs('json');
                        setShowExportMenu(false);
                      }}
                    >
                      Export as JSON
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        exportLogs('txt');
                        setShowExportMenu(false);
                      }}
                    >
                      Export as Text
                    </button>
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clear}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filters */}
        <div className="px-4 pb-4">
          <LogFilters filter={filter} onFilterChange={updateFilter} />
        </div>

        {/* Main content area */}
        <div className="flex">
          {/* Log list */}
          <div
            ref={containerRef}
            className={cn(
              'flex-1 bg-gray-900 border-t border-gray-700',
              selectedLog && 'border-r'
            )}
          >
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 text-xs">
              <div className="flex items-center gap-3">
                {Object.entries(levelCounts).map(([level, count]) => (
                  <span key={level} className="flex items-center gap-1">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        level === 'ERROR' && 'bg-red-500',
                        level === 'WARN' && 'bg-yellow-500',
                        level === 'INFO' && 'bg-blue-500',
                        level === 'DEBUG' && 'bg-gray-500'
                      )}
                    />
                    <span className="text-gray-400">{level}:</span>
                    <span className="text-gray-200 font-medium">{count}</span>
                  </span>
                ))}
              </div>

              {!autoScroll && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleScrollToTop}
                  className="h-6 gap-1 text-xs"
                >
                  <ArrowDown className="w-3 h-3 rotate-180" />
                  Scroll to latest
                </Button>
              )}
            </div>

            {/* Virtual log list */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : logs.length > 0 ? (
              <List
                ref={listRef}
                height={height}
                itemCount={logs.length}
                itemSize={LOG_LINE_HEIGHT}
                width="100%"
                itemData={itemData}
                onScroll={handleScroll}
                overscanCount={20}
              >
                {LogRow}
              </List>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <ScrollText className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg">No logs to display</p>
                <p className="text-sm mt-1">
                  {filter.levels || filter.modules || filter.search
                    ? 'Try adjusting your filters'
                    : 'Logs will appear here when the agent starts'}
                </p>
              </div>
            )}
          </div>

          {/* Details panel */}
          {selectedLog && (
            <div className="w-[450px] flex-shrink-0 border-t border-gray-700">
              <LogDetails
                log={selectedLog}
                onClose={() => setSelectedLog(null)}
              />
            </div>
          )}
        </div>

        {/* Error count indicator (floating) */}
        {levelCounts['ERROR'] > 0 && (
          <div className="absolute bottom-4 right-4">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 shadow-lg"
              onClick={() => updateFilter({ levels: ['ERROR'] })}
            >
              <AlertCircle className="w-4 h-4" />
              {levelCounts['ERROR']} error{levelCounts['ERROR'] > 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export variants
export function AgentLogsViewerCompact(props: Omit<AgentLogsViewerProps, 'compact'>) {
  return <AgentLogsViewer {...props} compact />;
}

// Standalone logs panel (for use in separate route)
export function AgentLogsPanel() {
  return (
    <div className="p-4 h-screen flex flex-col">
      <AgentLogsViewer
        height={window.innerHeight - 200}
        className="flex-1"
      />
    </div>
  );
}

export default AgentLogsViewer;
