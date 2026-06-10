import { useCallback, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { motion } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Cpu,
  Server,
  AppWindow,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ProcessInfo,
  getProcessType,
  getTrustLevel,
} from '../../hooks/useProcesses';

type SortField = 'name' | 'pid' | 'cpu' | 'memory' | 'user' | 'status';
type SortDirection = 'asc' | 'desc';

interface ProcessListProps {
  processes: ProcessInfo[];
  selectedPids: Set<number>;
  onSelect: (pid: number, multi: boolean) => void;
  onSelectRange: (startPid: number, endPid: number) => void;
  newPids: Set<number>;
  height: number;
}

export function ProcessList({
  processes,
  selectedPids,
  onSelect,
  onSelectRange,
  newPids,
  height,
}: ProcessListProps) {
  const [sortField, setSortField] = useState<SortField>('cpu');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField]
  );

  const sortedProcesses = useMemo(() => {
    const sorted = [...processes].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.name ?? '').localeCompare(b.name ?? '');
          break;
        case 'pid':
          comparison = (a.pid ?? 0) - (b.pid ?? 0);
          break;
        case 'cpu':
          comparison = (a.cpu_usage ?? 0) - (b.cpu_usage ?? 0);
          break;
        case 'memory':
          comparison = (a.memory_mb ?? 0) - (b.memory_mb ?? 0);
          break;
        case 'user':
          comparison = (a.user ?? '').localeCompare(b.user ?? '');
          break;
        case 'status':
          comparison = (a.status ?? '').localeCompare(b.status ?? '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [processes, sortField, sortDirection]);

  const handleRowClick = useCallback(
    (pid: number, index: number, event: React.MouseEvent) => {
      if (event.shiftKey && lastSelectedIndex !== null) {
        const startIdx = Math.min(lastSelectedIndex, index);
        const endIdx = Math.max(lastSelectedIndex, index);
        const startPid = sortedProcesses[startIdx].pid;
        const endPid = sortedProcesses[endIdx].pid;
        onSelectRange(startPid, endPid);
      } else {
        onSelect(pid, event.ctrlKey || event.metaKey);
        setLastSelectedIndex(index);
      }
    },
    [lastSelectedIndex, sortedProcesses, onSelect, onSelectRange]
  );

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const proc = sortedProcesses[index];
      const isNew = newPids.has(proc.pid);
      const isSelected = selectedPids.has(proc.pid);
      const processType = getProcessType(proc);
      const trustLevel = getTrustLevel(proc);

      return (
        <motion.div
          style={style}
          initial={isNew ? { backgroundColor: 'rgba(34, 197, 94, 0.3)' } : false}
          animate={{ backgroundColor: 'transparent' }}
          transition={{ duration: 2 }}
          className={clsx(
            'flex items-center px-4 cursor-pointer transition-colors border-b border-gray-700/50',
            isSelected
              ? 'bg-primary-900/50'
              : 'hover:bg-gray-700/50'
          )}
          onClick={(e) => handleRowClick(proc.pid, index, e)}
        >
          {/* Checkbox */}
          <div className="w-8">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
            />
          </div>

          {/* Process Type Icon */}
          <div className="w-8">
            <ProcessTypeIcon type={processType} className="w-4 h-4" />
          </div>

          {/* Critical Badge */}
          <div className="w-6">
            {proc.is_critical && (
              <span title="Critical System Process">
                <Shield className="w-4 h-4 text-amber-500" />
              </span>
            )}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0 flex items-center">
            <span
              className={clsx(
                'truncate font-medium',
                getTrustColorClass(trustLevel)
              )}
            >
              {proc.name}
            </span>
            <TrustIndicator level={trustLevel} />
          </div>

          {/* PID */}
          <div className="w-20 text-right text-gray-400 tabular-nums">
            {proc.pid}
          </div>

          {/* CPU */}
          <div className="w-20 text-right tabular-nums">
            <span
              className={clsx(
                (proc.cpu_usage ?? 0) > 50
                  ? 'text-red-400'
                  : (proc.cpu_usage ?? 0) > 20
                  ? 'text-yellow-400'
                  : 'text-gray-400'
              )}
            >
              {(proc.cpu_usage ?? 0).toFixed(1)}%
            </span>
          </div>

          {/* Memory */}
          <div className="w-24 text-right text-gray-400 tabular-nums">
            {formatMemory(proc.memory_mb ?? 0)}
          </div>

          {/* User */}
          <div className="w-32 text-right text-gray-500 truncate">
            {proc.user ?? '-'}
          </div>

          {/* Status */}
          <div className="w-24 text-right">
            <StatusBadge status={proc.status} />
          </div>
        </motion.div>
      );
    },
    [sortedProcesses, selectedPids, newPids, handleRowClick]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-300">Process List</span>
          <span className="text-xs text-gray-500">
            {selectedPids.size > 0
              ? `${selectedPids.size} selected`
              : `${processes.length} processes`}
          </span>
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Click to select, Ctrl+Click for multi-select, Shift+Click for range
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-xs font-medium">
        <div className="w-8" />
        <div className="w-8" />
        <div className="w-6" />

        <SortableHeader
          label="Name"
          field="name"
          currentField={sortField}
          direction={sortDirection}
          onClick={handleSort}
          className="flex-1"
        />

        <SortableHeader
          label="PID"
          field="pid"
          currentField={sortField}
          direction={sortDirection}
          onClick={handleSort}
          className="w-20 justify-end"
        />

        <SortableHeader
          label="CPU %"
          field="cpu"
          currentField={sortField}
          direction={sortDirection}
          onClick={handleSort}
          className="w-20 justify-end"
        />

        <SortableHeader
          label="Memory"
          field="memory"
          currentField={sortField}
          direction={sortDirection}
          onClick={handleSort}
          className="w-24 justify-end"
        />

        <SortableHeader
          label="User"
          field="user"
          currentField={sortField}
          direction={sortDirection}
          onClick={handleSort}
          className="w-32 justify-end"
        />

        <SortableHeader
          label="Status"
          field="status"
          currentField={sortField}
          direction={sortDirection}
          onClick={handleSort}
          className="w-24 justify-end"
        />
      </div>

      {/* Process List */}
      <List
        height={height - 80}
        itemCount={sortedProcesses.length}
        itemSize={40}
        width="100%"
        className="scrollbar-thin"
      >
        {Row}
      </List>
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onClick: (field: SortField) => void;
  className?: string;
}

function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onClick,
  className,
}: SortableHeaderProps) {
  const isActive = currentField === field;

  return (
    <button
      onClick={() => onClick(field)}
      className={clsx(
        'flex items-center text-gray-500 hover:text-white transition-colors',
        className
      )}
    >
      <span className={isActive ? 'text-primary-400' : ''}>{label}</span>
      {isActive && (
        <span className="ml-1">
          {direction === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )}
        </span>
      )}
    </button>
  );
}

function ProcessTypeIcon({
  type,
  className,
}: {
  type: 'system' | 'service' | 'user';
  className?: string;
}) {
  switch (type) {
    case 'system':
      return <Cpu className={clsx(className, 'text-purple-400')} />;
    case 'service':
      return <Server className={clsx(className, 'text-blue-400')} />;
    case 'user':
      return <AppWindow className={clsx(className, 'text-gray-400')} />;
  }
}

function TrustIndicator({ level }: { level: 'trusted' | 'unknown' | 'suspicious' }) {
  switch (level) {
    case 'trusted':
      return (
        <span title="Trusted (Signed)">
          <ShieldCheck className="w-4 h-4 text-green-500 ml-2 flex-shrink-0" />
        </span>
      );
    case 'suspicious':
      return (
        <span title="Suspicious">
          <ShieldAlert className="w-4 h-4 text-red-500 ml-2 flex-shrink-0" />
        </span>
      );
    case 'unknown':
      return (
        <span title="Unknown">
          <ShieldQuestion className="w-4 h-4 text-yellow-500 ml-2 flex-shrink-0" />
        </span>
      );
  }
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = {
    running: 'bg-green-900/50 text-green-400 border-green-700',
    suspended: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    stopped: 'bg-red-900/50 text-red-400 border-red-700',
    zombie: 'bg-purple-900/50 text-purple-400 border-purple-700',
  }[status] || 'bg-gray-700 text-gray-400 border-gray-600';

  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 text-xs rounded border',
        colorClass
      )}
    >
      {status}
    </span>
  );
}

function getTrustColorClass(level: 'trusted' | 'unknown' | 'suspicious'): string {
  switch (level) {
    case 'trusted':
      return 'text-green-400';
    case 'suspicious':
      return 'text-red-400';
    case 'unknown':
      return 'text-yellow-400';
  }
}

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}
