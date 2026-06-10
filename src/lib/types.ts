// Additional shared types for the GUI

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications_enabled: boolean;
  auto_update_enabled: boolean;
  minimize_to_tray: boolean;
  start_on_boot: boolean;
}

export interface QuarantineItem {
  id: string;
  original_path: string;
  quarantine_path: string;
  quarantined_at: Date;
  sha256: string;
  reason: string;
  can_restore: boolean;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  exe_path: string;
  command_line: string;
  user: string;
  is_elevated: boolean;
  parent_pid?: number;
  cpu_usage: number;
  memory_mb: number;
  threads: number;
  handles: number;
  started_at: Date;
}

export interface NetworkConnection {
  protocol: 'tcp' | 'udp';
  local_addr: string;
  local_port: number;
  remote_addr?: string;
  remote_port?: number;
  state: string;
  pid: number;
  process_name: string;
}

export interface FileHash {
  path: string;
  md5: string;
  sha1: string;
  sha256: string;
  size_bytes: number;
}

export interface ThreatIntelligence {
  indicator: string;
  indicator_type: 'hash' | 'ip' | 'domain' | 'url';
  threat_type: string;
  severity: string;
  confidence: number;
  source: string;
  last_seen: Date;
}
