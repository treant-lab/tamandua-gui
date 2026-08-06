import type { DashboardScenario } from './scenarios';
import { MUTATION_DENIALS } from './scenarios';

export interface FixtureBoundaryProps {
  readonly scenario: DashboardScenario;
}

const canaryNavigation = [
  { label: 'Dashboard', active: true },
  { label: 'Alerts', active: false },
  { label: 'Scan', active: false },
  { label: 'Quarantine', active: false },
  { label: 'Settings', active: false },
] as const;

export function FixtureBoundary({ scenario }: FixtureBoundaryProps) {
  return (
    <div
      className={`fixture-shell fixture-shell--${scenario.tone}`}
      data-fixture-boundary="isolated"
      data-mutation-boundary="fixture_denied"
      data-scenario-id={scenario.id}
    >
      <header className="fixture-banner" role="status">
        <strong>VISUAL FIXTURE · NO ENDPOINT ACTIONS</strong>
        <span>browser fixture — not native Tauri/WebView2 runtime</span>
      </header>

      <div className="fixture-layout">
        <aside className="fixture-sidebar" aria-label="Canary navigation">
          <div className="fixture-brand">
            <span className="fixture-brand-mark" aria-hidden="true">T</span>
            <span>
              <strong>Tamandua</strong>
              <small>Windows fixture</small>
            </span>
          </div>

          <p className="fixture-nav-label">Canary scope</p>
          <nav>
            {canaryNavigation.map((item) => (
              <span
                key={item.label}
                className={item.active ? 'fixture-nav-item active' : 'fixture-nav-item excluded'}
                aria-current={item.active ? 'page' : undefined}
                aria-disabled={!item.active}
              >
                <span aria-hidden="true">{item.active ? '◆' : '◇'}</span>
                {item.label}
                {!item.active && <small>excluded</small>}
              </span>
            ))}
          </nav>

          <div className="fixture-boundary-note">
            <strong>Boundary locked</strong>
            <span>No service, agent, credentials, storage or network access.</span>
          </div>
        </aside>

        <main className="fixture-main">
          <div className="fixture-page-head">
            <div>
              <p className="fixture-kicker">Dashboard · deterministic {scenario.tone}</p>
              <h1>{scenario.heading}</h1>
              <p>{scenario.summary}</p>
            </div>
            <div className="fixture-badges" aria-label="Connection status">
              <span className="fixture-badge fixture-badge--critical">{scenario.agentLabel}</span>
              <span className="fixture-badge fixture-badge--neutral">{scenario.backendLabel}</span>
            </div>
          </div>

          <section className="fixture-status-card" aria-labelledby="fixture-status-heading">
            <div className="fixture-status-icon" aria-hidden="true">!</div>
            <div>
              <p className="fixture-kicker">Fixture state</p>
              <h2 id="fixture-status-heading">{scenario.statusCode}</h2>
              <p>{scenario.detail}</p>
            </div>
            <span className="fixture-status-pill">not runtime evidence</span>
          </section>

          <section className="fixture-stat-grid" aria-label="Deterministic local metrics">
            <MetricCard label="Agent status" value={scenario.agentLabel} detail="Local scenario" tone="critical" />
            <MetricCard label="Alerts" value={String(scenario.metrics.alerts)} detail="No endpoint queried" />
            <MetricCard label="Collectors" value={String(scenario.metrics.collectors)} detail="No collectors started" />
            <MetricCard label="Uptime" value={scenario.metrics.uptime} detail="Fixed fixture value" />
          </section>

          <div className="fixture-content-grid">
            <section className="fixture-panel">
              <div className="fixture-panel-head">
                <div>
                  <p className="fixture-kicker">System resources</p>
                  <h2>Unavailable while offline</h2>
                </div>
                <span>synthetic</span>
              </div>
              <MetricBar label="CPU usage" value={scenario.metrics.cpu} />
              <MetricBar label="Memory" value={scenario.metrics.memory} />
            </section>

            <section className="fixture-panel">
              <div className="fixture-panel-head">
                <div>
                  <p className="fixture-kicker">Endpoint actions</p>
                  <h2>Denied by construction</h2>
                </div>
                <span>{MUTATION_DENIALS.length} blocked</span>
              </div>
              <div className="fixture-denials">
                {MUTATION_DENIALS.map((denial) => (
                  <div className="fixture-denial" key={denial.action}>
                    <span>{denial.action.replaceAll('_', ' ')}</span>
                    <code>{denial.code}</code>
                    <button type="button" disabled aria-label={`${denial.action} denied`}>
                      No operation
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="fixture-footer">
            <span>Scenario: <code>{scenario.id}</code></span>
            <span>Route: <code>{scenario.route}</code></span>
            <span>Boundary: <code>fixture_denied</code></span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: 'neutral' | 'critical';
}) {
  return (
    <article className={`fixture-stat fixture-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function MetricBar({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="fixture-metric">
      <div><span>{label}</span><code>{value}%</code></div>
      <div className="fixture-meter" aria-label={`${label}: ${value}%`}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
