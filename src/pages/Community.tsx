import {
  Award,
  CheckCircle2,
  Clock,
  FileCheck2,
  GitPullRequest,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';
import { useAlerts, type Alert } from '../hooks/useTauri';

const REVIEW_LIMIT = 100;

export function Community() {
  const { data: alerts = [], isLoading, isError } = useAlerts({ limit: REVIEW_LIMIT });
  const attestedAlerts = alerts.filter(hasPublicProof);
  const bountyAlerts = alerts.filter(hasBounty);
  const openAlerts = alerts.filter((alert) => !alert.dismissed);
  const validationCandidates = alerts.filter((alert) => !alert.dismissed && isValidationCandidate(alert));
  const highSignalCount = alerts.filter((alert) => alert.severity === 'critical' || alert.severity === 'high').length;

  const metrics = [
    {
      label: 'Validation queue',
      value: validationCandidates.length,
      tone: 'ok' as const,
      helper: 'Open high-signal alerts that could support community review.',
    },
    {
      label: 'App Guard programs',
      value: 0,
      tone: 'neutral' as const,
      helper: 'No program registry is wired into this GUI yet.',
    },
    {
      label: 'Bounty submissions',
      value: bountyAlerts.length,
      tone: 'sol' as const,
      helper: 'Observed from alert bounty proof fields only.',
    },
    {
      label: 'Public proofs',
      value: attestedAlerts.length,
      tone: 'sol' as const,
      helper: 'Alerts with chain transaction or proof attestation metadata.',
    },
  ];

  return (
    <div className="sentinel-page space-y-6">
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Community · Foundation</div>
          <h1>Community & Bounty</h1>
          <p>Read-only view of validation readiness, App Guard program foundations, and bounty proof signals.</p>
        </div>
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', color: 'var(--muted)' }}
        >
          {isLoading ? 'Loading alert signals...' : `${alerts.length} alert signals reviewed`}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <FoundationMetric key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <FoundationCard
          icon={Users}
          title="Community validation"
          status="Read-only foundation"
          description="Surfaces candidate alert signals that could be reviewed by trusted community validators once submission workflows exist."
          rows={[
            ['Open alerts', String(openAlerts.length)],
            ['High-signal alerts', String(highSignalCount)],
            ['Candidates', String(validationCandidates.length)],
          ]}
        />
        <FoundationCard
          icon={ShieldCheck}
          title="App Guard programs"
          status="Registry not connected"
          description="Reserved for program scope, policy metadata, eligibility rules, and maintainer review state. No backend registry is invoked here."
          rows={[
            ['Programs', '0'],
            ['Active scopes', '0'],
            ['Enrollment', 'Not wired'],
          ]}
        />
        <FoundationCard
          icon={Award}
          title="Bounty submissions"
          status="Proof-derived only"
          description="Counts only alerts that already expose bounty transaction or amount fields. This page does not submit, approve, or pay bounties."
          rows={[
            ['Observed submissions', String(bountyAlerts.length)],
            ['Attested alerts', String(attestedAlerts.length)],
            ['Source', 'Existing alerts'],
          ]}
        />
      </div>

      <div
        className="rounded-lg p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="sentinel-kicker">Review Signals</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
              Recent alert-backed candidates
            </h2>
          </div>
          <ReadOnlyBadge />
        </div>

        {isError ? (
          <EmptyState
            icon={Clock}
            title="Alert feed unavailable"
            message="Community foundations remain visible, but no alert-derived signals could be loaded."
          />
        ) : isLoading ? (
          <EmptyState icon={Clock} title="Loading signals" message="Reading existing alert data from the local GUI API." />
        ) : validationCandidates.length === 0 ? (
          <EmptyState
            icon={FileCheck2}
            title="No validation candidates"
            message="There are no open high-signal alerts with the current local data. This is an honest empty state, not a submission backlog."
          />
        ) : (
          <div className="space-y-3">
            {validationCandidates.slice(0, 8).map((alert) => (
              <CandidateRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReadOnlyPanel
          icon={GitPullRequest}
          title="What is intentionally absent"
          items={[
            'No submission form until a backend contract exists.',
            'No payout controls or wallet actions in the GUI.',
            'No App Guard registry mutation from this page.',
          ]}
        />
        <ReadOnlyPanel
          icon={CheckCircle2}
          title="Current source of truth"
          items={[
            'Alert severity, dismissal, proof, and bounty fields from useAlerts.',
            'Zero values where no connected data source exists.',
            'Foundation status labels instead of implied production readiness.',
          ]}
        />
      </div>
    </div>
  );
}

function FoundationMetric({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'ok' | 'sol';
  helper: string;
}) {
  return (
    <div className={`triage-metric ${tone}`}>
      <div className="min-w-0">
        <span>{label}</span>
        <p className="mt-1 text-xs normal-case" style={{ color: 'var(--muted)', letterSpacing: 0 }}>
          {helper}
        </p>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function FoundationCard({
  icon: Icon,
  title,
  status,
  description,
  rows,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  status: string;
  description: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section
      className="rounded-lg p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ background: 'var(--surface-2)', color: 'var(--emerald-400)' }}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--fg)' }}>{title}</h2>
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>{status}</p>
          </div>
        </div>
      </div>
      <p className="mb-4 text-sm" style={{ color: 'var(--fg-2)' }}>{description}</p>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span style={{ color: 'var(--muted)' }}>{label}</span>
            <strong className="text-right" style={{ color: 'var(--fg)' }}>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CandidateRow({ alert }: { alert: Alert }) {
  const proofState = hasPublicProof(alert) ? 'Public proof' : 'Needs proof';
  const bountyState = hasBounty(alert) ? 'Bounty observed' : 'No bounty';

  return (
    <article
      className="rounded-lg p-4"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--hairline)',
        borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="rounded px-2 py-0.5 text-xs" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)' }}>
              {alert.source}
            </span>
            <span className="rounded px-2 py-0.5 text-xs" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)' }}>
              {proofState}
            </span>
            <span className="rounded px-2 py-0.5 text-xs" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)' }}>
              {bountyState}
            </span>
          </div>
          <h3 className="truncate font-semibold" style={{ color: 'var(--fg)' }}>{alert.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--muted)' }}>{alert.description}</p>
        </div>
        <code className="shrink-0 text-xs" style={{ color: 'var(--subtle)' }}>
          {alert.id.slice(0, 8)}
        </code>
      </div>
    </article>
  );
}

function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-lg px-6 py-10 text-center" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
      <Icon className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--dim)' }} />
      <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm">{message}</p>
    </div>
  );
}

function ReadOnlyPanel({
  icon: Icon,
  title,
  items,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg p-5" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5" style={{ color: 'var(--emerald-400)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--fg)' }}>{title}</h2>
      </div>
      <ul className="space-y-2 text-sm" style={{ color: 'var(--fg-2)' }}>
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span style={{ color: 'var(--emerald-400)' }}>-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReadOnlyBadge() {
  return (
    <span
      className="rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
    >
      Read-only
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Alert['severity'] }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-xs font-semibold uppercase"
      style={{
        background: getSeverityBackground(severity),
        color: getSeverityColor(severity),
        border: `1px solid ${getSeverityColor(severity)}`,
      }}
    >
      {severity}
    </span>
  );
}

function isValidationCandidate(alert: Alert) {
  return alert.severity === 'critical' || alert.severity === 'high' || hasPublicProof(alert);
}

function hasPublicProof(alert: Alert) {
  return Boolean(alert.blockchain_tx_id || alert.proof?.tx_id || alert.proof?.attested);
}

function hasBounty(alert: Alert) {
  return Boolean(alert.bounty_tx_id || alert.bounty_amount_sol || alert.proof?.bounty?.tx_id || alert.proof?.bounty?.amount_sol);
}

function getSeverityColor(severity: Alert['severity']) {
  const colors: Record<Alert['severity'], string> = {
    critical: 'var(--crit)',
    high: 'var(--high)',
    medium: 'var(--med)',
    low: 'var(--low)',
    info: 'var(--muted)',
  };
  return colors[severity];
}

function getSeverityBackground(severity: Alert['severity']) {
  const colors: Record<Alert['severity'], string> = {
    critical: 'var(--crit-bg)',
    high: 'var(--high-bg)',
    medium: 'var(--med-bg)',
    low: 'var(--surface-3)',
    info: 'var(--surface-3)',
  };
  return colors[severity];
}
