import { ExternalLink, ShieldAlert, Target } from 'lucide-react';
import { useGuiCapabilities } from '../hooks/useTauri';

export function MitreAttack() {
  const { data: capabilities, isLoading } = useGuiCapabilities();
  const supported = capabilities?.mitre_coverage_supported === true;

  return (
    <div className="sentinel-page space-y-6">
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Coverage · ATT&CK</div>
          <h1>MITRE ATT&CK Coverage</h1>
          <p>Detection coverage will be shown only when backed by indexed local rules or real detections.</p>
        </div>
        <a
          href="https://attack.mitre.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="sentinel-btn"
        >
          <ExternalLink className="w-4 h-4" />
          <span>MITRE ATT&CK</span>
        </a>
      </div>

      <div className="card p-8">
        <div className="flex items-start gap-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--emerald-400)' }}
          >
            {isLoading ? <Target className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div className="max-w-3xl">
            <div className="sentinel-kicker">
              {isLoading ? 'Checking capability' : supported ? 'Ready' : 'Capability unavailable'}
            </div>
            <h2 className="mt-2 text-xl font-semibold" style={{ color: 'var(--fg)' }}>
              {supported ? 'Coverage provider is available' : 'No real MITRE coverage provider is wired in this build'}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--fg-2)' }}>
              This page no longer renders synthetic ATT&CK coverage. Wire this view to a local rule
              index or detection coverage contract before showing percentages, technique counts, or
              mapped detections.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <CapabilityTile label="Rules index" value={supported ? 'Available' : 'Not wired'} />
              <CapabilityTile label="Detection mapping" value={supported ? 'Available' : 'Not wired'} />
              <CapabilityTile label="Technique stats" value={supported ? 'Available' : 'Not wired'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--hairline)', background: 'var(--surface-2)' }}>
      <div className="text-xs uppercase" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="mt-1 font-medium" style={{ color: 'var(--fg)' }}>{value}</div>
    </div>
  );
}
