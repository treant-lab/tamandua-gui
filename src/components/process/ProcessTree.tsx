import { useCallback, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Cpu,
  Server,
  AppWindow,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ProcessInfo,
  buildProcessTree,
  flattenProcessTree,
  getProcessType,
  getTrustLevel,
} from '../../hooks/useProcesses';

interface ProcessTreeProps {
  processes: ProcessInfo[];
  selectedPid: number | null;
  onSelect: (pid: number) => void;
  newPids: Set<number>;
  height: number;
}

export function ProcessTree({
  processes,
  selectedPid,
  onSelect,
  newPids,
  height,
}: ProcessTreeProps) {
  const [expandedPids, setExpandedPids] = useState<Set<number>>(
    () => new Set([0, 1, 4]) // Expand root by default
  );

  const toggleExpand = useCallback((pid: number) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedPids(new Set(processes.map((p) => p.pid)));
  }, [processes]);

  const collapseAll = useCallback(() => {
    setExpandedPids(new Set());
  }, []);

  const tree = useMemo(
    () => buildProcessTree(processes, expandedPids),
    [processes, expandedPids]
  );

  const flattenedTree = useMemo(() => flattenProcessTree(tree), [tree]);

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const node = flattenedTree[index];
      const isNew = newPids.has(node.pid);
      const isSelected = selectedPid === node.pid;
      const hasChildren = node.children.length > 0;
      const processType = getProcessType(node);
      const trustLevel = getTrustLevel(node);

      return (
        <motion.div
          style={style}
          initial={isNew ? { backgroundColor: 'rgba(34, 197, 94, 0.3)' } : false}
          animate={{ backgroundColor: 'transparent' }}
          transition={{ duration: 2 }}
          className={clsx(
            'flex items-center px-4 py-1 cursor-pointer transition-colors border-b border-gray-700/50',
            isSelected
              ? 'bg-primary-900/50 border-l-2 border-l-primary-500'
              : 'hover:bg-gray-700/50'
          )}
          onClick={() => onSelect(node.pid)}
        >
          {/* Indentation */}
          <div style={{ width: node.depth * 20 }} />

          {/* Expand/Collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.pid);
            }}
            className={clsx(
              'w-5 h-5 flex items-center justify-center mr-2',
              hasChildren
                ? 'text-gray-400 hover:text-white'
                : 'text-transparent'
            )}
          >
            {hasChildren ? (
              node.isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : null}
          </button>

          {/* Process Type Icon */}
          <ProcessTypeIcon type={processType} className="w-4 h-4 mr-2" />

          {/* Critical Badge */}
          {node.is_critical && (
            <span title="Critical System Process">
              <Shield className="w-4 h-4 mr-1 text-amber-500" />
            </span>
          )}

          {/* Process Name */}
          <span
            className={clsx(
              'flex-1 truncate font-medium',
              getTrustColorClass(trustLevel)
            )}
          >
            {node.name}
          </span>

          {/* Trust Indicator */}
          <TrustIndicator level={trustLevel} />

          {/* PID */}
          <span className="w-16 text-right text-gray-500 text-sm">
            {node.pid}
          </span>

          {/* CPU */}
          <span className="w-16 text-right text-gray-400 text-sm">
            {node.cpu_usage.toFixed(1)}%
          </span>

          {/* Memory */}
          <span className="w-20 text-right text-gray-400 text-sm">
            {node.memory_mb.toFixed(1)} MB
          </span>

          {/* User */}
          <span className="w-24 text-right text-gray-500 text-sm truncate ml-2">
            {node.user}
          </span>
        </motion.div>
      );
    },
    [flattenedTree, selectedPid, newPids, onSelect, toggleExpand]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-300">Process Tree</span>
          <span className="text-xs text-gray-500">
            {flattenedTree.length} visible / {processes.length} total
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={expandAll}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-500 font-medium">
        <div className="flex-1">Name</div>
        <div className="w-8" />
        <div className="w-16 text-right">PID</div>
        <div className="w-16 text-right">CPU</div>
        <div className="w-20 text-right">Memory</div>
        <div className="w-24 text-right ml-2">User</div>
      </div>

      {/* Tree List */}
      <List
        height={height - 80}
        itemCount={flattenedTree.length}
        itemSize={36}
        width="100%"
        className="scrollbar-thin"
      >
        {Row}
      </List>
    </div>
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
          <ShieldCheck className="w-4 h-4 text-green-500 ml-2" />
        </span>
      );
    case 'suspicious':
      return (
        <span title="Suspicious">
          <ShieldAlert className="w-4 h-4 text-red-500 ml-2" />
        </span>
      );
    case 'unknown':
      return (
        <span title="Unknown">
          <ShieldQuestion className="w-4 h-4 text-yellow-500 ml-2" />
        </span>
      );
  }
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
