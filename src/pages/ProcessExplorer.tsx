import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  List,
  RefreshCw,
  Bell,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ProcessTree,
  ProcessList,
  ProcessDetailsPanel,
  ProcessActions,
  ProcessFilters,
} from '../components/process';
import {
  useProcesses,
  useProcessUsers,
  filterProcesses,
  ProcessFilter,
  ProcessInfo,
} from '../hooks/useProcesses';

type ViewMode = 'tree' | 'list';

export function ProcessExplorer() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filters
  const [filter, setFilter] = useState<ProcessFilter>({
    search: '',
    status: 'all',
    trust: 'all',
    type: 'all',
    user: null,
  });

  // Selection state
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());

  // Details panel
  const [detailsPid, setDetailsPid] = useState<number | null>(null);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000);

  // Notifications
  const [notifications, setNotifications] = useState<
    { id: number; message: string; type: 'exit' | 'start' }[]
  >([]);
  const notificationIdRef = useRef(0);

  // Fetch processes
  const { data: processes, isLoading, refetch, newPids, exitedPids } =
    useProcesses(autoRefresh ? refreshInterval : 0);

  // Get unique users for filter
  const users = useProcessUsers(processes);

  // Filter processes
  const filteredProcesses = useMemo(() => {
    if (!processes) return [];
    return filterProcesses(processes, filter);
  }, [processes, filter]);

  // Process map for quick lookup
  const processMap = useMemo(() => {
    if (!processes) return new Map<number, ProcessInfo>();
    return new Map(processes.map((p) => [p.pid, p]));
  }, [processes]);

  // Selected processes for actions
  const selectedProcesses = useMemo(() => {
    return Array.from(selectedPids)
      .map((pid) => processMap.get(pid))
      .filter((p): p is ProcessInfo => p !== undefined);
  }, [selectedPids, processMap]);

  // Handle notifications for process exits
  useEffect(() => {
    if (exitedPids.size > 0) {
      exitedPids.forEach((pid) => {
        const id = ++notificationIdRef.current;
        setNotifications((prev) => [
          ...prev,
          { id, message: `Process ${pid} has exited`, type: 'exit' },
        ]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
      });
    }
  }, [exitedPids]);

  // Handle single selection (tree view)
  const handleSingleSelect = useCallback((pid: number) => {
    setSelectedPid(pid);
    setSelectedPids(new Set([pid]));
  }, []);

  // Handle multi-selection (list view)
  const handleMultiSelect = useCallback(
    (pid: number, addToSelection: boolean) => {
      setSelectedPids((prev) => {
        if (addToSelection) {
          const next = new Set(prev);
          if (next.has(pid)) {
            next.delete(pid);
          } else {
            next.add(pid);
          }
          return next;
        } else {
          return new Set([pid]);
        }
      });
      setSelectedPid(pid);
    },
    []
  );

  // Handle range selection
  const handleRangeSelect = useCallback(
    (startPid: number, endPid: number) => {
      if (!filteredProcesses) return;

      const pids = filteredProcesses.map((p) => p.pid);
      const startIdx = pids.indexOf(startPid);
      const endIdx = pids.indexOf(endPid);

      if (startIdx === -1 || endIdx === -1) return;

      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);

      const newSelection = new Set<number>();
      for (let i = minIdx; i <= maxIdx; i++) {
        newSelection.add(pids[i]);
      }

      setSelectedPids(newSelection);
    },
    [filteredProcesses]
  );

  // Open details panel
  const handleOpenDetails = useCallback((pid: number) => {
    setDetailsPid(pid);
  }, []);

  // Close details panel
  const handleCloseDetails = useCallback(() => {
    setDetailsPid(null);
  }, []);

  // Clear selection after action
  const handleActionComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Dismiss notification
  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Calculate container height
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(window.innerHeight - rect.top - 32);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div className="sentinel-page h-full flex flex-col">
      {/* Header */}
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Processes · Live</div>
          <h1>Process Explorer</h1>
          <p>Monitor and manage running processes</p>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div
            className="flex items-center rounded-lg p-1"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <button
              onClick={() => setViewMode('tree')}
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: viewMode === 'tree' ? 'var(--emerald-400)' : 'transparent',
                color: viewMode === 'tree' ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              <GitBranch className="w-4 h-4" />
              <span>Tree</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--emerald-400)' : 'transparent',
                color: viewMode === 'list' ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              <List className="w-4 h-4" />
              <span>List</span>
            </button>
          </div>

          {/* Auto-refresh Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: autoRefresh ? 'var(--severity-low-bg)' : 'var(--surface)',
                color: autoRefresh ? 'var(--severity-low)' : 'var(--muted)',
                border: `1px solid ${autoRefresh ? 'var(--severity-low)' : 'var(--border)'}`,
              }}
            >
              <RefreshCw
                className={clsx('w-4 h-4', autoRefresh && 'animate-spin')}
              />
              <span>{autoRefresh ? 'Auto' : 'Manual'}</span>
            </button>

            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="rounded-lg px-2 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
              >
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
              </select>
            )}

            {!autoRefresh && (
              <button
                onClick={() => refetch()}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--emerald-400)',
                  color: 'var(--bg)',
                }}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <ProcessFilters
        filter={filter}
        onFilterChange={setFilter}
        users={users}
        processCount={filteredProcesses.length}
      />

      {/* Main Content */}
      <div className="flex-1 flex gap-4 mt-4" ref={containerRef}>
        {/* Process View */}
        <div
          className="flex-1 rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {isLoading && !processes ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw
                className="w-8 h-8 animate-spin"
                style={{ color: 'var(--emerald-400)' }}
              />
            </div>
          ) : viewMode === 'tree' ? (
            <ProcessTree
              processes={filteredProcesses}
              selectedPid={selectedPid}
              onSelect={handleSingleSelect}
              newPids={newPids}
              height={containerHeight - 100}
            />
          ) : (
            <ProcessList
              processes={filteredProcesses}
              selectedPids={selectedPids}
              onSelect={handleMultiSelect}
              onSelectRange={handleRangeSelect}
              newPids={newPids}
              height={containerHeight - 100}
            />
          )}
        </div>

        {/* Actions Panel */}
        <div className="w-72 flex-shrink-0">
          <ProcessActions
            selectedProcesses={selectedProcesses}
            onActionComplete={handleActionComplete}
          />

          {/* Quick Info */}
          {selectedPid && processMap.get(selectedPid) && (
            <div
              className="mt-4 rounded-lg p-4"
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <h4
                className="text-sm font-medium mb-3"
                style={{ color: 'var(--muted)' }}
              >
                Quick Info
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--fg-2)' }}>Name</span>
                  <span
                    className="truncate max-w-[150px]"
                    style={{ color: 'var(--fg)' }}
                  >
                    {processMap.get(selectedPid)!.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--fg-2)' }}>PID</span>
                  <span style={{ color: 'var(--fg)' }}>{selectedPid}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--fg-2)' }}>CPU</span>
                  <span style={{ color: 'var(--fg)' }}>
                    {processMap.get(selectedPid)!.cpu_usage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--fg-2)' }}>Memory</span>
                  <span style={{ color: 'var(--fg)' }}>
                    {processMap.get(selectedPid)!.memory_mb.toFixed(1)} MB
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleOpenDetails(selectedPid)}
                className="w-full mt-4 px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--fg)',
                }}
              >
                View Details
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details Panel */}
      <ProcessDetailsPanel pid={detailsPid} onClose={handleCloseDetails} />

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-30">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg"
              style={{
                backgroundColor:
                  notification.type === 'exit'
                    ? 'var(--severity-critical-bg)'
                    : 'var(--severity-low-bg)',
                border: `1px solid ${
                  notification.type === 'exit'
                    ? 'var(--severity-critical)'
                    : 'var(--severity-low)'
                }`,
                color:
                  notification.type === 'exit'
                    ? 'var(--severity-critical)'
                    : 'var(--severity-low)',
              }}
            >
              <Bell className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{notification.message}</span>
              <button
                onClick={() => dismissNotification(notification.id)}
                className="p-1 rounded transition-colors"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
