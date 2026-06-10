import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';

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

function formatRelativeSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

import {
  X,
  Clock,
  FolderOpen,
  Terminal,
  User,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Network,
  FileText,
  Puzzle,
  MemoryStick,
  AlertTriangle,
  Loader2,
  Copy,
} from 'lucide-react';
import clsx from 'clsx';
import { useProcessDetails, ProcessDetails as ProcessDetailsType, getTrustLevel } from '../../hooks/useProcesses';

interface ProcessDetailsPanelProps {
  pid: number | null;
  onClose: () => void;
}

type TabId = 'overview' | 'network' | 'handles' | 'modules' | 'memory';

export function ProcessDetailsPanel({ pid, onClose }: ProcessDetailsPanelProps) {
  const { data: details, isLoading, error } = useProcessDetails(pid);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      {pid !== null && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[600px] bg-gray-800 border-l border-gray-700 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold">Process Details</h2>
                {details && (
                  <span className="text-sm text-gray-400">
                    PID: {details.pid}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                  <p className="text-red-400">Failed to load process details</p>
                </div>
              </div>
            ) : details ? (
              <>
                {/* Process Name & Status */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center space-x-3">
                    <TrustBadge level={getTrustLevel(details)} />
                    <h3 className="text-xl font-semibold">{details.name}</h3>
                    {details.is_critical && (
                      <span className="px-2 py-1 text-xs bg-amber-900/50 text-amber-400 border border-amber-700 rounded">
                        Critical
                      </span>
                    )}
                  </div>
                  {details.threat_score != null && (
                    <div className="mt-2">
                      <ThreatScoreBar score={details.threat_score} />
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                  {[
                    { id: 'overview' as TabId, label: 'Overview', icon: FileText },
                    { id: 'network' as TabId, label: 'Network', icon: Network, count: details.network_connections?.length ?? 0 },
                    { id: 'handles' as TabId, label: 'Handles', icon: FileText, count: details.open_handles?.length ?? 0 },
                    { id: 'modules' as TabId, label: 'Modules', icon: Puzzle, count: details.loaded_modules?.length ?? 0 },
                    { id: 'memory' as TabId, label: 'Memory', icon: MemoryStick, count: details.memory_map?.length ?? 0 },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'flex items-center space-x-2 px-4 py-3 text-sm transition-colors border-b-2',
                        activeTab === tab.id
                          ? 'border-primary-500 text-primary-400'
                          : 'border-transparent text-gray-400 hover:text-white'
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className="text-xs text-gray-500">({tab.count})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto p-4">
                  {activeTab === 'overview' && (
                    <OverviewTab details={details} onCopy={copyToClipboard} />
                  )}
                  {activeTab === 'network' && (
                    <NetworkTab connections={details.network_connections ?? []} />
                  )}
                  {activeTab === 'handles' && (
                    <HandlesTab handles={details.open_handles ?? []} />
                  )}
                  {activeTab === 'modules' && (
                    <ModulesTab modules={details.loaded_modules ?? []} />
                  )}
                  {activeTab === 'memory' && (
                    <MemoryTab regions={details.memory_map ?? []} />
                  )}
                </div>
              </>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TrustBadge({ level }: { level: 'trusted' | 'unknown' | 'suspicious' }) {
  const config = {
    trusted: {
      icon: ShieldCheck,
      class: 'bg-green-900/50 text-green-400 border-green-700',
      label: 'Trusted',
    },
    unknown: {
      icon: ShieldQuestion,
      class: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
      label: 'Unknown',
    },
    suspicious: {
      icon: ShieldAlert,
      class: 'bg-red-900/50 text-red-400 border-red-700',
      label: 'Suspicious',
    },
  }[level];

  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'flex items-center space-x-1 px-2 py-1 text-xs rounded border',
        config.class
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </span>
  );
}

function ThreatScoreBar({ score }: { score: number }) {
  const percentage = score * 100;
  const color =
    score > 0.7
      ? 'bg-red-500'
      : score > 0.3
      ? 'bg-yellow-500'
      : 'bg-green-500';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">ML Threat Score</span>
        <span
          className={clsx(
            score > 0.7
              ? 'text-red-400'
              : score > 0.3
              ? 'text-yellow-400'
              : 'text-green-400'
          )}
        >
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={clsx('h-2 rounded-full transition-all', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function OverviewTab({
  details,
  onCopy,
}: {
  details: ProcessDetailsType;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Section title="Basic Information">
        <InfoRow
          icon={Terminal}
          label="Full Path"
          value={details.exe_path ?? ''}
          copiable
          onCopy={onCopy}
        />
        <InfoRow
          icon={Terminal}
          label="Command Line"
          value={details.command_line ?? ''}
          copiable
          onCopy={onCopy}
        />
        <InfoRow
          icon={FolderOpen}
          label="Working Directory"
          value={details.working_directory ?? ''}
          copiable
          onCopy={onCopy}
        />
        <InfoRow icon={User} label="User" value={details.user ?? ''} />
        <InfoRow
          icon={Clock}
          label="Started"
          value={`${formatDateSafe(details.started_at, 'PPpp')}${formatRelativeSafe(details.started_at) ? ` (${formatRelativeSafe(details.started_at)})` : ''}`}
        />
      </Section>

      {/* Parent Process */}
      {details.parent_info && (
        <Section title="Parent Process">
          <InfoRow label="Name" value={details.parent_info.name} />
          <InfoRow label="PID" value={details.parent_info.pid.toString()} />
          <InfoRow
            label="Path"
            value={details.parent_info.exe_path ?? ''}
            copiable
            onCopy={onCopy}
          />
        </Section>
      )}

      {/* Digital Signature */}
      <Section title="Digital Signature">
        <InfoRow
          label="Status"
          value={details.is_signed ? 'Signed' : 'Unsigned'}
          valueClass={details.is_signed ? 'text-green-400' : 'text-yellow-400'}
        />
        {details.signer_name && (
          <InfoRow label="Signer" value={details.signer_name} />
        )}
      </Section>

      {/* Resource Usage */}
      <Section title="Resource Usage">
        <div className="grid grid-cols-2 gap-4">
          <StatBox label="CPU" value={`${details.cpu_usage.toFixed(1)}%`} />
          <StatBox
            label="Memory"
            value={`${details.memory_mb.toFixed(1)} MB`}
          />
          <StatBox label="Threads" value={details.threads.toString()} />
          <StatBox label="Handles" value={(details.handles ?? details.open_handles?.length ?? 0).toString()} />
        </div>
      </Section>
    </div>
  );
}

function NetworkTab({
  connections,
}: {
  connections: ProcessDetailsType['network_connections'];
}) {
  if (connections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No active network connections</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2 py-1">
        <div className="col-span-1">Proto</div>
        <div className="col-span-4">Local</div>
        <div className="col-span-4">Remote</div>
        <div className="col-span-3">State</div>
      </div>
      {connections.map((conn, idx) => (
        <div
          key={idx}
          className="grid grid-cols-12 gap-2 text-sm px-2 py-2 bg-gray-700/50 rounded"
        >
          <div className="col-span-1 text-gray-400 uppercase">
            {conn.protocol}
          </div>
          <div className="col-span-4 text-gray-300 font-mono text-xs">
            {conn.local_addr}:{conn.local_port}
          </div>
          <div className="col-span-4 text-gray-300 font-mono text-xs">
            {conn.remote_addr
              ? `${conn.remote_addr}:${conn.remote_port}`
              : '-'}
          </div>
          <div className="col-span-3">
            <ConnectionStateBadge state={conn.state} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HandlesTab({
  handles,
}: {
  handles: ProcessDetailsType['open_handles'];
}) {
  if (handles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No open handles</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {handles.map((handle, idx) => (
        <div
          key={idx}
          className="flex items-center space-x-3 px-2 py-2 bg-gray-700/50 rounded text-sm"
        >
          <span className="text-xs text-gray-500 w-20 flex-shrink-0">
            {handle.handle_type}
          </span>
          <span className="text-gray-300 truncate font-mono text-xs">
            {handle.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModulesTab({
  modules,
}: {
  modules: ProcessDetailsType['loaded_modules'];
}) {
  if (modules.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Puzzle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No loaded modules</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {modules.map((mod, idx) => (
        <div key={idx} className="px-3 py-2 bg-gray-700/50 rounded">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-200">{mod.name}</span>
            <div className="flex items-center space-x-2">
              {mod.is_signed ? (
                <ShieldCheck className="w-4 h-4 text-green-500" />
              ) : (
                <ShieldQuestion className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-xs text-gray-500">
                {formatBytes(mod.size_bytes)}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500 font-mono truncate">
            {mod.path}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-1">
            Base: {mod.base_address}
          </div>
        </div>
      ))}
    </div>
  );
}

function MemoryTab({
  regions,
}: {
  regions: ProcessDetailsType['memory_map'];
}) {
  if (regions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MemoryStick className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No memory regions</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2 py-1">
        <div className="col-span-3">Address</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Protection</div>
        <div className="col-span-2">State</div>
        <div className="col-span-3">Type</div>
      </div>
      {regions.map((region, idx) => (
        <div
          key={idx}
          className="grid grid-cols-12 gap-2 text-xs px-2 py-2 bg-gray-700/50 rounded font-mono"
        >
          <div className="col-span-3 text-gray-400">{region.base_address}</div>
          <div className="col-span-2 text-gray-400">
            {formatBytes(region.size_bytes)}
          </div>
          <div className="col-span-2">
            <ProtectionBadge protection={region.protection} />
          </div>
          <div className="col-span-2 text-gray-400">{region.state}</div>
          <div className="col-span-3 text-gray-400">{region.region_type}</div>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-400 mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  copiable,
  onCopy,
  valueClass,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  copiable?: boolean;
  onCopy?: (text: string) => void;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start space-x-3 py-2 border-b border-gray-700/50">
      {Icon && <Icon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div
          className={clsx(
            'text-sm break-all',
            valueClass || 'text-gray-300'
          )}
        >
          {value || '-'}
        </div>
      </div>
      {copiable && onCopy && (
        <button
          onClick={() => onCopy(value)}
          className="p-1 text-gray-500 hover:text-white transition-colors"
          title="Copy to clipboard"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ConnectionStateBadge({ state }: { state: string }) {
  const colorClass = {
    ESTABLISHED: 'bg-green-900/50 text-green-400 border-green-700',
    LISTEN: 'bg-blue-900/50 text-blue-400 border-blue-700',
    TIME_WAIT: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    CLOSE_WAIT: 'bg-orange-900/50 text-orange-400 border-orange-700',
    CLOSED: 'bg-gray-700 text-gray-400 border-gray-600',
  }[state] || 'bg-gray-700 text-gray-400 border-gray-600';

  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 text-xs rounded border',
        colorClass
      )}
    >
      {state}
    </span>
  );
}

function ProtectionBadge({ protection }: { protection: string }) {
  const hasExecute = protection.includes('X') || protection.toLowerCase().includes('exec');
  const hasWrite = protection.includes('W') || protection.toLowerCase().includes('write');

  const colorClass =
    hasExecute && hasWrite
      ? 'text-red-400'
      : hasExecute
      ? 'text-yellow-400'
      : 'text-gray-400';

  return <span className={colorClass}>{protection}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
