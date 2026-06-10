import { useState, useEffect } from 'react';
import {
  useAgentConfig,
  useUpdateConfig,
  useTestConnection,
  useIsolateNetwork,
  useRestoreNetwork,
  usePerformanceProfile,
  type AgentConfig,
} from '../hooks/useTauri';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import {
  Settings as SettingsIcon,
  Save,
  Wifi,
  WifiOff,
  TestTube,
  Activity,
  Shield,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { ProfileSwitcher } from '../components/settings/ProfileSwitcher';
import { AgentControl } from '../components/settings/AgentControl';

export function Settings() {
  const { data: configData, isLoading, isError, error } = useAgentConfig();
  const updateConfig = useUpdateConfig();
  const testConnection = useTestConnection();
  const isolateNetwork = useIsolateNetwork();
  const restoreNetwork = useRestoreNetwork();
  const { data: activeProfile } = usePerformanceProfile();
  const { requireAuth } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (configData) {
      setConfig(configData);
    }
  }, [configData]);

  const handleSave = async () => {
    if (!config) return;

    try {
      await updateConfig.mutateAsync(config);
      setHasChanges(false);
      toast.success('Configuration saved', 'Settings have been applied');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('Save failed', String(error));
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync();
      if (result) {
        toast.success('Connection successful', 'Backend server is reachable');
      } else {
        toast.warning('Connection failed', 'Could not reach the backend server');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('Connection test failed', String(error));
    }
  };

  const handleIsolateNetwork = async () => {
    // Require authentication for critical action
    const authed = await requireAuth();
    if (!authed) return;

    const confirmed = await confirm({
      title: 'Isolate Network',
      message: 'This will block all network connections on this endpoint. The agent will enter offline mode. Continue?',
      confirmText: 'Isolate Network',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await isolateNetwork.mutateAsync();
      toast.success('Network isolated', 'All network connections have been blocked');
    } catch (error) {
      console.error('Failed to isolate network:', error);
      toast.error('Isolation failed', String(error));
    }
  };

  const handleRestoreNetwork = async () => {
    // Require authentication for critical action
    const authed = await requireAuth();
    if (!authed) return;

    try {
      await restoreNetwork.mutateAsync();
      toast.success('Network restored', 'Network connectivity has been restored');
    } catch (error) {
      console.error('Failed to restore network:', error);
      toast.error('Restore failed', String(error));
    }
  };

  const updateField = <K extends keyof AgentConfig>(
    field: K,
    value: AgentConfig[K]
  ) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
    setHasChanges(true);
  };

  // Show error state if agent is disconnected
  if (isError || (!isLoading && !configData && !config)) {
    return (
      <div className="sentinel-page space-y-6">
        <div className="card p-6 text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'var(--crit-bg)' }}
          >
            <SettingsIcon className="w-8 h-8" style={{ color: 'var(--crit)' }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--crit)' }}>
            Agent Disconnected
          </h2>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>
            Cannot load configuration. The agent service is not running or not connected.
          </p>
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>
            {error instanceof Error ? error.message : 'Please ensure the agent is running and try again.'}
          </p>
        </div>
        <AgentControl />
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="p-6 lg:p-8" style={{ background: 'var(--bg)' }}>
        <div className="text-center py-12">
          <div
            className="animate-spin rounded-full h-12 w-12 mx-auto"
            style={{ borderWidth: '2px', borderColor: 'var(--border)', borderTopColor: 'var(--emerald-400)' }}
          />
          <p className="mt-4" style={{ color: 'var(--muted)' }}>Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--fg)' }}>Settings</h1>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>Agent configuration and management</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateConfig.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200"
          style={{
            background: hasChanges && !updateConfig.isPending ? 'var(--emerald-500)' : 'var(--surface-2)',
            color: hasChanges && !updateConfig.isPending ? '#042012' : 'var(--subtle)',
            cursor: hasChanges && !updateConfig.isPending ? 'pointer' : 'not-allowed',
            opacity: hasChanges && !updateConfig.isPending ? 1 : 0.6,
          }}
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      <div className="settings-attestation-card">
        <div>
          <div className="sentinel-kicker">Detection profile · Public proof</div>
          <h2>Detection changes should be auditable.</h2>
          <p>
            The operational profile controls telemetry, response aggressiveness, and which incidents become
            privacy-safe Solana attestations.
          </p>
        </div>
        <div className="settings-attestation-grid">
          <SettingsProofStat label="Profile" value={activeProfile ?? config.performance_profile ?? 'unknown'} tone="ok" />
          <SettingsProofStat label="Network" value="devnet" tone="sol" />
          <SettingsProofStat label="High/Critical" value="auto attest" tone="sol" />
          <SettingsProofStat label="Private data" value="redacted" tone="ok" />
        </div>
      </div>

      {/* Connection Settings */}
      <SettingsCard
        icon={Wifi}
        title="Connection"
        description="Server connection and communication settings"
      >
        <div className="space-y-4">
          <FormField label="Server URL">
            <input
              type="text"
              value={config.server_url}
              onChange={(e) => updateField('server_url', e.target.value)}
              placeholder="wss://server.example.com:4000/socket/agent"
              className="w-full px-3 py-2 rounded-lg font-mono text-sm transition-colors duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--emerald-400)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--emerald-glow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            {!config.server_url.trim() && (
              <p className="mt-2 text-xs" style={{ color: 'var(--high)' }}>
                No server URL is configured in the local agent config.
              </p>
            )}
          </FormField>

          <div>
            <button
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--fg-2)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-3)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <TestTube className="w-4 h-4" />
              <span>{testConnection.isPending ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Collection Settings */}
      <SettingsCard
        icon={Activity}
        title="Collection"
        description="Telemetry collection and monitoring settings"
      >
        <div className="space-y-4">
          <FormField label="Collection Interval (ms)" hint="How often to collect telemetry (100-60000ms)">
            <input
              type="number"
              value={config.collection_interval_ms}
              onChange={(e) =>
                updateField('collection_interval_ms', parseInt(e.target.value))
              }
              min="100"
              max="60000"
              step="100"
              className="w-full px-3 py-2 rounded-lg font-mono text-sm transition-colors duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--emerald-400)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--emerald-glow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </FormField>

          <FormField label="Enabled Collectors">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                'process',
                'file',
                'network',
                'dns',
                'registry',
                'driver',
                'wmi',
              ].map((collector) => (
                <label
                  key={collector}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors duration-200"
                  style={{
                    background: config.enabled_collectors.includes(collector)
                      ? 'var(--emerald-glow)'
                      : 'var(--surface)',
                    border: `1px solid ${
                      config.enabled_collectors.includes(collector)
                        ? 'rgba(47, 196, 113, 0.3)'
                        : 'var(--border)'
                    }`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.enabled_collectors.includes(collector)}
                    onChange={(e) => {
                      const newCollectors = e.target.checked
                        ? [...config.enabled_collectors, collector]
                        : config.enabled_collectors.filter((c) => c !== collector);
                      updateField('enabled_collectors', newCollectors);
                    }}
                    className="sr-only"
                  />
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center transition-colors"
                    style={{
                      background: config.enabled_collectors.includes(collector)
                        ? 'var(--emerald-500)'
                        : 'var(--surface-2)',
                      border: `1px solid ${
                        config.enabled_collectors.includes(collector)
                          ? 'var(--emerald-500)'
                          : 'var(--border-strong)'
                      }`,
                    }}
                  >
                    {config.enabled_collectors.includes(collector) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#042012' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span
                    className="text-sm capitalize"
                    style={{
                      color: config.enabled_collectors.includes(collector)
                        ? 'var(--emerald-200)'
                        : 'var(--fg-2)',
                    }}
                  >
                    {collector}
                  </span>
                </label>
              ))}
            </div>
          </FormField>
        </div>
      </SettingsCard>

      {/* Detection Settings */}
      <SettingsCard
        icon={Shield}
        title="Detection"
        description="Threat detection and response configuration"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleSwitch
              label="ML Detection"
              description="Use machine learning for threat detection"
              checked={config.ml_detection_enabled}
              onChange={(checked) => updateField('ml_detection_enabled', checked)}
            />
            <ToggleSwitch
              label="Auto-quarantine"
              description="Automatically quarantine detected threats"
              checked={config.auto_quarantine}
              onChange={(checked) => updateField('auto_quarantine', checked)}
            />
          </div>

          <FormField label="YARA Rules Path">
            <input
              type="text"
              value={config.yara_rules_path || ''}
              onChange={(e) => updateField('yara_rules_path', e.target.value || undefined)}
              placeholder="/path/to/yara/rules"
              className="w-full px-3 py-2 rounded-lg font-mono text-sm transition-colors duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--emerald-400)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--emerald-glow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </FormField>

          <FormField label="Sigma Rules Path">
            <input
              type="text"
              value={config.sigma_rules_path || ''}
              onChange={(e) => updateField('sigma_rules_path', e.target.value || undefined)}
              placeholder="/path/to/sigma/rules"
              className="w-full px-3 py-2 rounded-lg font-mono text-sm transition-colors duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--emerald-400)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--emerald-glow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </FormField>
        </div>
      </SettingsCard>

      {/* Advanced Settings */}
      <SettingsCard
        icon={Sliders}
        title="Advanced"
        description="Logging and advanced configuration options"
      >
        <div className="space-y-4">
          <FormField label="Log Level">
            <select
              value={config.log_level}
              onChange={(e) => updateField('log_level', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm transition-colors duration-200 appearance-none cursor-pointer"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a9aa1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--emerald-400)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--emerald-glow)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
              <option value="trace">Trace</option>
            </select>
          </FormField>
        </div>
      </SettingsCard>

      {/* Collection Performance Profile */}
      <ProfileSwitcher />

      {/* Agent Control */}
      <AgentControl />

      {/* Response Actions */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderLeft: '4px solid var(--high)',
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'var(--high-bg)' }}
          >
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--high)' }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>Response Actions</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Emergency response actions for critical incidents
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleIsolateNetwork}
            disabled={isolateNetwork.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200"
            style={{
              background: 'var(--crit-bg)',
              color: 'var(--crit)',
              border: '1px solid rgba(240, 80, 110, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--crit)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--crit-bg)';
              e.currentTarget.style.color = 'var(--crit)';
            }}
          >
            <WifiOff className="w-4 h-4" />
            <span>{isolateNetwork.isPending ? 'Isolating...' : 'Isolate Network'}</span>
          </button>

          <button
            onClick={handleRestoreNetwork}
            disabled={restoreNetwork.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200"
            style={{
              background: 'var(--emerald-glow)',
              color: 'var(--emerald-400)',
              border: '1px solid rgba(47, 196, 113, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--emerald-500)';
              e.currentTarget.style.color = '#042012';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--emerald-glow)';
              e.currentTarget.style.color = 'var(--emerald-400)';
            }}
          >
            <Wifi className="w-4 h-4" />
            <span>{restoreNetwork.isPending ? 'Restoring...' : 'Restore Network'}</span>
          </button>
        </div>
      </div>

      {/* Save Reminder */}
      {hasChanges && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{
            background: 'var(--high-bg)',
            border: '1px solid rgba(245, 165, 36, 0.3)',
          }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--high)' }} />
          <p style={{ color: 'var(--high)' }}>
            You have unsaved changes. Click "Save Changes" to apply them.
          </p>
        </div>
      )}
    </div>
  );
}

// Settings Card Component
interface SettingsCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsCard({ icon: Icon, title, description, children }: SettingsCardProps) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="p-2 rounded-lg"
          style={{ background: 'var(--emerald-glow)' }}
        >
          <Icon className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
        </div>
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>{title}</h2>
          {description && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function SettingsProofStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'sol';
}) {
  return (
    <div className={`settings-proof-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// Form Field Component
interface FormFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// Toggle Switch Component
interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  return (
    <label
      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-200"
      style={{
        background: checked ? 'var(--emerald-glow)' : 'var(--surface-2)',
        border: `1px solid ${checked ? 'rgba(47, 196, 113, 0.3)' : 'var(--border)'}`,
      }}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-10 h-5 rounded-full transition-colors duration-200"
          style={{
            background: checked ? 'var(--emerald-500)' : 'var(--surface-3)',
          }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
            style={{
              background: checked ? '#042012' : 'var(--muted)',
              transform: checked ? 'translateX(20px)' : 'translateX(2px)',
            }}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="text-sm font-medium block"
          style={{ color: checked ? 'var(--emerald-200)' : 'var(--fg-2)' }}
        >
          {label}
        </span>
        {description && (
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
            {description}
          </span>
        )}
      </div>
    </label>
  );
}
