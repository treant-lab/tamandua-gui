import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Cpu,
  Database,
  FileSearch,
  Globe2,
  MemoryStick,
  Network,
  Shield,
} from 'lucide-react';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CollectorStatus } from './ComponentStatusDashboard';

interface CollectorGridProps {
  collectors: CollectorStatus[];
  queuedEvents?: number;
  activeProfile?: string | null;
}

const criticalCollectors = new Set([
  'process',
  'file',
  'network',
  'dns',
  'registry',
  'etw',
  'health',
]);

const heavyCollectors = new Set([
  'injection',
  'memory',
  'network_dpi',
  'network_anomaly',
  'credential_theft',
  'lateral_movement',
  'syscall_evasion',
  'defense_evasion',
  'exploit_mitigation',
  'process_hollowing',
  'scheduled_tasks',
]);

const expectedProfileCollectors: Record<string, string[]> = {
  aggressive: [
    'process',
    'file',
    'network',
    'dns',
    'registry',
    'usb',
    'ransomware_canary',
    'health',
    'etw',
    'persistence',
    'fim',
    'ntdll_write_monitor',
  ],
  balanced: [
    'process',
    'file',
    'network',
    'dns',
    'registry',
    'usb',
    'ransomware_canary',
    'health',
    'persistence',
    'fim',
    'etw',
  ],
  lightweight: [
    'process',
    'file',
    'network',
    'dns',
    'registry',
    'usb',
    'ransomware_canary',
    'health',
  ],
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function labelFor(name: string) {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function iconFor(name: string) {
  const base = 'h-4 w-4';
  switch (name) {
    case 'process':
      return <Activity className={base} />;
    case 'file':
    case 'fim':
      return <FileSearch className={base} />;
    case 'network':
    case 'network_dpi':
    case 'network_anomaly':
      return <Network className={base} />;
    case 'dns':
      return <Globe2 className={base} />;
    case 'memory':
      return <MemoryStick className={base} />;
    case 'registry':
    case 'etw':
      return <Database className={base} />;
    default:
      return <Shield className={base} />;
  }
}

export function CollectorGrid({ collectors, queuedEvents = 0, activeProfile }: CollectorGridProps) {
  const [page, setPage] = React.useState(0);
  const pageSize = 8;
  const sortedCollectors = [...collectors].sort((a, b) => {
    if (a.running !== b.running) return a.running ? -1 : 1;
    if (criticalCollectors.has(a.name) !== criticalCollectors.has(b.name)) {
      return criticalCollectors.has(a.name) ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const runningCount = collectors.filter((collector) => collector.running).length;
  const errorCount = collectors.filter((collector) => collector.errors > 0).length;
  const heavyRunning = collectors.filter(
    (collector) => collector.running && heavyCollectors.has(collector.name)
  ).length;
  const totalEvents = collectors.reduce((sum, collector) => sum + collector.total_events, 0);
  const totalRate = collectors.reduce((sum, collector) => sum + collector.events_per_second, 0);
  const expected = activeProfile ? expectedProfileCollectors[activeProfile] : undefined;
  const expectedSet = new Set(expected || []);
  const unexpectedRunning = expected
    ? collectors.filter((collector) => collector.running && !expectedSet.has(collector.name))
    : [];
  const missingExpected = expected
    ? expected.filter((name) => !collectors.some((collector) => collector.name === name && collector.running))
    : [];
  const totalPages = Math.max(1, Math.ceil(sortedCollectors.length / pageSize));
  const visibleCollectors = sortedCollectors.slice(page * pageSize, page * pageSize + pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [activeProfile, collectors.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg">Collectors</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Runtime collectors reported by local IPC
              {activeProfile ? ` · active profile: ${activeProfile}` : ''}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Badge variant={runningCount > 0 ? 'success' : 'warning'}>
              {runningCount}/{collectors.length} running
            </Badge>
            <Badge variant={heavyRunning > 0 ? 'warning' : 'secondary'}>
              {heavyRunning} heavy
            </Badge>
            <Badge variant={errorCount > 0 ? 'destructive' : 'secondary'}>
              {errorCount} errors
            </Badge>
            <Badge variant="outline">{totalRate.toFixed(1)} eps</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {collectors.length === 0 ? (
          <div className="flex min-h-[104px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            No collectors are currently reported by the agent.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="grid grid-cols-[minmax(190px,1.5fr)_90px_90px_90px_100px] gap-3 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Collector</span>
              <span>Status</span>
              <span>Events/s</span>
              <span>Total</span>
              <span>Resource</span>
            </div>
            <div className="divide-y divide-border">
              {visibleCollectors.map((collector) => {
                const isHeavy = heavyCollectors.has(collector.name);
                const hasError = collector.errors > 0 || Boolean(collector.last_error);
                return (
                  <div
                    key={collector.name}
                    className={cn(
                      'grid grid-cols-[minmax(190px,1.5fr)_90px_90px_90px_100px] gap-3 px-3 py-2.5 text-sm transition-colors',
                      collector.running ? 'bg-card hover:bg-muted/20' : 'bg-destructive/5',
                      hasError && 'bg-warning-500/5'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                          collector.running
                            ? isHeavy
                              ? 'border-warning-500/40 bg-warning-500/10 text-warning-500'
                              : 'border-success-500/35 bg-success-500/10 text-success-500'
                            : 'border-destructive/40 bg-destructive/10 text-destructive'
                        )}
                      >
                        {iconFor(collector.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {labelFor(collector.name)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{collector.name}</span>
                          {isHeavy && <span>heavy</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-medium',
                          collector.running ? 'text-success-500' : 'text-destructive'
                        )}
                      >
                        {collector.running ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <CircleDot className="h-3.5 w-3.5" />
                        )}
                        {collector.running ? 'Running' : 'Stopped'}
                      </span>
                    </div>

                    <div className="flex items-center font-mono text-xs">
                      {collector.events_per_second.toFixed(1)}
                    </div>
                    <div className="flex items-center font-mono text-xs">
                      {formatNumber(collector.total_events)}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono">{collector.cpu_percent.toFixed(1)}%</span>
                      <span className="text-muted-foreground">{formatBytes(collector.memory_bytes)}</span>
                    </div>

                    {hasError && (
                      <div className="col-span-5 flex items-center gap-2 rounded-md bg-warning-500/10 px-2 py-1 text-xs text-warning-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="truncate">
                          {collector.last_error || `${collector.errors} collector errors reported`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sortedCollectors.length)} of {sortedCollectors.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous
              </button>
              <span>{page + 1}/{totalPages}</span>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {activeProfile && expected && (unexpectedRunning.length > 0 || missingExpected.length > 0) && (
          <p className="mt-3 text-xs text-warning-500">
            Runtime collector set does not exactly match the {activeProfile} profile.
            {unexpectedRunning.length > 0 && ` Extra running: ${unexpectedRunning.map((collector) => collector.name).join(', ')}.`}
            {missingExpected.length > 0 && ` Missing: ${missingExpected.join(', ')}.`}
          </p>
        )}

        {collectors.length > 0 && totalEvents === 0 && queuedEvents > 0 && (
          <p className="mt-3 text-xs text-warning-500">
            Collector counters are runtime-only and currently report zero, but the local backend queue has {formatNumber(queuedEvents)} events waiting to sync.
          </p>
        )}

        {collectors.length > 0 && totalEvents === 0 && queuedEvents === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Event counters are zero because the agent has not emitted collector telemetry yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
