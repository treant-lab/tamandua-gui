// Core types that match tamandua-core Rust types
// These must be kept in sync with the Rust definitions

export interface AgentStatus {
  agent_id: string;
  status: AgentState;
  version: string;
  hostname: string;
  platform: string;
  uptime_seconds: number;
  connected: boolean;
  last_heartbeat: string;
  collectors_running: string[];
  cpu_usage: number;
  memory_usage_mb: number;
}

export type AgentState = 'running' | 'paused' | 'stopped' | 'error';

export interface Alert {
  id: string;
  agent_id: string;
  severity: Severity;
  title: string;
  description: string;
  created_at: string;
  source: AlertSource;
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

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertSource = 'yara' | 'sigma' | 'ml' | 'behavioral';

export interface AlertFilter {
  severity?: Severity;
  source?: AlertSource;
  dismissed?: boolean;
  limit?: number;
  offset?: number;
}

export interface ScanRequest {
  path: string;
  recursive: boolean;
  scan_type: ScanType;
}

export type ScanType = 'quick' | 'full' | 'custom';

export interface ScanResult {
  scan_id: string;
  status: ScanStatus;
  started_at: string;
  completed_at?: string;
  files_scanned: number;
  threats_found: number;
  findings: Finding[];
}

export type ScanStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface Finding {
  file_path: string;
  threat_name: string;
  severity: Severity;
  detection_method: string;
  sha256: string;
}

export interface AgentConfig {
  server_url: string;
  collection_interval_ms: number;
  enabled_collectors: string[];
  yara_rules_path?: string;
  sigma_rules_path?: string;
  auto_quarantine: boolean;
  ml_detection_enabled: boolean;
  log_level: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  timestamp: string;
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

export type EventNotification =
  | { type: 'NewAlert'; payload: Alert }
  | { type: 'StatusChanged'; payload: AgentStatus }
  | { type: 'ScanProgress'; payload: ScanProgress }
  | { type: 'ConfigUpdated' }
  | { type: 'ConnectionLost' }
  | { type: 'ConnectionRestored' };

export interface ScanProgress {
  scan_id: string;
  files_scanned: number;
  total_files: number;
  percent_complete: number;
}

// ============================================================================
// Schedule Types
// ============================================================================

export interface ScheduledScan {
  id: string;
  name: string;
  scan_type: ScanType;
  frequency: ScheduleFrequency;
  frequency_display: string;
  next_run: string | null;
  last_run: string | null;
  enabled: boolean;
  status: ScheduleStatus;
  paths: string[];
  options: ScanOptions;
  detection_action: DetectionAction;
  created_at: string;
  updated_at: string;
}

export type ScheduleFrequency =
  | { type: 'once'; datetime: string }
  | { type: 'daily'; time: string }
  | { type: 'weekly'; days: string[]; time: string }
  | { type: 'monthly'; day: number; time: string }
  | { type: 'cron'; expression: string };

export type ScheduleStatus = 'enabled' | 'disabled' | 'running' | 'completed' | 'failed';

export interface ScanOptions {
  scan_archives: boolean;
  follow_symlinks: boolean;
  cpu_priority: 'low' | 'normal' | 'high';
  skip_if_on_battery: boolean;
  wake_to_scan: boolean;
}

export type DetectionAction =
  | { type: 'alert' }
  | { type: 'quarantine' }
  | { type: 'custom'; action_name: string; params: Record<string, unknown> };

export interface ScheduleRunHistory {
  id: string;
  schedule_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  files_scanned: number;
  threats_found: number;
  duration_ms: number | null;
  error_message: string | null;
}

export interface ScheduleRunningStatus {
  schedule_id: string;
  started_at: string;
  files_scanned: number;
  total_files: number;
  progress_percent: number;
  threats_found: number;
  current_path: string;
}
