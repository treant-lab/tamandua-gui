import {
  useAgentStatus,
  useAgentSetupStatus,
  useAlerts,
  useIsConnected,
  useLinuxCapabilities,
  usePrivilegeStatus,
  useRelaunchAsAdministrator,
  useSystemMetrics,
} from '../hooks/useTauri';
import {
  AlertTriangle,
  Activity,
  HardDrive,
  Cpu,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Clock,
  ChevronRight,
  Server,
} from 'lucide-react';
import clsx from 'clsx';
import { ComponentStatusDashboard } from '../components/status';
import { BlockchainBadgeInline } from '../components/blockchain';
import { formatRelativeSafe } from '../utils/dateUtils';

export function Dashboard() {
  const { data: status, isLoading: statusLoading } = useAgentStatus();
  const { data: setupStatus, isLoading: setupLoading } = useAgentSetupStatus();
  const { data: ipcConnected } = useIsConnected();
  const { data: privilege } = usePrivilegeStatus();
  const relaunchAsAdmin = useRelaunchAsAdministrator();
  const { data: alerts } = useAlerts({ dismissed: false, limit: 5 });
  const { data: metrics } = useSystemMetrics();
  const { data: linuxCapabilities } = useLinuxCapabilities();

  const criticalAlerts = alerts?.filter((a) => a.severity === 'critical').length || 0;
  const highAlerts = alerts?.filter((a) => a.severity === 'high').length || 0;
  const totalActiveAlerts = alerts?.length || 0;
  const attestedAlerts = alerts?.filter((alert) => alert.blockchain_tx_id).length || 0;
  const latestProofAlert = alerts?.find((alert) => alert.blockchain_tx_id);
  const ipcReachable = isAgentReachable(status, ipcConnected);
  const localAgentRunning = Boolean(
    setupStatus?.service_state === 'RUNNING' ||
      setupStatus?.process_running ||
      setupStatus?.service_installed
  );
  const agentReachable = ipcReachable || localAgentRunning;
  const isMac = privilege?.platform === 'macos';
  const isLinuxHost = linuxCapabilities?.platform === 'linux';
  const adminRequired = !isMac && localAgentRunning && !ipcReachable && privilege && !privilege.is_elevated;
  const backendConnected = isBackendConnected(status);
  const backendStatusPending = localAgentRunning && !ipcReachable;
  const systemCpuUsage = Number.isFinite(metrics?.cpu_usage) ? metrics?.cpu_usage ?? 0 : 0;

  // Determine overall protection status
  const getProtectionStatus = () => {
    if (adminRequired) return 'admin_required';
    if (!agentReachable) return 'disconnected';
    if (criticalAlerts > 0) return 'critical';
    if (highAlerts > 0) return 'warning';
    return backendConnected ? 'protected' : 'local';
  };

  const protectionStatus = getProtectionStatus();

  return (
    <div className="sentinel-page space-y-6">
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Protection · Live</div>
          <h1>Tudo sob controle.</h1>
          <p>Telemetria real do agente, backend e coletores em uma visão operacional.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('sentinel-badge', agentReachable ? 'ok' : adminRequired ? 'warn' : 'crit')}>
            {agentReachable ? (ipcReachable ? 'Agent service online' : 'Agent service running') : 'Agent service offline'}
          </span>
          <span className={clsx('sentinel-badge', backendConnected ? 'ok' : 'warn')}>
            {backendConnected
              ? 'Backend connected'
              : backendStatusPending
                ? 'Backend status pending'
                : isEnrollmentPending(status)
                  ? 'Enrollment pending'
                  : 'Backend offline'}
          </span>
          {(criticalAlerts > 0 || highAlerts > 0) && (
            <span className={clsx('sentinel-badge', criticalAlerts > 0 ? 'crit' : 'warn')}>
              {criticalAlerts > 0 ? `${criticalAlerts} critical` : `${highAlerts} high`}
            </span>
          )}
        </div>
      </div>

      {/* Protection Status Hero */}
      <ProtectionStatusHero
        status={protectionStatus}
        agentStatus={getStatusDisplay(status)}
        isLoading={statusLoading && setupLoading}
        criticalCount={criticalAlerts}
        highCount={highAlerts}
        lastHeartbeat={status?.last_heartbeat}
        backendConnected={backendConnected}
        backendStatusPending={backendStatusPending}
        enrollmentPending={isEnrollmentPending(status)}
        adminRequired={Boolean(adminRequired)}
        isMac={isMac}
        onRelaunchAsAdmin={() => relaunchAsAdmin.mutate({ exitCurrent: true })}
      />

      <div className="proof-path-strip">
        <div className="proof-path-copy">
          <div className="sentinel-kicker">Security proof pipeline</div>
          <h2>Endpoint event {'->'} alert {'->'} redacted manifest {'->'} Solana proof</h2>
          <p>Endpoint telemetry stays local. Only privacy-safe hashes and verification metadata leave the protected environment.</p>
        </div>
        <div className="proof-path-steps">
          <ProofPathStep
            label="Agent"
            value={agentReachable ? 'online' : adminRequired ? 'admin required' : 'offline'}
            tone={agentReachable ? 'ok' : adminRequired ? 'warn' : 'crit'}
          />
          <ProofPathStep label="Alerts" value={String(totalActiveAlerts)} tone={criticalAlerts > 0 ? 'crit' : 'ok'} />
          <ProofPathStep label="Redaction" value={attestedAlerts > 0 ? 'verified' : 'not verified'} tone={attestedAlerts > 0 ? 'ok' : 'warn'} />
          <ProofPathStep label="Solana" value={attestedAlerts > 0 ? `${attestedAlerts} verified` : 'pending'} tone={attestedAlerts > 0 ? 'sol' : 'warn'} />
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="sentinel-hero-strip">
        <QuickStatCard
          title="Agent Status"
          value={getStatusDisplay(status)}
          subtitle={agentReachable ? 'Local service reachable' : 'Service not reachable'}
          icon={Shield}
          status={agentReachable ? 'success' : 'error'}
        />
        <QuickStatCard
          title="Alerts"
          value={totalActiveAlerts}
          subtitle={criticalAlerts > 0 ? `${criticalAlerts} critical` : 'All clear'}
          icon={AlertTriangle}
          status={criticalAlerts > 0 ? 'error' : highAlerts > 0 ? 'warning' : 'success'}
        />
        <QuickStatCard
          title="Collectors"
          value={status?.collectors_running?.length || 0}
          subtitle="Active monitors"
          icon={Activity}
          status="info"
        />
        <QuickStatCard
          title="Uptime"
          value={formatUptimeShort(status?.uptime_seconds || 0)}
          subtitle={formatUptimeLong(status?.uptime_seconds || 0)}
          icon={Clock}
          status="neutral"
        />
      </div>

      {/* Component Status Dashboard */}
      <ComponentStatusDashboard />

      {linuxCapabilities && isLinuxHost && (
        <LinuxCapabilitySummary capabilities={linuxCapabilities} />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* System Resources - Takes 2 columns on xl */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU & Memory */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Cpu className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
                  <span style={{ color: 'var(--fg)' }}>System Resources</span>
                </h2>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  {systemCpuUsage.toFixed(1)}% CPU
                </span>
              </div>
              <div className="space-y-5">
                <MetricBar
                  label="CPU Usage"
                  value={systemCpuUsage}
                  max={100}
                  unit="%"
                  thresholds={{ warning: 70, critical: 90 }}
                />
                <MetricBar
                  label="Memory"
                  value={metrics?.memory_used_mb || 0}
                  max={metrics?.memory_total_mb || 1}
                  unit="MB"
                  thresholds={{ warning: 70, critical: 90 }}
                  showPercentage
                />
              </div>
            </div>

            {/* Disk Usage */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <HardDrive className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
                  <span style={{ color: 'var(--fg)' }}>Disk Usage</span>
                </h2>
              </div>
              <div className="space-y-5">
                {metrics?.disk_usage && metrics.disk_usage.length > 0 ? (
                  metrics.disk_usage.slice(0, 3).map((disk) => (
                    <MetricBar
                      key={disk.mount_point}
                      label={disk.mount_point}
                      value={disk.used_gb}
                      max={disk.total_gb}
                      unit="GB"
                      thresholds={{ warning: 75, critical: 90 }}
                      showPercentage
                    />
                  ))
                ) : (
                  <div className="text-center py-6" style={{ color: 'var(--muted)' }}>
                    <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No disk data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Agent Information */}
          {status && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--fg)' }}>
                <Server className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
                <span>Agent Information</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem
                  label="Agent ID"
                  value={status.agent_id || 'N/A'}
                  mono
                />
                <InfoItem
                  label="Version"
                  value={status.version || 'N/A'}
                  highlight
                />
                <InfoItem
                  label="Status"
                  value={getStatusDisplay(status)}
                  status={agentReachable ? 'success' : 'error'}
                />
                <InfoItem
                  label="Backend"
                  value={backendConnected ? 'Connected' : isEnrollmentPending(status) ? 'Enrollment pending' : 'Disconnected'}
                  status={backendConnected ? 'success' : 'error'}
                />
                <InfoItem
                  label="Uptime"
                  value={formatUptime(status.uptime_seconds || 0)}
                />
                <InfoItem
                  label="Last Heartbeat"
                  value={formatRelativeSafe(status.last_heartbeat, 'Never')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Recent Alerts Sidebar */}
        <div className="xl:col-span-1">
          <div className="card p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--fg)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
                <span>Recent Alerts</span>
              </h2>
              {alerts && alerts.length > 0 && (
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full"
                  style={{ background: 'var(--surface-2)', color: 'var(--fg-2)' }}
                >
                  {alerts.length}
                </span>
              )}
            </div>

            {alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {latestProofAlert && (
                  <div className="dashboard-proof-card">
                    <div className="sentinel-kicker">Latest attested alert</div>
                    <strong>{latestProofAlert.title}</strong>
                    <span>Verified on Solana devnet</span>
                    {latestProofAlert.blockchain_tx_id && (
                      <BlockchainBadgeInline txSignature={latestProofAlert.blockchain_tx_id} />
                    )}
                  </div>
                )}
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    severity={alert.severity}
                    title={alert.title}
                    description={alert.description}
                    source={alert.source}
                    timestamp={alert.created_at || (alert as any).timestamp}
                    blockchainTxId={alert.blockchain_tx_id}
                  />
                ))}
                <button
                  className="w-full py-2 text-sm flex items-center justify-center gap-1 transition-colors"
                  style={{ color: 'var(--emerald-400)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--emerald-200)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--emerald-400)')}
                >
                  <span>View all alerts</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'var(--emerald-glow)' }}
                >
                  <ShieldCheck className="w-8 h-8" style={{ color: 'var(--emerald-400)' }} />
                </div>
                <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--fg)' }}>All Clear</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No active alerts at this time</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofPathStep({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'crit' | 'sol';
}) {
  return (
    <div className={`proof-path-step ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LinuxCapabilitySummary({
  capabilities,
}: {
  capabilities: {
    platform: string;
    supported: boolean;
    kernel_release: string | null;
    items: Array<{ id: string; name: string; category: string; status: string; detail: string }>;
  };
}) {
  return (
    <div className="card p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="sentinel-kicker">Linux capability truth</div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
            {capabilities.supported ? 'Host prerequisites detected' : 'Linux resolver unavailable on this platform'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {capabilities.supported
              ? `Platform ${capabilities.platform}${capabilities.kernel_release ? ` · kernel ${capabilities.kernel_release}` : ''}`
              : `Current platform: ${capabilities.platform}`}
          </p>
        </div>
        <span className={clsx('sentinel-badge', capabilities.supported ? 'ok' : 'warn')}>
          {capabilities.supported ? 'Linux host check' : 'Not Linux'}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {capabilities.items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border p-3"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}
            title={item.detail}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium" style={{ color: 'var(--fg)' }}>
                {item.name}
              </span>
              <span className={clsx('sentinel-badge', capabilityTone(item.status))}>
                {capabilityLabel(item.status)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs" style={{ color: 'var(--muted)' }}>
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function capabilityTone(status: string): 'ok' | 'warn' | 'crit' {
  if (status === 'running' || status === 'available_on_host') return 'ok';
  if (status === 'failed' || status === 'unavailable_on_host') return 'crit';
  return 'warn';
}

function capabilityLabel(status: string): string {
  const labels: Record<string, string> = {
    running: 'running',
    available_on_host: 'available',
    unavailable_on_host: 'unavailable',
    unsupported_on_platform: 'unsupported',
  };
  return labels[status] || status.replace(/_/g, ' ');
}

// Protection Status Hero Component
interface ProtectionStatusHeroProps {
  status: 'protected' | 'local' | 'warning' | 'critical' | 'disconnected' | 'admin_required';
  agentStatus: string;
  isLoading: boolean;
  criticalCount: number;
  highCount: number;
  lastHeartbeat?: string | null;
  backendConnected: boolean;
  backendStatusPending: boolean;
  enrollmentPending: boolean;
  adminRequired: boolean;
  isMac: boolean;
  onRelaunchAsAdmin: () => void;
}

function ProtectionStatusHero({
  status,
  agentStatus,
  isLoading,
  criticalCount,
  highCount,
  lastHeartbeat,
  backendConnected,
  backendStatusPending,
  enrollmentPending,
  adminRequired,
  isMac,
  onRelaunchAsAdmin,
}: ProtectionStatusHeroProps) {
  const config = {
    protected: {
      icon: ShieldCheck,
      title: 'System Protected',
      subtitle: 'All security measures are active',
      gradient: 'linear-gradient(90deg, var(--emerald-glow) 0%, transparent 100%)',
      iconBg: 'var(--emerald-glow)',
      iconColor: 'var(--emerald-400)',
      borderColor: 'rgba(47, 196, 113, 0.3)',
      pulse: false,
    },
    local: {
      icon: ShieldAlert,
      title: 'Local Agent Running',
      subtitle: enrollmentPending
        ? 'IPC is online; backend enrollment is pending'
        : backendStatusPending
          ? 'Windows service is running; GUI is waiting for privileged IPC'
        : backendConnected
          ? 'Local agent and backend are reachable'
          : 'IPC is online; backend transport is offline',
      gradient: 'linear-gradient(90deg, var(--high-bg) 0%, transparent 100%)',
      iconBg: 'var(--high-bg)',
      iconColor: 'var(--high)',
      borderColor: 'rgba(245, 165, 36, 0.3)',
      pulse: false,
    },
    warning: {
      icon: ShieldAlert,
      title: 'Attention Required',
      subtitle: `${highCount} high priority alert${highCount !== 1 ? 's' : ''} need review`,
      gradient: 'linear-gradient(90deg, var(--high-bg) 0%, transparent 100%)',
      iconBg: 'var(--high-bg)',
      iconColor: 'var(--high)',
      borderColor: 'rgba(245, 165, 36, 0.3)',
      pulse: true,
    },
    critical: {
      icon: ShieldX,
      title: 'Critical Threats Detected',
      subtitle: `${criticalCount} critical alert${criticalCount !== 1 ? 's' : ''} require immediate action`,
      gradient: 'linear-gradient(90deg, var(--crit-bg) 0%, transparent 100%)',
      iconBg: 'var(--crit-bg)',
      iconColor: 'var(--crit)',
      borderColor: 'rgba(240, 80, 110, 0.3)',
      pulse: true,
    },
    disconnected: {
      icon: ShieldX,
      title: 'Agent Disconnected',
      subtitle: 'Unable to connect to protection service',
      gradient: 'linear-gradient(90deg, var(--surface-2) 0%, transparent 100%)',
      iconBg: 'var(--surface-2)',
      iconColor: 'var(--muted)',
      borderColor: 'var(--border)',
      pulse: false,
    },
    admin_required: {
      icon: ShieldAlert,
      title: isMac ? 'Agent Setup Required' : 'Administrator Required',
      subtitle: isMac
        ? 'Install or start the LaunchDaemon from Agent Setup so macOS can authorize the privileged agent.'
        : 'The agent may be running, but protected IPC requires UAC elevation to read status and control the service.',
      gradient: 'linear-gradient(90deg, var(--high-bg) 0%, transparent 100%)',
      iconBg: 'var(--high-bg)',
      iconColor: 'var(--high)',
      borderColor: 'rgba(245, 165, 36, 0.3)',
      pulse: false,
    },
  };

  const c = config[status];
  const Icon = c.icon;

  if (isLoading) {
    return (
      <div
        className="p-6 rounded-xl animate-pulse"
        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl" style={{ background: 'var(--surface-2)' }} />
          <div className="flex-1">
            <div className="h-6 w-48 rounded mb-2" style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-64 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl p-6"
      style={{
        background: c.gradient,
        border: `1px solid ${c.borderColor}`,
      }}
    >
      <div className="relative z-10 flex items-center gap-4">
        <div
          className="relative p-4 rounded-xl"
          style={{ background: c.iconBg }}
        >
          <Icon className="w-8 h-8" style={{ color: c.iconColor }} />
          {c.pulse && (
            <span
              className="absolute inset-0 rounded-xl animate-ping opacity-20"
              style={{ background: c.iconColor }}
            />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{c.title}</h1>
          <p className="mt-0.5" style={{ color: 'var(--muted)' }}>{c.subtitle}</p>
        </div>
        {adminRequired && !isMac && (
          <button
            type="button"
            className="sentinel-btn sentinel-btn-primary"
            onClick={onRelaunchAsAdmin}
          >
            Restart as Administrator
          </button>
        )}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>Status</p>
            <p className="font-semibold" style={{ color: 'var(--fg-2)' }}>{agentStatus}</p>
          </div>
          {lastHeartbeat && (
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>Last Seen</p>
              <p className="font-semibold" style={{ color: 'var(--fg-2)' }}>
                {formatRelativeSafe(lastHeartbeat, 'Unknown')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick Stat Card Component
interface QuickStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

function QuickStatCard({ title, value, subtitle, icon: Icon, status }: QuickStatCardProps) {
  const statusConfig = {
    success: {
      bg: 'var(--emerald-glow)',
      border: 'rgba(47, 196, 113, 0.2)',
      iconColor: 'var(--emerald-400)',
      valueColor: 'var(--emerald-400)',
    },
    warning: {
      bg: 'var(--high-bg)',
      border: 'rgba(245, 165, 36, 0.2)',
      iconColor: 'var(--high)',
      valueColor: 'var(--high)',
    },
    error: {
      bg: 'var(--crit-bg)',
      border: 'rgba(240, 80, 110, 0.2)',
      iconColor: 'var(--crit)',
      valueColor: 'var(--crit)',
    },
    info: {
      bg: 'var(--med-bg)',
      border: 'rgba(91, 156, 242, 0.2)',
      iconColor: 'var(--med)',
      valueColor: 'var(--med)',
    },
    neutral: {
      bg: 'var(--surface-2)',
      border: 'var(--hairline)',
      iconColor: 'var(--muted)',
      valueColor: 'var(--fg-2)',
    },
  };

  const c = statusConfig[status];

  return (
    <div
      className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-default"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className="text-xs uppercase tracking-wider font-medium truncate"
            style={{ color: 'var(--subtle)' }}
          >
            {title}
          </p>
          <p
            className="text-2xl font-bold mt-1 tabular-nums"
            style={{ color: c.valueColor }}
          >
            {value}
          </p>
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: 'var(--muted)' }}
          >
            {subtitle}
          </p>
        </div>
        <div className="p-2 rounded-lg" style={{ background: c.bg }}>
          <Icon className="w-5 h-5" style={{ color: c.iconColor }} />
        </div>
      </div>
    </div>
  );
}

// Metric Bar Component with thresholds
interface MetricBarProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  thresholds?: { warning: number; critical: number };
  showPercentage?: boolean;
}

function MetricBar({ label, value, max, unit, thresholds, showPercentage }: MetricBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  const getColor = () => {
    if (!thresholds) return 'var(--emerald-500)';
    if (percentage >= thresholds.critical) return 'var(--crit)';
    if (percentage >= thresholds.warning) return 'var(--high)';
    return 'var(--emerald-500)';
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium" style={{ color: 'var(--fg-2)' }}>{label}</span>
        <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
          {value.toFixed(1)} / {max.toFixed(0)} {unit}
          {showPercentage && (
            <span className="ml-1" style={{ color: 'var(--subtle)' }}>({percentage.toFixed(0)}%)</span>
          )}
        </span>
      </div>
      <div
        className="relative w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--surface-2)' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            background: getColor(),
          }}
        />
        {/* Threshold markers */}
        {thresholds && (
          <>
            <div
              className="absolute inset-y-0 w-px"
              style={{ left: `${thresholds.warning}%`, background: 'var(--border)' }}
            />
            <div
              className="absolute inset-y-0 w-px"
              style={{ left: `${thresholds.critical}%`, background: 'var(--border)' }}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Alert Card Component
interface AlertCardProps {
  severity: string;
  title: string;
  description: string;
  source: string;
  timestamp: string | null | undefined;
  blockchainTxId?: string | null;
}

function AlertCard({ severity, title, description, source, timestamp, blockchainTxId }: AlertCardProps) {
  const severityConfig: Record<string, { bg: string; border: string; badgeBg: string; badgeColor: string; colorClass: string }> = {
    critical: {
      bg: 'var(--crit-bg)',
      border: 'rgba(240, 80, 110, 0.3)',
      badgeBg: 'var(--crit)',
      badgeColor: '#fff',
      colorClass: 'severity-critical',
    },
    high: {
      bg: 'var(--high-bg)',
      border: 'rgba(245, 165, 36, 0.3)',
      badgeBg: 'var(--high)',
      badgeColor: '#fff',
      colorClass: 'severity-high',
    },
    medium: {
      bg: 'var(--med-bg)',
      border: 'rgba(91, 156, 242, 0.3)',
      badgeBg: 'var(--med)',
      badgeColor: '#fff',
      colorClass: 'severity-medium',
    },
    low: {
      bg: 'var(--low-bg)',
      border: 'rgba(122, 138, 146, 0.3)',
      badgeBg: 'var(--low)',
      badgeColor: '#fff',
      colorClass: 'severity-low',
    },
    info: {
      bg: 'var(--surface-2)',
      border: 'var(--hairline)',
      badgeBg: 'var(--surface-3)',
      badgeColor: 'var(--fg-2)',
      colorClass: '',
    },
  };

  const config = severityConfig[severity] || severityConfig.info;

  return (
    <div
      className="p-3 rounded-lg cursor-pointer transition-all duration-200"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className={clsx('px-1.5 py-0.5 text-[10px] font-bold uppercase rounded', config.colorClass)}
          style={{
            background: config.badgeBg,
            color: config.badgeColor,
          }}
        >
          {severity}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>{title}</h4>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>{description}</p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: 'var(--subtle)' }}>
            <span>{source}</span>
            <span>-</span>
            <span>{formatRelativeSafe(timestamp, 'Unknown')}</span>
            {blockchainTxId && (
              <>
                <span>-</span>
                <BlockchainBadgeInline txSignature={blockchainTxId} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Info Item Component
function InfoItem({
  label,
  value,
  mono,
  highlight,
  status,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  status?: 'success' | 'error';
}) {
  const getValueColor = () => {
    if (status === 'success') return 'var(--emerald-400)';
    if (status === 'error') return 'var(--crit)';
    if (highlight) return 'var(--emerald-400)';
    return 'var(--fg-2)';
  };

  return (
    <div className="py-2">
      <dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>{label}</dt>
      <dd
        className={clsx('font-medium mt-0.5 truncate', mono && 'font-mono text-sm')}
        style={{ color: getValueColor() }}
      >
        {value}
      </dd>
    </div>
  );
}

// Helper functions
function getStatusDisplay(status: any): string {
  if (!status) return 'Unknown';
  return status.state || status.status || 'Unknown';
}

function isBackendConnected(status: any): boolean {
  if (!status) return false;
  return Boolean(status.backend_connected ?? status.connected);
}

function isAgentReachable(status: any, ipcConnected?: boolean): boolean {
  return Boolean(ipcConnected || status?.version || status?.state);
}

function isEnrollmentPending(status: any): boolean {
  return !isBackendConnected(status) && String(status?.agent_id ?? '').startsWith('pending-');
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatUptimeShort(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${minutes}m`;
  }
}

function formatUptimeLong(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} min`);

  return parts.join(', ') || '< 1 min';
}
