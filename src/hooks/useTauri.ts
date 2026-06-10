import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Types
export interface AgentStatus {
  agent_id: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  version: string;
  hostname: string;
  platform: string;
  uptime_seconds: number;
  connected: boolean;
  backend_connected?: boolean;
  state?: string;
  last_heartbeat: string;
  collectors_running: string[];
  cpu_usage: number;
  memory_usage_mb: number;
}

export interface Alert {
  id: string;
  agent_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  created_at: string;
  source: 'yara' | 'sigma' | 'ml' | 'behavioral';
  mitre_tactics: string[];
  process_name?: string;
  process_id?: number;
  file_path?: string;
  dismissed: boolean;
  metadata: Record<string, any>;
  proof?: AlertProof | null;
  incident_hash?: string | null;
  manifest_hash?: string | null;
  attestation_tlp?: string | null;
  attestation_ioc_count?: number | null;
  attestation_ioc_types?: string[] | null;
  attestation_redacted_ioc_count?: number | null;
  attestation_confidence?: number | null;
  // Blockchain attestation fields (Solana integration)
  blockchain_tx_id?: string | null;
  blockchain_attested_at?: string | null;
  bounty_tx_id?: string | null;
  bounty_amount_sol?: number | null;
  rule_author_pubkey?: string | null;
}

export interface AlertProof {
  eligible?: boolean;
  attested?: boolean;
  tx_id?: string | null;
  solscan_url?: string | null;
  attested_at?: string | null;
  incident_hash?: string | null;
  manifest_hash?: string | null;
  tlp?: string | null;
  ioc_count?: number | null;
  ioc_types?: string[] | null;
  redacted_ioc_count?: number | null;
  confidence?: number | null;
  threat_class?: string | null;
  malware_family?: string | null;
  public_manifest?: Record<string, any> | null;
  bounty?: {
    tx_id?: string | null;
    amount_lamports?: number | null;
    amount_sol?: number | null;
    paid_at?: string | null;
  } | null;
}

export interface AlertFilter {
  severity?: string;
  source?: string;
  dismissed?: boolean;
  limit?: number;
  offset?: number;
}

export interface IncidentRecord {
  id: string;
  alert: Alert;
  timeline?: Array<Record<string, any>>;
  evidence?: Record<string, any>;
  process_chain?: Array<Record<string, any>>;
  detections?: Record<string, any>;
  contributing_events?: Array<Record<string, any>>;
  proof?: AlertProof | Record<string, any> | null;
  response?: Record<string, any>;
}

export interface ScanResult {
  scan_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  files_scanned: number;
  threats_found: number;
  findings: Finding[];
}

export interface Finding {
  file_path: string;
  threat_name: string;
  severity: string;
  detection_method: string;
  sha256: string;
}

export interface AgentConfig {
  server_url: string;
  performance_profile?: PerformanceProfile;
  collection_interval_ms: number;
  enabled_collectors: string[];
  yara_rules_path?: string;
  sigma_rules_path?: string;
  auto_quarantine: boolean;
  ml_detection_enabled: boolean;
  log_level: string;
}

export interface SystemMetrics {
  cpu_usage: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_available_mb: number;
  disk_usage: DiskMetric[];
  network_connections: number;
  active_processes: number;
}

export interface DiskMetric {
  mount_point: string;
  total_gb: number;
  used_gb: number;
  available_gb: number;
  usage_percent: number;
}

export interface GuiCapabilities {
  ipc_online: boolean;
  agent_authenticated: boolean;
  driver_available: boolean;
  backend_enrolled: boolean;
  quarantine_read_supported: boolean;
  quarantine_action_supported: boolean;
  network_isolation_supported: boolean;
  threat_intel_supported: boolean;
  mitre_coverage_supported: boolean;
  license_supported: boolean;
  scan_status_supported: boolean;
  alert_export_supported: boolean;
}

export interface LinuxCapabilityItem {
  id: string;
  name: string;
  category: string;
  status: string;
  detail: string;
}

export interface LinuxCapabilities {
  platform: string;
  supported: boolean;
  kernel_release: string | null;
  items: LinuxCapabilityItem[];
}

export interface PlatformCapabilityItem {
  id: string;
  name: string;
  category: string;
  windows: string;
  linux: string;
  macos: string;
  current: string;
  detail: string;
}

export interface PlatformCapabilities {
  platform: string;
  items: PlatformCapabilityItem[];
}

export interface AgentSetupStatus {
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
  next_action: string;
}

function unsupportedCapability(feature: string): Promise<never> {
  return Promise.reject(new Error(`${feature} is unavailable on this endpoint build.`));
}

// Hooks
export function useAgentStatus() {
  return useQuery<AgentStatus>({
    queryKey: ['status'],
    queryFn: () => invoke<AgentStatus>('get_status'),
    refetchInterval: 5000,
  });
}

export function useAgentSetupStatus() {
  return useQuery<AgentSetupStatus>({
    queryKey: ['agent-setup-status'],
    queryFn: () => invoke<AgentSetupStatus>('get_agent_setup_status'),
    refetchInterval: 5000,
  });
}

export function useAlerts(filter?: AlertFilter) {
  return useQuery<Alert[]>({
    queryKey: ['alerts', filter],
    queryFn: () => invoke<Alert[]>('get_alerts', { filter }),
    refetchInterval: 10000,
  });
}

export function useAlertCount(filter?: AlertFilter) {
  return useQuery<number>({
    queryKey: ['alert-count', filter],
    queryFn: () => invoke<number>('get_alert_count', { filter }),
    refetchInterval: 10000,
  });
}

export function useIncident(id?: string) {
  return useQuery<IncidentRecord>({
    queryKey: ['incident', id],
    queryFn: () => invoke<IncidentRecord>('get_incident', { id }),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: 10000,
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) =>
      invoke('acknowledge_alert', { alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useStartScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      path,
      recursive,
      scanType,
    }: {
      path: string;
      recursive: boolean;
      scanType: string;
    }) =>
      invoke<void>('start_scan', { path, recursive, scanArchives: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

export function useScanStatus(scanId: string | null) {
  return useQuery<ScanResult>({
    queryKey: ['scan', scanId],
    queryFn: () => unsupportedCapability('Scan status polling'),
    enabled: !!scanId,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 2000 : false,
  });
}

export function useCancelScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scanId: string) =>
      unsupportedCapability('Scan cancellation'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

export function useAgentConfig() {
  return useQuery<AgentConfig>({
    queryKey: ['config'],
    queryFn: () => invoke<AgentConfig>('get_config'),
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AgentConfig) =>
      invoke('update_config', { config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['performanceProfile'] });
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
    },
  });
}

export function useQuarantineFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) =>
      unsupportedCapability(`File quarantine for ${path}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useRestoreFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) =>
      unsupportedCapability(`File restore for ${path}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useKillProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pid: number) =>
      invoke('kill_process', { pid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useIsolateNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invoke('isolate_network'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
      queryClient.invalidateQueries({ queryKey: ['response-actions'] });
    },
  });
}

export function useRestoreNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invoke('restore_network'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
      queryClient.invalidateQueries({ queryKey: ['response-actions'] });
    },
  });
}

export function useBlockIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ip: string) => invoke('block_ip', { ip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
      queryClient.invalidateQueries({ queryKey: ['response-actions'] });
    },
  });
}

export function useUnblockIpAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ip: string) => invoke('unblock_ip', { ip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
      queryClient.invalidateQueries({ queryKey: ['response-actions'] });
    },
  });
}

export function useBlockNetworkDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domain: string) => invoke('block_domain', { domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
      queryClient.invalidateQueries({ queryKey: ['response-actions'] });
    },
  });
}

export function useUnblockNetworkDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domain: string) => invoke('unblock_domain', { domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkConnections'] });
      queryClient.invalidateQueries({ queryKey: ['response-actions'] });
    },
  });
}

export function useSystemMetrics() {
  return useQuery<SystemMetrics>({
    queryKey: ['metrics'],
    queryFn: () => invoke<SystemMetrics>('get_system_metrics'),
    refetchInterval: 5000,
  });
}

export function useExportAlerts() {
  return useMutation({
    mutationFn: ({
      format,
      filter,
    }: {
      format: string;
      filter?: AlertFilter;
    }) => unsupportedCapability(`Alert export (${format})`),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: () => invoke<boolean>('test_connection'),
  });
}

export function useGuiCapabilities() {
  return useQuery<GuiCapabilities>({
    queryKey: ['guiCapabilities'],
    queryFn: () => invoke<GuiCapabilities>('get_gui_capabilities'),
    refetchInterval: 5000,
  });
}

export function useLinuxCapabilities() {
  return useQuery<LinuxCapabilities>({
    queryKey: ['linuxCapabilities'],
    queryFn: () => invoke<LinuxCapabilities>('get_linux_capabilities'),
    refetchInterval: 15000,
  });
}

export function usePlatformCapabilities() {
  return useQuery<PlatformCapabilities>({
    queryKey: ['platformCapabilities'],
    queryFn: () => invoke<PlatformCapabilities>('get_platform_capabilities'),
    refetchInterval: 15000,
  });
}

// Real-time event listener
export function useEventListener<T>(
  event: string,
  callback: (payload: T) => void
) {
  useEffect(() => {
    const unlisten = listen<T>(event, (event) => {
      callback(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [event, callback]);
}

// Listen for new alerts
export function useAlertListener(
  callback: (alert: Alert) => void
) {
  useEventListener('new-alert', callback);
}

// Listen for status changes
export function useStatusListener(
  callback: (status: AgentStatus) => void
) {
  useEventListener('status-changed', callback);
}

// Listen for scan progress
export function useScanProgressListener(
  callback: (progress: {
    scan_id: string;
    files_scanned: number;
    total_files: number;
    percent_complete: number;
  }) => void
) {
  useEventListener('scan-progress', callback);
}

// ============================================================================
// Component Status Hooks
// ============================================================================

export interface ComponentStatus {
  driver: DriverStatus;
  collectors: CollectorStatus[];
  backend: BackendStatus;
  pressure_level: 'none' | 'light' | 'moderate' | 'heavy' | 'critical';
  health: HealthStatus;
  uptime_seconds: number;
}

export interface DriverStatus {
  loaded: boolean;
  version: string | null;
  /** Total events captured via driver. null until telemetry connects. */
  events_captured: number | null;
  last_event_at: string | null;
  error: string | null;
}

export interface CollectorStatus {
  name: string;
  running: boolean;
  events_per_second: number;
  total_events: number;
  errors: number;
  last_error: string | null;
  cpu_percent: number;
  memory_bytes: number;
}

export interface BackendStatus {
  connected: boolean;
  url: string;
  latency_ms: number | null;
  events_queued: number;
  events_sent: number;
  last_sync_at: string | null;
  error: string | null;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  last_check_at: string | null;
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  message: string | null;
}

export function useComponentStatus() {
  return useQuery<ComponentStatus>({
    queryKey: ['componentStatus'],
    queryFn: () => invoke<ComponentStatus>('get_component_status'),
    refetchInterval: 2000,
  });
}

export function useComponentStatusListener(
  callback: (status: ComponentStatus) => void
) {
  useEventListener('component-status-changed', callback);
}

// ============================================================================
// Performance Profile Hooks
// ============================================================================

export type PerformanceProfile = 'aggressive' | 'balanced' | 'lightweight';

export interface ProfileInfo {
  profile: PerformanceProfile;
  cpu_target: string;
  description: string;
  collectors_enabled: string[];
  features: string[];
}

export interface ProfileChangeResult {
  old_profile: string;
  new_profile: string;
  collectors_affected: string[];
}

export function usePerformanceProfile() {
  return useQuery<PerformanceProfile>({
    queryKey: ['performanceProfile'],
    queryFn: () => invoke<PerformanceProfile>('get_performance_profile'),
  });
}

export function usePerformanceProfilesInfo() {
  return useQuery<ProfileInfo[]>({
    queryKey: ['performanceProfilesInfo'],
    queryFn: () => invoke<ProfileInfo[]>('get_performance_profiles_info'),
    staleTime: Infinity, // Profile info is static
  });
}

export function useSetPerformanceProfile() {
  const queryClient = useQueryClient();

  return useMutation<ProfileChangeResult, Error, string>({
    mutationFn: async (profile: string) => {
      const result = await invoke<ProfileChangeResult>('set_performance_profile', { profile });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceProfile'] });
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
    },
  });
}

export function useProfileChangeListener(
  callback: (change: {
    old: PerformanceProfile;
    new: PerformanceProfile;
    collectors_affected: string[];
  }) => void
) {
  useEventListener('profile-changed', callback);
}

// ============================================================================
// Connection Status Hooks
// ============================================================================

export function useIsConnected() {
  return useQuery<boolean>({
    queryKey: ['isConnected'],
    queryFn: () => invoke<boolean>('is_connected'),
    refetchInterval: 5000,
  });
}

export function useIsAgentAuthenticated() {
  return useQuery<boolean>({
    queryKey: ['isAgentAuthenticated'],
    queryFn: () => invoke<boolean>('is_agent_authenticated'),
  });
}

// ============================================================================
// Tray Action Listener
// ============================================================================

export interface TrayAction {
  action: string;
  profile?: string;
}

export function useTrayActionListener(
  callback: (action: TrayAction) => void
) {
  useEventListener('tray-action', callback);
}

export function useNavigationListener(
  callback: (route: string) => void
) {
  useEventListener('navigate', callback);
}

// ============================================================================
// Update Hooks
// ============================================================================

export interface UpdateInfo {
  update_available: boolean;
  current_version: string;
  latest_version: string | null;
  release_notes: string | null;
  download_size: number | null;
}

export interface UpdateProgress {
  version: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
}

export function useCheckForUpdates() {
  return useMutation({
    mutationFn: () => invoke<UpdateInfo>('check_for_updates'),
  });
}

export function useDownloadUpdate() {
  return useMutation({
    mutationFn: () => invoke('download_update'),
  });
}

export function useInstallUpdate() {
  return useMutation({
    mutationFn: () => invoke('install_update'),
  });
}

export function useRestartApp() {
  return useMutation({
    mutationFn: () => invoke('restart_app'),
  });
}

export function useUpdateProgressListener(
  callback: (progress: UpdateProgress) => void
) {
  useEventListener('update-progress', callback);
}

export function useUpdateReadyListener(
  callback: (info: { version: string; requires_restart: boolean }) => void
) {
  useEventListener('update-ready', callback);
}

export function useUpdateErrorListener(
  callback: (error: { message: string; recoverable: boolean }) => void
) {
  useEventListener('update-error', callback);
}

export function useCurrentVersion() {
  return useQuery<string>({
    queryKey: ['currentVersion'],
    queryFn: () => invoke<string>('get_current_version'),
    staleTime: Infinity,
  });
}

// ============================================================================
// Driver Control Hooks
// ============================================================================

export interface DriverStatusInfo {
  loaded: boolean;
  connected: boolean;
  version: string | null;
  service_name: string;
  driver_path: string | null;
  usermode_fallback: boolean;
  consecutive_failures: number;
  /** Total events captured via driver. null until telemetry connects. */
  events_captured: number | null;
  last_communication: string | null;
  error: string | null;
  install_available: boolean;
}

export interface DriverOperationResult {
  operation: string;
  success: boolean;
  message: string | null;
}

export interface AgentStoppingInfo {
  reason: string;
  restart_scheduled: boolean;
}

export interface PrivilegeStatus {
  is_elevated: boolean;
  can_read_agent_token: boolean;
  platform: string;
  elevation_hint: string;
}

export function usePrivilegeStatus() {
  return useQuery<PrivilegeStatus>({
    queryKey: ['privilegeStatus'],
    queryFn: () => invoke<PrivilegeStatus>('get_privilege_status'),
    refetchInterval: 15000,
  });
}

export function useRelaunchAsAdministrator() {
  return useMutation<void, Error, { exitCurrent?: boolean } | undefined>({
    mutationFn: (options) =>
      invoke<void>('relaunch_as_administrator', {
        exitCurrent: options?.exitCurrent ?? true,
      }),
  });
}

export function useDriverStatus() {
  return useQuery<DriverStatusInfo>({
    queryKey: ['driverStatus'],
    queryFn: () => invoke<DriverStatusInfo>('get_driver_status'),
    refetchInterval: 10000,
  });
}

export function useLoadDriver() {
  const queryClient = useQueryClient();

  return useMutation<DriverOperationResult, Error>({
    mutationFn: () => invoke<DriverOperationResult>('load_driver'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverStatus'] });
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
    },
  });
}

export function useUnloadDriver() {
  const queryClient = useQueryClient();

  return useMutation<DriverOperationResult, Error>({
    mutationFn: () => invoke<DriverOperationResult>('unload_driver'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverStatus'] });
      queryClient.invalidateQueries({ queryKey: ['componentStatus'] });
    },
  });
}

export function useStopAgent() {
  return useMutation<AgentStoppingInfo, Error>({
    mutationFn: () => invoke<AgentStoppingInfo>('stop_agent'),
  });
}

export function useRestartAgent() {
  return useMutation<AgentStoppingInfo, Error>({
    mutationFn: () => invoke<AgentStoppingInfo>('restart_agent'),
  });
}
