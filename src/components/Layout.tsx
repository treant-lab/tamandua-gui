import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Calendar,
  Check,
  Command,
  Cpu,
  FolderOpen,
  History,
  Key,
  Lock,
  Menu,
  Network,
  Radio,
  RefreshCw,
  RotateCw,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldOff,
  Target,
  Undo2,
  Users,
  UserRoundCog,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAgentSetupStatus, useAgentStatus, useIsConnected, usePrivilegeStatus, useRelaunchAsAdministrator } from '../hooks/useTauri';
import { SessionIndicator } from './auth';
import { NotificationCenter } from './notifications';
import { QuickActionsPanel } from './quick';
import logoMark from '../assets/icons/icon-128.png';

const navGroups = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard', icon: Shield, label: 'Dashboard' },
      { to: '/alerts', icon: AlertTriangle, label: 'Alerts', countKey: 'alerts', countTone: 'hot' },
      { to: '/events', icon: History, label: 'Event History' },
      { to: '/processes', icon: Activity, label: 'Processes' },
      { to: '/network', icon: Network, label: 'Network' },
      { to: '/files', icon: FolderOpen, label: 'Files' },
      { to: '/performance', icon: BarChart3, label: 'Performance' },
      { to: '/logs', icon: ScrollText, label: 'Logs' },
    ],
  },
  {
    title: 'Containment',
    items: [
      { to: '/mitre', icon: Target, label: 'MITRE ATT&CK' },
      { to: '/threat-intel', icon: Radio, label: 'Threat Intel' },
      { to: '/community', icon: Users, label: 'Community' },
      { to: '/response-history', icon: Undo2, label: 'Response History' },
      { to: '/scan', icon: Search, label: 'Scan' },
      { to: '/schedules', icon: Calendar, label: 'Scheduled Scans' },
      { to: '/quarantine', icon: Archive, label: 'Quarantine', countKey: 'quarantine', countTone: 'warn' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/exclusions', icon: ShieldOff, label: 'Exclusions' },
      { to: '/setup', icon: UserRoundCog, label: 'Agent Setup' },
      { to: '/updates', icon: RotateCw, label: 'Updates' },
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/security', icon: Lock, label: 'Security' },
      { to: '/license', icon: Key, label: 'License' },
    ],
  },
] as const;

const pageLabels: Record<string, string> = Object.fromEntries(
  navGroups.flatMap((group) => group.items.map((item) => [item.to, item.label]))
);

export function Layout() {
  const { data: status, isLoading: statusLoading } = useAgentStatus();
  const { data: setupStatus } = useAgentSetupStatus();
  const { data: ipcConnected } = useIsConnected();
  const { data: privilege } = usePrivilegeStatus();
  const relaunchAsAdmin = useRelaunchAsAdministrator();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const statusAny = status as any;
  const platform = privilege?.platform ?? statusAny?.platform ?? '';
  const isMac = platform === 'macos' || platform === 'darwin' || /Mac/i.test(navigator.platform);
  const ipcReachable = Boolean(ipcConnected || status?.version || status?.state);
  const localAgentRunning = Boolean(
    setupStatus?.service_state === 'RUNNING' ||
      setupStatus?.process_running ||
      setupStatus?.service_installed
  );
  const agentReachable = ipcReachable || localAgentRunning;
  const adminRequired = !isMac && localAgentRunning && !ipcReachable && privilege && !privilege.is_elevated;
  const backendConnected = Boolean(statusAny?.backend_connected ?? statusAny?.connected);
  const backendStatusPending = localAgentRunning && !ipcReachable;
  const enrollmentPending = String(statusAny?.agent_id ?? '').startsWith('pending-');
  const currentPage = pageLabels[location.pathname] ?? 'Dashboard';
  const alertCount = Number((status as any)?.active_alerts ?? (status as any)?.alerts_count ?? 0);
  const quarantineCount = Number((status as any)?.quarantined_count ?? 0);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setCommandOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const handleCommandKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener('keydown', handleCommandKey);
    return () => document.removeEventListener('keydown', handleCommandKey);
  }, []);

  const counts = {
    alerts: alertCount > 0 ? alertCount : undefined,
    quarantine: quarantineCount > 0 ? quarantineCount : undefined,
  };

  const commands = navGroups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      group: group.title,
    }))
  );
  const normalizedQuery = commandQuery.trim().toLowerCase();
  const filteredCommands = commands.filter((command) => {
    if (!normalizedQuery) return true;
    return `${command.label} ${command.group} ${command.to}`.toLowerCase().includes(normalizedQuery);
  }).slice(0, 10);

  const openCommand = (to: string) => {
    setCommandOpen(false);
    setCommandQuery('');
    navigate(to);
  };

  const sidebarContent = (
    <>
      <div className="sentinel-brand">
        <div className="sentinel-brand-mark">
          <img src={logoMark} alt="Tamandua Sentinel" />
        </div>
        <div className="min-w-0">
          <div className="sentinel-brand-name">Tamandua</div>
          <div className="sentinel-brand-sub">SENTINEL</div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="sentinel-icon-btn md:hidden ml-auto"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="sentinel-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="sentinel-nav-group">
            <div className="sentinel-nav-title">{group.title}</div>
            {group.items.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                count={'countKey' in item ? counts[item.countKey] : undefined}
                countTone={'countTone' in item ? item.countTone : undefined}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="sentinel-sidebar-bottom">
        <SessionIndicator compact />
        <div className="sentinel-host-card">
          {statusLoading ? (
            <StatusSkeleton />
          ) : (
            <>
              <div className="sentinel-host-row">
                <span className={clsx('sentinel-dot', agentReachable ? 'online' : adminRequired ? 'warn' : 'offline')} />
                <span>
                  {agentReachable
                    ? ipcReachable
                      ? 'Agent service online'
                      : 'Agent service running'
                    : adminRequired
                      ? 'Administrator required'
                      : isMac
                        ? 'Local IPC offline'
                        : 'Agent service offline'}
                </span>
              </div>
              <div className="sentinel-host-meta">
                <span>{status?.hostname || (isMac ? 'macOS endpoint' : 'Local endpoint')}</span>
                <span>
                  {status?.version
                    ? `Agent ${status.version}`
                    : agentReachable
                      ? 'Version pending'
                      : isMac
                        ? 'Waiting for local IPC'
                        : 'Waiting for service'}
                </span>
                {adminRequired && <span>Approve UAC to read protected IPC</span>}
                {!agentReachable && isMac && <span>Open Agent Setup to repair the LaunchDaemon IPC</span>}
                {agentReachable && (
                  <span>
                    {backendConnected
                      ? 'Backend connected'
                      : backendStatusPending
                        ? 'Backend status pending'
                        : enrollmentPending
                          ? 'Enrollment pending'
                          : 'Backend offline'}
                  </span>
                )}
              </div>
              {!agentReachable && (
                <button
                  className="sentinel-host-action"
                  onClick={() => {
                    if (adminRequired) {
                      relaunchAsAdmin.mutate({ exitCurrent: true });
                    } else {
                      navigate('/setup');
                    }
                  }}
                >
                  {adminRequired ? 'Restart as admin' : 'Open setup'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="sentinel-shell">
      <div className="sentinel-titlebar">
        <div className="sentinel-window-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="sentinel-title">
          <img src={logoMark} alt="" />
          <b>Tamandua Sentinel</b>
          <span>·</span>
          <span>Agent GUI</span>
        </div>
        <div className="sentinel-title-meta">
          <span className={clsx('sentinel-dot', agentReachable ? 'online' : adminRequired ? 'warn' : 'offline')} />
          {agentReachable ? 'Local service' : adminRequired ? 'Admin required' : isMac ? 'Local IPC offline' : 'Offline'}
        </div>
      </div>

      <div className="sentinel-workspace">
        <div className="md:hidden sentinel-mobilebar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="sentinel-icon-btn"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="sentinel-mobile-title">{currentPage}</div>
          <NotificationCenter />
        </div>

        <div
          className={clsx(
            'fixed inset-0 z-50 md:hidden transition-opacity duration-300',
            sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside
            className={clsx(
              'sentinel-sidebar sentinel-sidebar-drawer',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            {sidebarContent}
          </aside>
        </div>

        <aside className="sentinel-sidebar hidden md:flex">{sidebarContent}</aside>

        <section className="sentinel-main">
          <header className="sentinel-topbar">
            <div className="sentinel-crumbs">
              <span>Agent</span>
              <Chevron />
              <strong>{currentPage}</strong>
            </div>

            <button className="sentinel-command" onClick={() => setCommandOpen(true)}>
              <Command className="w-4 h-4" />
              <span>Search events, assets, hashes</span>
              <kbd>⌘K</kbd>
            </button>

            <div className="sentinel-top-actions">
              <button className="sentinel-btn" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4" />
                Sync
              </button>
              <button className="sentinel-btn sentinel-btn-primary" onClick={() => navigate('/scan')}>
                <Check className="w-4 h-4" />
                Run scan
              </button>
              <NotificationCenter />
            </div>
          </header>

          <main className="sentinel-content">
            <Outlet />
            <QuickActionsPanel />
          </main>
        </section>
      </div>

      {commandOpen && (
        <div className="sentinel-command-overlay" role="dialog" aria-modal="true">
          <div className="sentinel-command-backdrop" onClick={() => setCommandOpen(false)} />
          <div className="sentinel-command-panel">
            <div className="sentinel-command-input">
              <Command className="w-5 h-5" />
              <input
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCommands[0]) {
                    openCommand(filteredCommands[0].to);
                  }
                }}
                placeholder="Open page or workflow"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="sentinel-command-list">
              {filteredCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <button
                    key={command.to}
                    className="sentinel-command-item"
                    onClick={() => openCommand(command.to)}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{command.label}</span>
                    <small>{command.group}</small>
                  </button>
                );
              })}
              {filteredCommands.length === 0 && (
                <div className="sentinel-command-empty">No matching workflow</div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="sentinel-statusbar">
        <span>TAMANDUA SENTINEL · AGENT GUI</span>
        <span className="sentinel-status-segment">
          <Cpu className="w-3.5 h-3.5" />
          Driver {agentReachable ? 'waiting' : adminRequired ? 'admin required' : 'offline'}
        </span>
        <span>Backend {backendConnected ? 'connected' : enrollmentPending ? 'enrollment pending' : adminRequired ? 'admin required' : 'offline'}</span>
        <span>{status?.collectors_running?.length ?? 0} collectors</span>
      </footer>
    </div>
  );
}

function Chevron() {
  return <span className="sentinel-chevron">/</span>;
}

function StatusSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-3 w-24 rounded" style={{ background: 'var(--surface-3)' }} />
      <div className="h-3 w-32 rounded" style={{ background: 'var(--surface-3)' }} />
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  countTone?: 'hot' | 'warn';
  onClick?: () => void;
}

function NavItem({ to, icon: Icon, label, count, countTone, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => clsx('sentinel-nav-item', isActive && 'active')}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
      {typeof count === 'number' && (
        <span className={clsx('sentinel-count', countTone === 'hot' ? 'hot' : 'warn')}>{count}</span>
      )}
    </NavLink>
  );
}
