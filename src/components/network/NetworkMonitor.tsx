import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Filter,
  Globe,
  Lock,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/use-toast';
import {
  useNetworkConnections,
  filterConnections,
  calculateNetworkStats,
  getCertificateRiskLabel,
  getDomainCandidates,
  getEncryptionState,
  getLocalAddress,
  getPid,
  getPrimaryDomain,
  getProcessName,
  getRemoteAddress,
  getReputationLabel,
  getSni,
  normalizeProtocol,
  normalizeState,
  type NetworkConnection,
  type NetworkFilter,
  type ConnectionState,
  type NetworkReputation,
} from '../../hooks/useNetwork';
import {
  useBlockDomain,
  useBlockIp,
  useIsolateHost,
  useRestoreHost,
  useUnblockDomain,
  useUnblockIp,
} from '../../hooks/useResponseActions';

type SortField =
  | 'process'
  | 'pid'
  | 'protocol'
  | 'local'
  | 'remote'
  | 'domain'
  | 'state'
  | 'reputation'
  | 'cert';
type SortDirection = 'asc' | 'desc';

interface NetworkMonitorProps {
  className?: string;
}

export function NetworkMonitor({ className }: NetworkMonitorProps) {
  const {
    data: connections = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useNetworkConnections();
  const blockIp = useBlockIp();
  const unblockIp = useUnblockIp();
  const blockDomain = useBlockDomain();
  const unblockDomain = useUnblockDomain();
  const isolateHost = useIsolateHost();
  const restoreHost = useRestoreHost();

  const [filter, setFilter] = useState<NetworkFilter>({
    search: '',
    protocol: 'all',
    state: 'all',
  });
  const [sortField, setSortField] = useState<SortField>('state');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const actionBusy =
    blockIp.isPending ||
    unblockIp.isPending ||
    blockDomain.isPending ||
    unblockDomain.isPending ||
    isolateHost.isPending ||
    restoreHost.isPending;

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField]
  );

  const filteredConnections = useMemo(
    () => filterConnections(connections, filter),
    [connections, filter]
  );

  const sortedConnections = useMemo(() => {
    return [...filteredConnections].sort((a, b) => {
      const comparison = getSortValue(a, sortField).localeCompare(getSortValue(b, sortField), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredConnections, sortField, sortDirection]);

  const stats = useMemo(() => calculateNetworkStats(connections), [connections]);
  const hasActiveFilters =
    filter.search !== '' || filter.protocol !== 'all' || filter.state !== 'all';

  const clearFilters = () => {
    setFilter({
      search: '',
      protocol: 'all',
      state: 'all',
    });
  };

  const runAction = useCallback(
    async (label: string, target: string, action: () => Promise<unknown>) => {
      try {
        await action();
        toast({
          title: `${label} submitted`,
          description: target,
        });
      } catch (err) {
        toast({
          title: `${label} failed`,
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      }
    },
    []
  );

  if (isLoading) {
    return (
      <div className={clsx('flex h-64 items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-8 w-8 animate-pulse text-primary-500" />
          <span className="text-gray-400">Loading real network connections...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx('flex h-64 items-center justify-center', className)}>
        <div className="max-w-xl rounded-lg border border-red-900/60 bg-red-950/20 p-5 text-red-300">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6" />
            <div>
              <p className="font-semibold">Failed to load network connections</p>
              <p className="mt-1 text-sm text-red-200/80">{String(error)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-800 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-900/30"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      <NetworkStats stats={stats} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <NetworkFilters
          filter={filter}
          onFilterChange={setFilter}
          connectionCount={sortedConnections.length}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
        <HostContainmentActions
          actionBusy={actionBusy}
          isFetching={isFetching}
          onRefresh={() => refetch()}
          onIsolate={() => runAction('Isolate host', 'local endpoint', () => isolateHost.mutateAsync())}
          onRestore={() => runAction('Restore host', 'local endpoint', () => restoreHost.mutateAsync())}
        />
      </div>

      <Card className="border-gray-700 bg-gray-800">
        <CardHeader className="border-b border-gray-700 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-gray-100">
            <Wifi className="h-5 w-5 text-primary-500" />
            <span>Active Connections</span>
            {isFetching && <span className="text-xs font-normal text-gray-500">refreshing</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-transparent">
                  <SortableHeader
                    label="Process"
                    field="process"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                  <SortableHeader
                    label="Endpoint"
                    field="remote"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                  <SortableHeader
                    label="Domain / SNI"
                    field="domain"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                  <SortableHeader
                    label="TLS / JA3"
                    field="cert"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                  <SortableHeader
                    label="Reputation"
                    field="reputation"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                  <TableHead className="text-right text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedConnections.length === 0 ? (
                  <TableRow className="border-gray-700">
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      No real connections match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedConnections.map((conn, index) => (
                    <ConnectionRow
                      key={getConnectionKey(conn, index)}
                      connection={conn}
                      actionBusy={actionBusy}
                      onBlockIp={(ip) => runAction('Block IP', ip, () => blockIp.mutateAsync(ip))}
                      onUnblockIp={(ip) => runAction('Unblock IP', ip, () => unblockIp.mutateAsync(ip))}
                      onBlockDomain={(domain) =>
                        runAction('Block domain', domain, () => blockDomain.mutateAsync(domain))
                      }
                      onUnblockDomain={(domain) =>
                        runAction('Unblock domain', domain, () => unblockDomain.mutateAsync(domain))
                      }
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NetworkStats({ stats }: { stats: ReturnType<typeof calculateNetworkStats> }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
      <StatCard icon={<Activity className="h-5 w-5 text-blue-400" />} label="Total" value={stats.total} />
      <StatCard icon={<Wifi className="h-5 w-5 text-green-400" />} label="Established" value={stats.established} />
      <StatCard icon={<Server className="h-5 w-5 text-indigo-400" />} label="Listening" value={stats.listening} />
      <StatCard icon={<Shield className="h-5 w-5 text-cyan-400" />} label="TCP" value={stats.tcp} />
      <StatCard icon={<Activity className="h-5 w-5 text-orange-400" />} label="UDP" value={stats.udp} />
      <StatCard icon={<Lock className="h-5 w-5 text-emerald-400" />} label="Encrypted" value={stats.encrypted} />
      <StatCard icon={<ShieldCheck className="h-5 w-5 text-violet-400" />} label="Enriched" value={stats.withReputation} />
      <StatCard icon={<Globe className="h-5 w-5 text-pink-400" />} label="Countries" value={stats.uniqueCountries} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums text-gray-100">{value}</p>
          <p className="truncate text-xs text-gray-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HostContainmentActions({
  actionBusy,
  isFetching,
  onRefresh,
  onIsolate,
  onRestore,
}: {
  actionBusy: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onIsolate: () => void;
  onRestore: () => void;
}) {
  return (
    <Card className="border-gray-700 bg-gray-800 lg:w-[360px]">
      <CardContent className="flex h-full flex-wrap items-center gap-2 p-4">
        <button
          type="button"
          onClick={onIsolate}
          disabled={actionBusy}
          className="inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <WifiOff className="h-4 w-4" />
          Isolate
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={actionBusy}
          className="inline-flex items-center gap-2 rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-100 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wifi className="h-4 w-4" />
          Restore
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </CardContent>
    </Card>
  );
}

function NetworkFilters({
  filter,
  onFilterChange,
  connectionCount,
  hasActiveFilters,
  onClearFilters,
}: {
  filter: NetworkFilter;
  onFilterChange: (filter: NetworkFilter) => void;
  connectionCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <Card className="flex-1 border-gray-700 bg-gray-800">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            <span className="text-gray-500">|</span>
            <span>{connectionCount} connections</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search process, IP, domain, SNI, JA3..."
                value={filter.search}
                onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pl-10 pr-4 text-sm text-gray-100 transition-colors placeholder-gray-500 focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <select
            value={filter.protocol}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                protocol: e.target.value as 'TCP' | 'UDP' | 'all',
              })
            }
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-primary-500 focus:outline-none"
          >
            <option value="all">All protocols</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
          </select>

          <select
            value={filter.state}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                state: e.target.value as ConnectionState | 'all',
              })
            }
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 focus:border-primary-500 focus:outline-none"
          >
            <option value="all">All states</option>
            <option value="ESTABLISHED">Established</option>
            <option value="LISTENING">Listening</option>
            <option value="TIME_WAIT">Time Wait</option>
            <option value="CLOSE_WAIT">Close Wait</option>
            <option value="SYN_SENT">SYN Sent</option>
            <option value="SYN_RECEIVED">SYN Received</option>
            <option value="FIN_WAIT_1">Fin Wait 1</option>
            <option value="FIN_WAIT_2">Fin Wait 2</option>
            <option value="LAST_ACK">Last Ack</option>
            <option value="CLOSING">Closing</option>
            <option value="CLOSED">Closed</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onClick,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onClick: (field: SortField) => void;
}) {
  const isActive = currentField === field;

  return (
    <TableHead
      className="cursor-pointer select-none text-gray-400 transition-colors hover:text-gray-100"
      onClick={() => onClick(field)}
    >
      <div className="flex items-center gap-1">
        <span className={isActive ? 'text-primary-400' : ''}>{label}</span>
        {isActive && (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </div>
    </TableHead>
  );
}

function ConnectionRow({
  connection,
  actionBusy,
  onBlockIp,
  onUnblockIp,
  onBlockDomain,
  onUnblockDomain,
}: {
  connection: NetworkConnection;
  actionBusy: boolean;
  onBlockIp: (ip: string) => void;
  onUnblockIp: (ip: string) => void;
  onBlockDomain: (domain: string) => void;
  onUnblockDomain: (domain: string) => void;
}) {
  const remoteIp = getRemoteAddress(connection);
  const domain = getPrimaryDomain(connection);
  const localAddress = formatAddress(getLocalAddress(connection), connection.local_port);
  const remoteAddress = formatAddress(remoteIp, connection.remote_port);

  return (
    <TableRow className="border-gray-700 align-top hover:bg-gray-700/40">
      <TableCell className="min-w-[180px]">
        <div className="font-medium text-gray-100">{getProcessName(connection)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <PidBadge pid={getPid(connection)} />
          <ProtocolBadge protocol={normalizeProtocol(connection.protocol)} />
          <StateBadge state={normalizeState(connection.state)} />
        </div>
      </TableCell>

      <TableCell className="min-w-[220px]">
        <AddressLine label="Local" value={localAddress} />
        <AddressLine label="Remote" value={remoteAddress} />
        {connection.country_name || connection.org || connection.asn ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <Globe className="h-3.5 w-3.5" />
            <span className="max-w-[260px] truncate">
              {[connection.country_name, connection.city, connection.asn, connection.org].filter(Boolean).join(' / ')}
            </span>
          </div>
        ) : null}
      </TableCell>

      <TableCell className="min-w-[190px]">
        <DomainDisplay connection={connection} />
      </TableCell>

      <TableCell className="min-w-[230px]">
        <SecurityDisplay connection={connection} />
      </TableCell>

      <TableCell className="min-w-[220px]">
        <ReputationDisplay reputation={connection.reputation} enrichment={connection.enrichment} />
      </TableCell>

      <TableCell className="min-w-[220px] text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton
            label="Block IP"
            icon={<Ban className="h-3.5 w-3.5" />}
            disabled={!remoteIp || actionBusy}
            tone="danger"
            onClick={() => remoteIp && onBlockIp(remoteIp)}
          />
          <ActionButton
            label="Unblock IP"
            icon={<Unlock className="h-3.5 w-3.5" />}
            disabled={!remoteIp || actionBusy}
            onClick={() => remoteIp && onUnblockIp(remoteIp)}
          />
          <ActionButton
            label="Block Domain"
            icon={<Ban className="h-3.5 w-3.5" />}
            disabled={!domain || actionBusy}
            tone="danger"
            onClick={() => domain && onBlockDomain(domain)}
          />
          <ActionButton
            label="Unblock Domain"
            icon={<Unlock className="h-3.5 w-3.5" />}
            disabled={!domain || actionBusy}
            onClick={() => domain && onUnblockDomain(domain)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddressLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-gray-500">{label}</span>
      {value ? <span className="truncate font-mono text-gray-300">{value}</span> : <MissingValue />}
    </div>
  );
}

function DomainDisplay({ connection }: { connection: NetworkConnection }) {
  const domains = getDomainCandidates(connection);
  const sni = getSni(connection);

  if (domains.length === 0 && !sni) {
    return <MissingValue label="No domain telemetry" />;
  }

  return (
    <div className="space-y-2">
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {domains.slice(0, 3).map((domain) => (
            <Badge key={domain} className="max-w-[180px] truncate border-blue-800 bg-blue-950/40 text-blue-200">
              {domain}
            </Badge>
          ))}
          {domains.length > 3 && <Badge className="border-gray-700 bg-gray-900/60 text-gray-400">+{domains.length - 3}</Badge>}
        </div>
      )}
      {sni && (
        <div className="text-xs text-gray-400">
          <span className="text-gray-500">SNI </span>
          <span className="font-mono text-gray-300">{sni}</span>
        </div>
      )}
    </div>
  );
}

function SecurityDisplay({ connection }: { connection: NetworkConnection }) {
  const encrypted = getEncryptionState(connection);
  const certRisk = getCertificateRiskLabel(connection.certificate_risk);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <EncryptionBadge encrypted={encrypted} />
        {connection.tls_version ? (
          <Badge className="border-emerald-800 bg-emerald-950/40 text-emerald-200">{connection.tls_version}</Badge>
        ) : (
          <Badge className="border-gray-700 bg-gray-900/50 text-gray-500">TLS unknown</Badge>
        )}
        {certRisk && <CertRiskBadge risk={certRisk} />}
      </div>

      {connection.ja3 || connection.ja3s ? (
        <div className="space-y-1 text-xs">
          <FingerprintLine label="JA3" value={connection.ja3} />
          <FingerprintLine label="JA3S" value={connection.ja3s} />
        </div>
      ) : (
        <MissingValue label="No JA3 fingerprint" />
      )}
    </div>
  );
}

function ReputationDisplay({
  reputation,
  enrichment,
}: {
  reputation: NetworkReputation | undefined;
  enrichment: Record<string, unknown> | null | undefined;
}) {
  const reputationLabel = getReputationLabel(reputation);
  const reputationDetails = getReputationDetails(reputation);
  const entries = Object.entries(enrichment ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4);

  if (!reputationLabel && entries.length === 0) {
    return <MissingValue label="No enrichment" />;
  }

  return (
    <div className="space-y-2">
      {reputationLabel && <ReputationBadge label={reputationLabel} />}
      {reputationDetails.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reputationDetails.map((detail) => (
            <Badge key={detail} className="border-gray-700 bg-gray-900/60 text-gray-300">
              {detail}
            </Badge>
          ))}
        </div>
      )}
      {entries.length > 0 && (
        <div className="space-y-1 text-xs text-gray-400">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[78px_minmax(0,1fr)] gap-2">
              <span className="truncate text-gray-500">{humanizeKey(key)}</span>
              <span className="truncate text-gray-300">{formatUnknown(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FingerprintLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="truncate font-mono text-gray-300" title={value}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  disabled,
  tone = 'default',
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'border-red-800 bg-red-950/30 text-red-200 hover:bg-red-900/40'
          : 'border-gray-600 bg-gray-900/40 text-gray-200 hover:bg-gray-700'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  if (protocol === 'UNKNOWN') {
    return <Badge className="border-gray-700 bg-gray-900/50 text-gray-500">protocol unknown</Badge>;
  }

  return (
    <Badge
      className={clsx(
        'text-xs',
        protocol === 'TCP'
          ? 'border-cyan-700 bg-cyan-900/50 text-cyan-300'
          : 'border-orange-700 bg-orange-900/50 text-orange-300'
      )}
    >
      {protocol}
    </Badge>
  );
}

function PidBadge({ pid }: { pid: number | null }) {
  return (
    <Badge className="border-gray-700 bg-gray-900/60 text-gray-300">
      PID {pid ?? 'unknown'}
    </Badge>
  );
}

function StateBadge({ state }: { state: ConnectionState }) {
  const normalized = normalizeState(state);
  const styles =
    normalized === 'ESTABLISHED'
      ? 'border-green-700 bg-green-900/50 text-green-300'
      : normalized === 'LISTENING'
        ? 'border-blue-700 bg-blue-900/50 text-blue-300'
        : normalized === 'UNKNOWN'
          ? 'border-gray-700 bg-gray-900/50 text-gray-500'
          : 'border-yellow-700 bg-yellow-900/40 text-yellow-300';

  return <Badge className={styles}>{normalized}</Badge>;
}

function EncryptionBadge({ encrypted }: { encrypted: boolean | null }) {
  if (encrypted === true) {
    return (
      <Badge className="border-emerald-700 bg-emerald-950/50 text-emerald-200">
        <Lock className="mr-1 h-3 w-3" />
        encrypted
      </Badge>
    );
  }

  if (encrypted === false) {
    return <Badge className="border-amber-800 bg-amber-950/40 text-amber-200">plain</Badge>;
  }

  return <Badge className="border-gray-700 bg-gray-900/50 text-gray-500">encryption unknown</Badge>;
}

function CertRiskBadge({ risk }: { risk: string }) {
  const lower = risk.toLowerCase();
  const styles =
    lower.includes('critical') || lower.includes('high') || lower.includes('malicious')
      ? 'border-red-700 bg-red-950/50 text-red-200'
      : lower.includes('medium') || lower.includes('warn')
        ? 'border-amber-700 bg-amber-950/50 text-amber-200'
        : lower.includes('low') || lower.includes('clean')
          ? 'border-green-700 bg-green-950/50 text-green-200'
          : 'border-gray-700 bg-gray-900/60 text-gray-300';

  return (
    <Badge className={styles}>
      <AlertTriangle className="mr-1 h-3 w-3" />
      cert {risk}
    </Badge>
  );
}

function ReputationBadge({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const styles =
    lower.includes('malicious') || lower.includes('bad') || lower.includes('high')
      ? 'border-red-700 bg-red-950/50 text-red-200'
      : lower.includes('suspicious') || lower.includes('medium') || lower.includes('unknown')
        ? 'border-amber-700 bg-amber-950/50 text-amber-200'
        : lower.includes('benign') || lower.includes('clean') || lower.includes('good')
          ? 'border-green-700 bg-green-950/50 text-green-200'
          : 'border-gray-700 bg-gray-900/60 text-gray-300';

  return (
    <Badge className={styles}>
      <ShieldCheck className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

function MissingValue({ label = '-' }: { label?: string }) {
  return <span className="text-xs text-gray-500">{label}</span>;
}

function getSortValue(connection: NetworkConnection, field: SortField): string {
  switch (field) {
    case 'process':
      return getProcessName(connection);
    case 'pid':
      return String(getPid(connection) ?? '');
    case 'protocol':
      return normalizeProtocol(connection.protocol);
    case 'local':
      return formatAddress(getLocalAddress(connection), connection.local_port) ?? '';
    case 'remote':
      return formatAddress(getRemoteAddress(connection), connection.remote_port) ?? '';
    case 'domain':
      return getPrimaryDomain(connection) ?? '';
    case 'state':
      return normalizeState(connection.state);
    case 'reputation':
      return getReputationLabel(connection.reputation) ?? '';
    case 'cert':
      return getCertificateRiskLabel(connection.certificate_risk) ?? connection.tls_version ?? connection.ja3 ?? '';
  }
}

function getConnectionKey(connection: NetworkConnection, index: number): string {
  return [
    getPid(connection) ?? 'pid',
    normalizeProtocol(connection.protocol),
    getLocalAddress(connection) ?? 'local',
    connection.local_port ?? 'lp',
    getRemoteAddress(connection) ?? 'remote',
    connection.remote_port ?? 'rp',
    index,
  ].join(':');
}

function formatAddress(address: string | null, port: number | null | undefined): string | null {
  if (!address) return null;
  if (port === null || port === undefined) return address;
  const host = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address;
  return `${host}:${port}`;
}

function getReputationDetails(reputation: NetworkReputation | undefined): string[] {
  if (!reputation || typeof reputation === 'string') return [];

  return [
    typeof reputation.score === 'number' ? `score ${reputation.score}` : null,
    typeof reputation.confidence === 'number' ? `conf ${reputation.confidence}` : null,
    reputation.source ? `src ${reputation.source}` : null,
    Array.isArray(reputation.categories) ? reputation.categories.slice(0, 2).join(', ') : null,
  ].filter((value): value is string => Boolean(value));
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ');
}

function formatUnknown(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatUnknown).join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export default NetworkMonitor;
