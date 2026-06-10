import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode2,
  FileX,
  Fingerprint,
  GitBranch,
  Lock,
  Network,
  Shield,
  TerminalSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { BlockchainBadge } from '../components/blockchain';
import { useAlerts, useIncident, type Alert } from '../hooks/useTauri';

function formatDateSafe(dateValue: string | null | undefined, formatStr: string, fallback = 'N/A'): string {
  if (!dateValue) return fallback;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}

export function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: incident, isLoading: isIncidentLoading } = useIncident(id);
  const { data: alerts, isLoading: isAlertsLoading } = useAlerts({ limit: 500 });
  const baseAlert = incident?.alert ?? alerts?.find((item) => item.id === id);

  if ((isIncidentLoading || isAlertsLoading) && !baseAlert) {
    return (
      <div className="sentinel-page">
        <div className="incident-detail-loading">
          <div className="animate-spin rounded-full h-12 w-12" />
          <span>Loading incident...</span>
        </div>
      </div>
    );
  }

  if (!baseAlert) {
    return (
      <div className="sentinel-page">
        <div className="incident-not-found">
          <AlertTriangle className="w-12 h-12" />
          <h1>Incident not found</h1>
          <p>The incident may have been dismissed, filtered out, or not synced from the agent yet.</p>
          <button className="sentinel-btn sentinel-btn-primary" onClick={() => navigate('/alerts')}>
            <ArrowLeft className="w-4 h-4" />
            Back to alerts
          </button>
        </div>
      </div>
    );
  }

  const alert: Alert = incident?.proof && !baseAlert.proof
    ? { ...baseAlert, proof: incident.proof as Alert['proof'] }
    : baseAlert;
  const txId = alert.proof?.tx_id || alert.blockchain_tx_id;
  const solscanUrl = alert.proof?.solscan_url || (txId ? `https://solscan.io/tx/${txId}?cluster=devnet` : null);
  const manifestHash = getMetadataValue(alert, ['manifest_hash', 'manifestHash']);
  const incidentHash = getMetadataValue(alert, ['incident_hash', 'incidentHash']);
  const redactedCount = getMetadataValue(alert, ['redacted_ioc_count', 'attestation_redacted_ioc_count']);
  const confidence = getMetadataValue(alert, ['confidence', 'score']);
  const iocTypes = getArrayMetadata(alert, ['ioc_types', 'iocTypes']);
  const affectedHost = getMetadataValue(alert, ['hostname', 'host']) || alert.agent_id;
  const commandLine = getMetadataValue(alert, ['command_line', 'commandLine']);
  const parentProcess = getMetadataValue(alert, ['parent_process', 'parentProcess']);
  const hasManifest = Boolean(manifestHash);
  const hasIncidentHash = Boolean(incidentHash);
  const hasRedaction = Boolean(redactedCount) || hasManifest;
  const action = txId ? 'Attestation verified' : 'Not attested';
  const timelineCount = incident?.timeline?.length ?? 0;

  return (
    <div className="sentinel-page incident-detail-page">
      <div className="incident-detail-hero">
        <div className="incident-detail-nav">
          <Link to="/alerts" className="sentinel-btn">
            <ArrowLeft className="w-4 h-4" />
            Alerts
          </Link>
          <span className={clsx('incident-severity-pill', alert.severity)}>{alert.severity}</span>
        </div>

        <div className="incident-detail-title">
          <div>
            <div className="sentinel-kicker">Incident · INC-{alert.id.slice(0, 8)}</div>
            <h1>{alert.title}</h1>
            <p>{alert.description}</p>
          </div>
          <div className="incident-proof-status">
            {txId ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
            <span>{action}</span>
          </div>
        </div>
      </div>

      <div className="incident-detail-grid">
        <section className="incident-detail-main">
          <div className="incident-section">
            <div className="incident-section-head">
              <h2>Attack Summary</h2>
              <span>{formatDateSafe(alert.created_at, 'PPpp')}</span>
            </div>
            <div className="incident-summary-grid">
              <IncidentFact icon={Shield} label="Endpoint" value={affectedHost} />
              <IncidentFact icon={TerminalSquare} label="Process" value={alert.process_name} />
              <IncidentFact icon={FileX} label="File" value={alert.file_path} />
              <IncidentFact icon={Network} label="Source" value={alert.source} />
            </div>
          </div>

          <div className="incident-section">
            <div className="incident-section-head">
              <h2>Process Lineage</h2>
              <span>{timelineCount > 0 ? `${timelineCount} server events` : 'local context'}</span>
            </div>
            <div className="process-lineage">
              <LineageNode label="Parent" value={parentProcess} muted />
              <div className="lineage-connector" />
              <LineageNode label="Detected" value={alert.process_name} emphasis />
              <div className="lineage-connector" />
              <LineageNode label="Decision" value={getMetadataValue(alert, ['decision', 'response_action', 'responseAction'])} />
            </div>
            <div className="command-line-card">
              <span>Command line</span>
              <code className={!commandLine ? 'missing-value' : undefined}>{commandLine || 'Not provided by alert payload'}</code>
            </div>
          </div>

          <div className="incident-section">
            <div className="incident-section-head">
              <h2>Evidence</h2>
              <span>{[incidentHash, manifestHash, redactedCount, ...iocTypes].filter(Boolean).length} indicators</span>
            </div>
            <div className="incident-evidence-list">
              <EvidenceRow icon={FileCode2} label="Incident hash" value={incidentHash} />
              <EvidenceRow icon={Fingerprint} label="Manifest hash" value={manifestHash} />
              <EvidenceRow icon={Lock} label="Redacted IOCs" value={redactedCount} />
              {iocTypes.map((ioc) => (
                <EvidenceRow key={ioc} icon={Network} label="IOC type" value={ioc} />
              ))}
            </div>
          </div>
        </section>

        <aside className="incident-detail-side">
          <div className="verify-proof-card">
            <div className="verify-proof-head">
              <div>
                <div className="sentinel-kicker">Verify Proof</div>
                <h2>{txId ? 'Public proof is anchored' : 'No public proof yet'}</h2>
              </div>
              {txId ? <CheckCircle2 className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
            </div>
            <div className="verify-proof-flow">
              <ProofStep icon={Shield} label="Agent event" done />
              <ProofStep icon={Lock} label="Redacted manifest" done={hasRedaction} />
              <ProofStep icon={GitBranch} label="Hash linked" done={hasManifest && hasIncidentHash} />
              <ProofStep icon={Fingerprint} label="Solana attestation" done={Boolean(txId)} />
            </div>
            <div className="proof-values">
              <ProofValue label="Incident" value={incidentHash} />
              <ProofValue label="Manifest" value={manifestHash} />
              <ProofValue label="Confidence" value={confidence} />
              <ProofValue label="Network" value={txId ? 'Solana devnet' : null} />
            </div>
            {txId ? (
              <a className="sentinel-btn sentinel-btn-primary verify-proof-action" href={solscanUrl!} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open Solscan
              </a>
            ) : (
              <button className="sentinel-btn sentinel-btn-primary verify-proof-action" disabled>
                <Clock className="w-4 h-4" />
                Awaiting attestation
              </button>
            )}
          </div>

          <BlockchainBadge
            txSignature={alert.blockchain_tx_id}
            attestedAt={alert.blockchain_attested_at}
            bountyAmount={alert.bounty_amount_sol}
            bountyTxSignature={alert.bounty_tx_id}
            size="md"
            variant="card"
          />

          <div className="incident-side-note">
            <h3>Privacy boundary</h3>
            <p>Raw endpoint telemetry remains local. The public layer exposes hashes, timing, and verification metadata only.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function IncidentFact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="incident-fact">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      <strong className={!value ? 'missing-value' : undefined} title={value || undefined}>
        {value || 'Not provided'}
      </strong>
    </div>
  );
}

function LineageNode({ label, value, muted, emphasis }: { label: string; value?: string | null; muted?: boolean; emphasis?: boolean }) {
  return (
    <div className={clsx('lineage-node', muted && 'muted', emphasis && 'emphasis')}>
      <span>{label}</span>
      <strong className={!value ? 'missing-value' : undefined} title={value || undefined}>
        {value || 'Not provided'}
      </strong>
    </div>
  );
}

function EvidenceRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="evidence-row">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      <code className={!value ? 'missing-value' : undefined}>{value || 'Not provided'}</code>
    </div>
  );
}

function ProofStep({
  icon: Icon,
  label,
  done,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  done: boolean;
}) {
  return (
    <div className={clsx('proof-step', done && 'done')}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );
}

function ProofValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <code className={!value ? 'missing-value' : undefined}>{value ? truncateMiddle(value, 9, 7) : 'Not provided'}</code>
    </div>
  );
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
