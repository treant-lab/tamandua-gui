import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  UserRoundCog,
  Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import { ensureElevatedForAgentAction } from '../lib/privileges';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

interface AgentSetupStatus {
  is_elevated: boolean;
  can_read_agent_token: boolean;
  agent_id: string | null;
  platform: string;
  service_installed: boolean;
  service_name: string | null;
  service_state: string | null;
  service_path: string | null;
  process_running: boolean;
  agent_binary_path: string | null;
  next_action: 'elevate' | 'install' | 'start' | 'wait_for_token' | 'ready' | 'unsupported' | string;
}

interface AgentInstallInfo {
  success: boolean;
  service_name: string;
  agent_id: string | null;
  message: string;
}

interface AgentRepairInfo {
  success: boolean;
  service_name: string;
  agent_id: string | null;
  ipc_ready: boolean;
  message: string;
}

interface AgentStartInfo {
  service_name: string;
  started: boolean;
  message: string;
}

const DEFAULT_SERVER = 'wss://agents.tamandua.treantlab.org:8443/socket/agent';
const DEFAULT_ENROLLMENT_URL = 'https://tamandua.treantlab.org';

export function AgentSetup() {
  const confirm = useConfirm();
  const toast = useToast();
  const { requireAuth } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AgentSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [enrollmentUrl, setEnrollmentUrl] = useState(DEFAULT_ENROLLMENT_URL);
  const [serviceName, setServiceName] = useState('TamanduaAgent');
  const [noDriver, setNoDriver] = useState(false);
  const isMac = status?.platform === 'macos' || /Mac/i.test(navigator.platform);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await invoke<AgentSetupStatus>('get_agent_setup_status');
      setStatus(next);
    } catch (error) {
      toast.error('Setup status failed', String(error));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refreshLiveStatus = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['status'] }),
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] }),
      queryClient.invalidateQueries({ queryKey: ['isConnected'] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ensureReadyForPrivilegedAction = async () => {
    if (isMac) return true;
    const authed = await requireAuth();
    if (!authed) return false;
    return ensureElevatedForAgentAction(confirm, toast);
  };

  const handleInstall = async () => {
    if (!token.trim()) {
      toast.error('Enrollment token required', 'Paste the token from the Tamandua console.');
      return;
    }
    if (!(await ensureReadyForPrivilegedAction())) return;

    setBusy('install');
    try {
      const result = await invoke<AgentInstallInfo>('install_agent_service', {
        token: token.trim(),
        server: server.trim() || DEFAULT_SERVER,
        enrollmentUrl: enrollmentUrl.trim() || DEFAULT_ENROLLMENT_URL,
        serviceName: serviceName.trim() || 'TamanduaAgent',
        noDriver,
      });
      const agentId = result.agent_id ? ` Agent ID: ${result.agent_id}` : '';
      toast.success(result.success ? 'Agent installed' : 'Install finished', `${result.message}${agentId}`);
      await refresh();
      await refreshLiveStatus();
    } catch (error) {
      toast.error('Install failed', String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleRepair = async () => {
    if (!(await ensureReadyForPrivilegedAction())) return;

    setBusy('repair');
    try {
      const result = await invoke<AgentRepairInfo>('repair_agent_service');
      const agentId = result.agent_id ? ` Agent ID: ${result.agent_id}` : '';
      const ipc = result.ipc_ready ? ' IPC is ready.' : ' Waiting for IPC to become readable.';
      toast.success(result.success ? 'Agent repaired' : 'Repair finished', `${result.message}${agentId}${ipc}`);
      await refreshLiveStatus();
      setTimeout(refresh, 1800);
    } catch (error) {
      toast.error('Repair failed', String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleStart = async () => {
    if (!(await ensureReadyForPrivilegedAction())) return;

    setBusy('start');
    try {
      const result = await invoke<AgentStartInfo>('start_agent');
      toast.success(result.started ? 'Agent start requested' : 'Agent already running', result.message);
      await refreshLiveStatus();
      setTimeout(refresh, 1800);
    } catch (error) {
      toast.error('Start failed', String(error));
    } finally {
      setBusy(null);
    }
  };

  const steps = buildSteps(status);

  return (
    <div className="sentinel-page space-y-6">
      <div className="sentinel-page-head">
        <div>
          <div className="sentinel-kicker">Setup · Recovery</div>
          <h1>Agent Setup</h1>
          <p>Instale, associe e inicie o endpoint sem depender de IPC quando o agent estiver offline.</p>
        </div>
        <button className="sentinel-btn" onClick={refresh} disabled={loading}>
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="sentinel-kicker">State machine</div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>Endpoint readiness</h2>
            </div>
            <span className={clsx('sentinel-badge', status?.next_action === 'ready' ? 'ok' : 'warn')}>
              {status?.next_action || 'checking'}
            </span>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.label} className={clsx('setup-step', step.state)}>
                <div className="setup-step-icon">
                  {step.state === 'done' ? <Check className="w-4 h-4" /> : step.icon}
                </div>
                <div>
                  <div className="setup-step-label">{step.label}</div>
                  <div className="setup-step-copy">{step.copy}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatusCell label={isMac ? 'macOS Auth' : 'Elevation'} value={isMac ? 'On demand' : status?.is_elevated ? 'Administrator' : 'Standard user'} tone={isMac || status?.is_elevated ? 'ok' : 'warn'} />
            <StatusCell label={isMac ? 'LaunchDaemon' : 'Service'} value={status?.service_installed ? `${status.service_name} · ${status.service_state}` : 'Not installed'} tone={status?.service_installed ? 'ok' : 'crit'} />
            <StatusCell label="IPC Token" value={status?.can_read_agent_token ? 'Readable' : 'Unavailable'} tone={status?.can_read_agent_token ? 'ok' : 'warn'} />
            <StatusCell label="Agent ID" value={status?.agent_id ? shortId(status.agent_id) : 'Not registered'} tone={status?.agent_id ? 'ok' : 'warn'} />
            <StatusCell label="Binary" value={status?.agent_binary_path ? 'Found' : 'Missing'} tone={status?.agent_binary_path ? 'ok' : 'crit'} />
          </div>

          {status?.service_path && (
            <div className="setup-path">
              <span>Service path</span>
              <code>{status.service_path}</code>
            </div>
          )}

          <div className="setup-form">
            <div className="setup-form-head">
              <KeyRound className="w-5 h-5" />
              <div>
                <h3>{isMac ? 'Enroll and install LaunchDaemon' : 'Enroll and install service'}</h3>
                <p>{isMac ? 'Use o token do console; o macOS vai pedir autorização de administrador só para instalar o agente privilegiado.' : 'Use o token do console para vincular este endpoint à conta/org correta no servidor.'}</p>
              </div>
            </div>

            <label>
              <span>Enrollment token</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from Tamandua console"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <span>Backend WebSocket</span>
                <input value={server} onChange={(e) => setServer(e.target.value)} />
              </label>
              <label>
                <span>Enrollment URL</span>
                <input value={enrollmentUrl} onChange={(e) => setEnrollmentUrl(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <span>{isMac ? 'LaunchDaemon name' : 'Service name'}</span>
                <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
              </label>
              {!isMac && (
                <label className="setup-checkbox">
                  <input type="checkbox" checked={noDriver} onChange={(e) => setNoDriver(e.target.checked)} />
                  <span>Skip driver install</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="sentinel-btn sentinel-btn-primary" onClick={handleInstall} disabled={busy === 'install'}>
              {busy === 'install' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserRoundCog className="w-4 h-4" />}
              Install / Enroll Agent
            </button>
            <button className="sentinel-btn" onClick={handleStart} disabled={busy === 'start'}>
              {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Agent
            </button>
            <button className="sentinel-btn" onClick={handleRepair} disabled={busy === 'repair' || !status?.service_installed}>
              {busy === 'repair' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              Repair Local Agent
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function shortId(agentId: string) {
  if (agentId.length <= 13) return agentId;
  return `${agentId.slice(0, 8)}...${agentId.slice(-4)}`;
}

function buildSteps(status: AgentSetupStatus | null) {
  const isMac = status?.platform === 'macos';
  return [
    {
      label: isMac ? 'macOS authorization' : 'GUI elevated',
      copy: isMac
        ? 'Privileged actions use the macOS administrator prompt on demand.'
        : status?.is_elevated ? 'Privileged local actions are available.' : 'Restart as Administrator before service/driver actions.',
      state: isMac || status?.is_elevated ? 'done' : 'active',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      label: isMac ? 'Agent LaunchDaemon installed' : 'Agent service installed',
      copy: status?.service_installed ? `${status.service_name} is registered.` : 'Install/enroll with a console token.',
      state: status?.service_installed ? 'done' : isMac || status?.is_elevated ? 'active' : 'pending',
      icon: <UserRoundCog className="w-4 h-4" />,
    },
    {
      label: 'Agent running',
      copy: status?.service_state === 'RUNNING' || status?.process_running ? 'Local agent process is active.' : isMac ? 'Start the LaunchDaemon.' : 'Start the Windows service.',
      state: status?.service_state === 'RUNNING' || status?.process_running ? 'done' : status?.service_installed ? 'active' : 'pending',
      icon: <Play className="w-4 h-4" />,
    },
    {
      label: 'IPC authenticated',
      copy: status?.can_read_agent_token ? 'GUI can authenticate to the agent.' : 'Waiting for protected token/IPC availability.',
      state: status?.can_read_agent_token ? 'done' : status?.service_state === 'RUNNING' ? 'active' : 'pending',
      icon: <TerminalSquare className="w-4 h-4" />,
    },
  ];
}

function StatusCell({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'crit' }) {
  return (
    <div className={clsx('setup-status-cell', tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
