import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/shell';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  FileCode2,
  RefreshCw,
  Server,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useToast } from '../components/Toast';

const DEFAULT_CATALOG = 'https://tamandua.treantlab.org/api/v1/updates/manifest.json';

interface ComponentUpdateStatus {
  id: string;
  name: string;
  kind: string;
  installed_version?: string | null;
  latest_version?: string | null;
  update_available: boolean;
  status: string;
  source_url?: string | null;
  download_url?: string | null;
  sha256?: string | null;
  signature?: string | null;
  error?: string | null;
}

interface UpdateCenterStatus {
  source: string;
  checked_at: string;
  components: ComponentUpdateStatus[];
}

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  gui: Sparkles,
  agent: Server,
  driver: Shield,
  ml: Cloud,
  rules: FileCode2,
};

function statusLabel(status: string) {
  switch (status) {
    case 'current':
      return 'Current';
    case 'update_available':
      return 'Update available';
    case 'not_installed':
      return 'Not installed';
    case 'not_published':
      return 'Not published';
    case 'catalog_unavailable':
      return 'Catalog unavailable';
    default:
      return status.replace(/_/g, ' ');
  }
}

function statusClass(status: string) {
  if (status === 'current') return 'ok';
  if (status === 'update_available') return 'warn';
  if (status === 'catalog_unavailable' || status === 'not_installed') return 'crit';
  return 'muted';
}

export function Updates() {
  const toast = useToast();
  const [catalogUrl, setCatalogUrl] = useState(DEFAULT_CATALOG);
  const [status, setStatus] = useState<UpdateCenterStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<UpdateCenterStatus>('get_update_center_status', {
        catalogUrl: catalogUrl.trim() || DEFAULT_CATALOG,
      });
      setStatus(result);
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error('Update check failed', message);
    } finally {
      setLoading(false);
    }
  }, [catalogUrl, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    const components = status?.components ?? [];
    return {
      total: components.length,
      available: components.filter((component) => component.update_available).length,
      current: components.filter((component) => component.status === 'current').length,
      blocked: components.filter((component) => component.status === 'catalog_unavailable').length,
    };
  }, [status]);

  const openArtifact = async (component: ComponentUpdateStatus) => {
    const url = component.download_url || component.source_url;
    if (!url) {
      toast.warning('No artifact URL', `${component.name} is not published in the current catalog.`);
      return;
    }
    await open(url);
  };

  return (
    <div className="sentinel-page space-y-6">
      <header className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Release operations</div>
          <h1>Update Center</h1>
          <p>Component updates are resolved from Treantlab release metadata and local install state.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            {loading ? 'Checking' : 'Check now'}
          </button>
        </div>
      </header>

      <section className="sentinel-grid-4">
        <div className="metric-card">
          <span>Total components</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="metric-card">
          <span>Current</span>
          <strong>{summary.current}</strong>
        </div>
        <div className="metric-card">
          <span>Updates</span>
          <strong>{summary.available}</strong>
        </div>
        <div className="metric-card">
          <span>Catalog issues</span>
          <strong>{summary.blocked}</strong>
        </div>
      </section>

      <section className="card p-5 update-source-panel">
        <div>
          <div className="sentinel-kicker">Source</div>
          <h2>Treantlab Catalog</h2>
          <p>Use a signed JSON manifest published by the Tamandua backend/CDN.</p>
        </div>
        <input
          value={catalogUrl}
          onChange={(event) => setCatalogUrl(event.target.value)}
          spellCheck={false}
        />
      </section>

      {error && (
        <div className="setup-status-cell crit">
          <AlertTriangle className="w-4 h-4" />
          <strong>{error}</strong>
        </div>
      )}

      <section className="updates-list">
        {(status?.components ?? []).map((component) => {
          const Icon = icons[component.id] ?? Wrench;
          const cls = statusClass(component.status);
          return (
            <article className="card update-component" key={component.id}>
              <div className="update-component-main">
                <div className={`update-component-icon ${cls}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="update-component-title">
                    <h3>{component.name}</h3>
                    <span className={`update-badge ${cls}`}>
                      {cls === 'ok' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {statusLabel(component.status)}
                    </span>
                  </div>
                  <div className="update-component-meta">
                    <span>{component.kind}</span>
                    <span>Installed: {component.installed_version || 'not detected'}</span>
                    <span>Latest: {component.latest_version || 'not published'}</span>
                  </div>
                  {component.error && <p className="update-component-error">{component.error}</p>}
                  {component.sha256 && <code>sha256:{component.sha256}</code>}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => openArtifact(component)}
                disabled={!component.download_url && !component.source_url}
              >
                <Download />
                Artifact
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
