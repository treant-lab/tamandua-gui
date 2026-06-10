import { useState } from 'react';
import {
  useAlerts,
  useAlertCount,
  useDismissAlert,
  useQuarantineFile,
  useKillProcess,
  useExportAlerts,
  type AlertFilter,
  type Alert,
} from '../hooks/useTauri';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileX,
  Fingerprint,
  Lock,
  Network,
  Shield,
  TerminalSquare,
  X,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { BlockchainBadge, BlockchainBadgeInline } from '../components/blockchain';
import { format } from 'date-fns';

// Safe date formatting helper
function formatDateSafe(dateValue: string | null | undefined, formatStr: string, fallback: string = 'N/A'): string {
  if (!dateValue) return fallback;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}
import clsx from 'clsx';
import { open } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import { Link } from 'react-router-dom';

export function Alerts() {
  const [filter, setFilter] = useState<AlertFilter>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const queryFilter = { ...filter, limit: pageSize + 1, offset: page * pageSize };
  const { data: alerts, isLoading } = useAlerts(queryFilter);
  const { data: alertCount = 0 } = useAlertCount(filter);
  const { data: openAlertCount = 0 } = useAlertCount({ ...filter, dismissed: false });
  const { data: criticalAlertCount = 0 } = useAlertCount({ ...filter, severity: 'critical' });
  const dismissAlert = useDismissAlert();
  const quarantineFile = useQuarantineFile();
  const killProcess = useKillProcess();
  const exportAlerts = useExportAlerts();
  const { requireAuth } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const visibleAlerts = alerts?.slice(0, pageSize) ?? [];
  const hasNextPage = (page + 1) * pageSize < alertCount || (alerts?.length ?? 0) > pageSize;
  const selectedAlertData = alerts?.find(a => a.id === selectedAlert);

  const updateFilter = (next: AlertFilter) => {
    setFilter(next);
    setPage(0);
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlert.mutateAsync(alertId);
      toast.success('Alert dismissed');
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
      toast.error('Failed to dismiss alert', String(error));
    }
  };

  const handleQuarantine = async (path: string) => {
    // Require authentication for critical action
    const authed = await requireAuth();
    if (!authed) return;

    const confirmed = await confirm({
      title: 'Quarantine File',
      message: `Are you sure you want to quarantine this file?\n\n${path}`,
      confirmText: 'Quarantine',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      await quarantineFile.mutateAsync(path);
      toast.success('File quarantined', path);
    } catch (error) {
      console.error('Failed to quarantine file:', error);
      toast.error('Failed to quarantine file', String(error));
    }
  };

  const handleKillProcess = async (pid: number) => {
    // Require authentication for critical action
    const authed = await requireAuth();
    if (!authed) return;

    const confirmed = await confirm({
      title: 'Kill Process',
      message: `Are you sure you want to terminate process with PID ${pid}? This action cannot be undone.`,
      confirmText: 'Kill Process',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await killProcess.mutateAsync(pid);
      toast.success('Process terminated', `PID ${pid}`);
    } catch (error) {
      console.error('Failed to kill process:', error);
      toast.error('Failed to kill process', String(error));
    }
  };

  const handleExport = async () => {
    try {
      const savePath = await open({
        defaultPath: `tamandua-alerts-${Date.now()}.json`,
        filters: [
          { name: 'JSON', extensions: ['json'] },
          { name: 'CSV', extensions: ['csv'] },
        ],
      }) as string;

      if (!savePath) return;

      const format = savePath.endsWith('.csv') ? 'csv' : 'json';
      const data = await exportAlerts.mutateAsync({ format, filter });
      await writeTextFile(savePath, data);

      toast.success('Alerts exported', savePath);
    } catch (error) {
      console.error('Failed to export alerts:', error);
      toast.error('Failed to export alerts', String(error));
    }
  };

  return (
    <div className="sentinel-page space-y-6">
      {/* Header */}
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Detections · Response</div>
          <h1>Alerts</h1>
          <p>Prioritize detections, inspect private context, and verify public proof.</p>
        </div>
        <button
          onClick={handleExport}
          className="sentinel-btn sentinel-btn-primary"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Filters */}
      <div
        className="rounded-lg p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              Severity
            </label>
            <select
              className="w-full rounded-lg px-3 py-2 transition-colors"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              value={filter.severity || ''}
              onChange={(e) =>
                updateFilter({
                  ...filter,
                  severity: e.target.value || undefined,
                })
              }
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>Source</label>
            <select
              className="w-full rounded-lg px-3 py-2 transition-colors"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              value={filter.source || ''}
              onChange={(e) =>
                updateFilter({ ...filter, source: e.target.value || undefined })
              }
            >
              <option value="">All</option>
              <option value="yara">YARA</option>
              <option value="sigma">Sigma</option>
              <option value="ml">ML</option>
              <option value="behavioral">Behavioral</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>Status</label>
            <select
              className="w-full rounded-lg px-3 py-2 transition-colors"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              value={filter.dismissed === undefined ? '' : filter.dismissed ? 'dismissed' : 'active'}
              onChange={(e) =>
                updateFilter({
                  ...filter,
                  dismissed: e.target.value === '' ? undefined : e.target.value === 'dismissed',
                })
              }
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>Limit</label>
            <select
              className="w-full rounded-lg px-3 py-2 transition-colors"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(0);
              }}
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <TriageMetric label="Total" value={alertCount} tone="neutral" />
        <TriageMetric label="Open" value={openAlertCount} tone="ok" />
        <TriageMetric label="Critical" value={criticalAlertCount} tone="crit" />
        <TriageMetric label="This page" value={visibleAlerts.length} tone="sol" />
      </div>

      {/* Main Content - Split View */}
      <div className="alerts-triage-grid">
        {/* Alerts List */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-center py-12">
              <div
                className="animate-spin rounded-full h-12 w-12 mx-auto"
                style={{ borderWidth: '2px', borderColor: 'var(--border)', borderTopColor: 'var(--emerald-500)' }}
              />
              <p style={{ color: 'var(--muted)' }} className="mt-4">Loading alerts...</p>
            </div>
          ) : visibleAlerts.length > 0 ? (
            <div className="space-y-2">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert.id)}
                  className={clsx(
                    'rounded-lg p-4 cursor-pointer transition-all duration-200',
                    selectedAlert === alert.id && 'ring-2'
                  )}
                  style={{
                    background: selectedAlert === alert.id ? 'var(--surface-2)' : 'var(--surface)',
                    border: '1px solid var(--hairline)',
                    borderLeftWidth: '4px',
                    borderLeftColor: getSeverityBorderColor(alert.severity),
                    ...(selectedAlert === alert.id && { ringColor: 'var(--emerald-500)' }),
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <SeverityBadge severity={alert.severity} />
                        <SourceBadge source={alert.source} />
                        {alert.dismissed && (
                          <span
                            className="px-2 py-0.5 text-xs font-medium rounded"
                            style={{
                              background: 'var(--surface-3)',
                              color: 'var(--subtle)',
                            }}
                          >
                            DISMISSED
                          </span>
                        )}
                        {/* Blockchain Attestation Badge */}
                        {alert.blockchain_tx_id && (
                          <BlockchainBadge
                            txSignature={alert.blockchain_tx_id}
                            attestedAt={alert.blockchain_attested_at}
                            bountyAmount={alert.bounty_amount_sol}
                            bountyTxSignature={alert.bounty_tx_id}
                            size="sm"
                            variant="badge"
                          />
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className="font-semibold truncate"
                        style={{ color: 'var(--fg)' }}
                      >
                        {alert.title}
                      </h3>

                      {/* Time and process info */}
                      <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                        <span>{formatDateSafe(alert.created_at, 'MMM d, HH:mm')}</span>
                        {alert.process_name && (
                          <span className="truncate">{alert.process_name}</span>
                        )}
                      </div>

                      {/* MITRE ATT&CK tags */}
                      {alert.mitre_tactics.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {alert.mitre_tactics.slice(0, 3).map((tactic) => (
                            <MitreTag key={tactic} tactic={tactic} />
                          ))}
                          {alert.mitre_tactics.length > 3 && (
                            <span
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{ color: 'var(--subtle)' }}
                            >
                              +{alert.mitre_tactics.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight
                      className="w-5 h-5 flex-shrink-0 mt-1"
                      style={{ color: selectedAlert === alert.id ? 'var(--emerald-400)' : 'var(--dim)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-lg text-center py-12"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
              }}
            >
              <AlertTriangle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--dim)' }} />
              <p style={{ color: 'var(--muted)' }}>No alerts found</p>
            </div>
          )}
          <div
            className="mt-4 flex items-center justify-between gap-3 rounded-lg px-4 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
          >
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              {visibleAlerts.length === 0
                ? 'No alerts'
                : `${(page * pageSize + 1).toLocaleString()}-${(page * pageSize + visibleAlerts.length).toLocaleString()} of ${alertCount.toLocaleString()}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="sentinel-btn"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                Page {page + 1}
              </span>
              <button
                className="sentinel-btn"
                disabled={!hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Alert Detail Panel */}
        {selectedAlertData ? (
          <AlertDetailPanel
            alert={selectedAlertData}
            onDismiss={handleDismiss}
            onQuarantine={handleQuarantine}
            onKillProcess={handleKillProcess}
            isPending={{
              dismiss: dismissAlert.isPending,
              quarantine: quarantineFile.isPending,
              kill: killProcess.isPending,
            }}
          />
        ) : (
          <div className="incident-panel empty">
            <Shield className="w-10 h-10" />
            <h2>Select an alert</h2>
            <p>Use the left column to inspect incident context, proof status, and response options.</p>
          </div>
        )}
      </div>

    </div>
  );
}

function TriageMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'crit' | 'sol' | 'ok';
}) {
  return (
    <div className={`triage-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// Severity Badge Component
function SeverityBadge({ severity }: { severity: string }) {
  const config = {
    critical: {
      bg: 'var(--crit-bg)',
      color: 'var(--crit)',
      border: 'rgba(240, 80, 110, 0.3)',
    },
    high: {
      bg: 'var(--high-bg)',
      color: 'var(--high)',
      border: 'rgba(245, 165, 36, 0.3)',
    },
    medium: {
      bg: 'var(--med-bg)',
      color: 'var(--med)',
      border: 'rgba(91, 156, 242, 0.3)',
    },
    low: {
      bg: 'var(--low-bg)',
      color: 'var(--low)',
      border: 'rgba(122, 138, 146, 0.3)',
    },
    info: {
      bg: 'var(--surface-3)',
      color: 'var(--muted)',
      border: 'var(--border)',
    },
  };

  const styles = config[severity as keyof typeof config] || config.info;

  return (
    <span
      className="px-2 py-0.5 text-xs font-semibold rounded uppercase"
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
    >
      {severity}
    </span>
  );
}

// Source Badge Component
function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="px-2 py-0.5 text-xs font-medium rounded"
      style={{
        background: 'var(--surface-3)',
        color: 'var(--fg-2)',
        border: '1px solid var(--border)',
      }}
    >
      {source}
    </span>
  );
}

// MITRE ATT&CK Tag Component
function MitreTag({ tactic }: { tactic: string }) {
  return (
    <span
      className="px-1.5 py-0.5 text-xs font-mono rounded"
      style={{
        background: 'var(--crit-bg)',
        color: 'var(--crit)',
        border: '1px solid rgba(240, 80, 110, 0.2)',
      }}
    >
      {tactic}
    </span>
  );
}

// Alert Detail Panel Component
interface AlertDetailPanelProps {
  alert: Alert;
  onDismiss: (id: string) => void;
  onQuarantine: (path: string) => void;
  onKillProcess: (pid: number) => void;
  isPending: {
    dismiss: boolean;
    quarantine: boolean;
    kill: boolean;
  };
}

function AlertDetailPanel({
  alert,
  onDismiss,
  onQuarantine,
  onKillProcess,
  isPending,
}: AlertDetailPanelProps) {
  const txId = alert.proof?.tx_id || alert.blockchain_tx_id;
  const manifestHash = getMetadataValue(alert, ['manifest_hash', 'manifestHash']);
  const incidentHash = getMetadataValue(alert, ['incident_hash', 'incidentHash']);
  const confidence = getMetadataValue(alert, ['confidence', 'score']);
  const redactedCount = getMetadataValue(alert, ['redacted_ioc_count', 'attestation_redacted_ioc_count']);
  const iocTypes = getArrayMetadata(alert, ['ioc_types', 'iocTypes']).slice(0, 4);
  const solscanUrl = alert.proof?.solscan_url || (txId ? `https://solscan.io/tx/${txId}?cluster=devnet` : null);

  return (
    <div className="incident-panel">
      {/* Header */}
      <div
        className="incident-panel-head"
        style={{
          background: getSeverityHeaderBg(alert.severity),
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'rgba(0, 0, 0, 0.2)' }}
          >
            <Shield className="w-5 h-5" style={{ color: getSeverityColor(alert.severity) }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={alert.severity} />
              <SourceBadge source={alert.source} />
            </div>
            <h2 className="font-semibold" style={{ color: 'var(--fg)' }}>
              {alert.title}
            </h2>
            <div className="incident-subline">
              <span>INC-{alert.id.slice(0, 8)}</span>
              <span>{formatDateSafe(alert.created_at, 'MMM d, HH:mm:ss')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="incident-panel-body">
        <div className="proof-card">
          <div className="proof-card-top">
            <div>
              <div className="sentinel-kicker">Public proof</div>
              <h3>{txId ? 'Verified on Solana' : 'Awaiting attestation'}</h3>
            </div>
            {txId ? (
              <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--sol-cyan)' }} />
            ) : (
              <Clock className="w-6 h-6" style={{ color: 'var(--muted)' }} />
            )}
          </div>
          <div className="proof-hash-grid">
            <ProofField label="Incident" value={incidentHash} />
            <ProofField label="Manifest" value={manifestHash} />
            <ProofField label="Confidence" value={confidence} />
            <ProofField label="Anchored" value={txId ? 'devnet' : 'pending'} />
          </div>
          {txId ? (
            <a href={solscanUrl!} target="_blank" rel="noopener noreferrer" className="proof-link">
              <span>{truncateMiddle(txId, 8, 8)}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div className="proof-link muted">
              <span>Proof will appear after backend attestation</span>
            </div>
          )}
        </div>
        {/* Description */}
        <div>
          <h4
            className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--subtle)' }}
          >
            Description
          </h4>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
            {alert.description}
          </p>
        </div>

        <div className="incident-timeline">
          <TimelineStep icon={Eye} label="Detected" value={formatDateSafe(alert.created_at, 'HH:mm:ss')} tone="crit" />
          <TimelineStep icon={Lock} label="Redaction" value={redactedCount ? `${redactedCount} IOCs` : 'pending'} tone={redactedCount ? 'ok' : 'neutral'} />
          <TimelineStep icon={Fingerprint} label="Manifest" value={manifestHash ? truncateMiddle(manifestHash, 6, 6) : 'pending'} tone={manifestHash ? 'sol' : 'neutral'} />
          <TimelineStep icon={txId ? CheckCircle2 : Clock} label="Solana" value={txId ? 'verified' : 'pending'} tone={txId ? 'sol' : 'neutral'} />
        </div>

        {/* Metadata Grid */}
        <div
          className="rounded-lg p-3 space-y-3"
          style={{ background: 'var(--surface-2)' }}
        >
          <MetadataRow label="Time" value={formatDateSafe(alert.created_at, 'PPpp')} />
          {alert.process_name && (
            <MetadataRow
              label="Process"
              value={`${alert.process_name} (PID: ${alert.process_id})`}
              mono
            />
          )}
          {alert.file_path && (
            <MetadataRow label="File Path" value={alert.file_path} mono truncate />
          )}
        </div>

        {(iocTypes.length > 0 || alert.file_path || alert.process_name) && (
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: 'var(--subtle)' }}
            >
              Evidence summary
            </h4>
            <div className="evidence-grid">
              {alert.process_name && <EvidenceChip icon={TerminalSquare} label="Process" value={alert.process_name} />}
              {alert.file_path && <EvidenceChip icon={FileX} label="File path" value={alert.file_path} />}
              {iocTypes.map((ioc) => <EvidenceChip key={ioc} icon={Network} label="IOC type" value={ioc} />)}
            </div>
          </div>
        )}

        {/* MITRE ATT&CK Section */}
        {alert.mitre_tactics.length > 0 && (
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: 'var(--subtle)' }}
            >
              MITRE ATT&CK
            </h4>
            <div className="flex flex-wrap gap-1">
              {alert.mitre_tactics.map((tactic) => (
                <MitreTag key={tactic} tactic={tactic} />
              ))}
            </div>
          </div>
        )}

        {/* Blockchain Attestation */}
        {alert.blockchain_tx_id && (
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: 'var(--subtle)' }}
            >
              Blockchain Attestation
            </h4>
            <BlockchainBadge
              txSignature={alert.blockchain_tx_id}
              attestedAt={alert.blockchain_attested_at}
              bountyAmount={alert.bounty_amount_sol}
              bountyTxSignature={alert.bounty_tx_id}
              size="md"
              variant="card"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="p-4 space-y-2"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        {!alert.dismissed && (
          <ActionButton
            onClick={() => onDismiss(alert.id)}
            disabled={isPending.dismiss}
            icon={<X className="w-4 h-4" />}
            label="Dismiss Alert"
            variant="secondary"
          />
        )}
        {alert.file_path && (
          <ActionButton
            onClick={() => onQuarantine(alert.file_path!)}
            disabled={isPending.quarantine}
            icon={<FileX className="w-4 h-4" />}
            label="Quarantine File"
            variant="warning"
          />
        )}
        {alert.process_id && (
          <ActionButton
            onClick={() => onKillProcess(alert.process_id!)}
            disabled={isPending.kill}
            icon={<XCircle className="w-4 h-4" />}
            label="Kill Process"
            variant="danger"
          />
        )}
        {alert.blockchain_tx_id && (
          <ActionButton
            onClick={() => window.open(`https://solscan.io/tx/${alert.blockchain_tx_id}?cluster=devnet`, '_blank')}
            icon={<ExternalLink className="w-4 h-4" />}
            label="Open Solscan Proof"
            variant="info"
          />
        )}
        <Link to={`/incidents/${alert.id}`} className="incident-open-link">
          <Eye className="w-4 h-4" />
          Open full incident
        </Link>
      </div>
    </div>
  );
}

function ProofField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <code className={!value ? 'missing-value' : undefined}>{value ? truncateMiddle(value, 7, 5) : 'Not provided'}</code>
    </div>
  );
}

function TimelineStep({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'crit' | 'ok' | 'sol' | 'neutral';
}) {
  return (
    <div className={`timeline-step ${tone}`}>
      <Icon className="w-4 h-4" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function EvidenceChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="evidence-chip">
      <Icon className="w-4 h-4" />
      <div>
        <span>{label}</span>
        <strong title={value}>{value}</strong>
      </div>
    </div>
  );
}

// Metadata Row Component
function MetadataRow({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>
        {label}
      </span>
      <span
        className={clsx('text-sm', mono && 'font-mono', truncate && 'truncate')}
        style={{ color: 'var(--fg)' }}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

// Action Button Component
function ActionButton({
  onClick,
  disabled = false,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  variant: 'secondary' | 'warning' | 'danger' | 'info';
}) {
  const variants = {
    secondary: {
      bg: 'var(--surface-2)',
      hoverBg: 'var(--surface-3)',
      color: 'var(--fg-2)',
      border: 'var(--border)',
    },
    warning: {
      bg: 'var(--high-bg)',
      hoverBg: 'rgba(245, 165, 36, 0.2)',
      color: 'var(--high)',
      border: 'rgba(245, 165, 36, 0.3)',
    },
    danger: {
      bg: 'var(--crit-bg)',
      hoverBg: 'rgba(240, 80, 110, 0.2)',
      color: 'var(--crit)',
      border: 'rgba(240, 80, 110, 0.3)',
    },
    info: {
      bg: 'var(--med-bg)',
      hoverBg: 'rgba(91, 156, 242, 0.2)',
      color: 'var(--med)',
      border: 'rgba(91, 156, 242, 0.3)',
    },
  };

  const styles = variants[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = styles.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = styles.bg;
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function getSeverityBorderColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'var(--crit)',
    high: 'var(--high)',
    medium: 'var(--med)',
    low: 'var(--low)',
    info: 'var(--dim)',
  };
  return colors[severity] || colors.info;
}

function getSeverityColor(severity: string): string {
  return getSeverityBorderColor(severity);
}

function getSeverityHeaderBg(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'var(--crit-bg)',
    high: 'var(--high-bg)',
    medium: 'var(--med-bg)',
    low: 'var(--low-bg)',
    info: 'var(--surface-2)',
  };
  return colors[severity] || colors.info;
}

function getMetadataValue(alert: Alert, keys: string[]): string | null {
  for (const key of keys) {
    const directValue = (alert as unknown as Record<string, unknown>)[key];
    if (directValue !== undefined && directValue !== null && String(directValue).trim() !== '') {
      return String(directValue);
    }

    const proofValue = alert.proof?.[key as keyof NonNullable<Alert['proof']>];
    if (proofValue !== undefined && proofValue !== null && String(proofValue).trim() !== '') {
      return String(proofValue);
    }

    const value = alert.metadata?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return null;
}

function getArrayMetadata(alert: Alert, keys: string[]): string[] {
  for (const key of keys) {
    const directValue = (alert as unknown as Record<string, unknown>)[key];
    if (Array.isArray(directValue)) return directValue.map(String);

    const proofValue = alert.proof?.[key as keyof NonNullable<Alert['proof']>];
    if (Array.isArray(proofValue)) return proofValue.map(String);

    const value = alert.metadata?.[key];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function truncateMiddle(value: string, start = 8, end = 6): string {
  if (!value || value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}
