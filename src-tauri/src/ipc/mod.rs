//! Unified IPC protocol between GUI and Agent
//!
//! This module provides secure IPC using the same protocol as the Agent:
//! - Windows: Named pipes with ACLs
//! - Linux/macOS: Unix domain sockets with filesystem permissions
//! - MessagePack serialization for efficiency
//! - Length-prefixed framing (4-byte LE + payload)
//! - Token-based authentication via shared secret

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub mod auth;
pub mod client;
mod protocol;

pub use client::IpcClient;
pub use protocol::MessageFrame;

/// Maximum message size (16 MB)
pub const MAX_MESSAGE_SIZE: usize = 16 * 1024 * 1024;

/// IPC pipe name for Windows
#[cfg(windows)]
pub const PIPE_NAME: &str = r"\\.\pipe\tamandua-agent";

/// IPC socket path for macOS
#[cfg(target_os = "macos")]
pub const SOCKET_PATH: &str = "/Library/Application Support/Tamandua/agent.sock";

/// IPC socket path for Linux
#[cfg(all(unix, not(target_os = "macos")))]
pub const SOCKET_PATH: &str = "/var/run/tamandua/agent.sock";

/// Messages exchanged between GUI and Agent service
///
/// Note: Using default (externally tagged) serialization for MessagePack compatibility.
/// Internally tagged enums (`#[serde(tag = "type")]`) don't work correctly with rmp_serde.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IpcMessage {
    // ==================== GUI -> Service: Read Operations ====================
    /// Request current agent status
    GetStatus,

    /// Request detailed agent metrics
    GetMetrics,

    /// Request recent alerts
    GetAlerts {
        since: Option<DateTime<Utc>>,
        limit: Option<usize>,
    },

    /// Request log entries
    GetLogs {
        since: Option<DateTime<Utc>>,
        level: Option<String>,
        limit: Option<usize>,
    },

    /// Request quarantined files list
    GetQuarantinedFiles,

    /// Request active network connections
    GetActiveConnections,

    /// Request process tree
    GetProcessTree,

    /// Request agent version info
    GetVersion,

    // ==================== NEW: Event History ====================
    /// Request telemetry events with filtering
    GetEvents {
        event_types: Option<Vec<String>>,
        severities: Option<Vec<String>>,
        search: Option<String>,
        date_from: Option<DateTime<Utc>>,
        date_to: Option<DateTime<Utc>>,
        limit: Option<usize>,
        offset: Option<usize>,
    },

    /// Request event statistics for dashboard
    GetEventStatistics {
        date_from: Option<DateTime<Utc>>,
        date_to: Option<DateTime<Utc>>,
    },

    /// Request single event by ID
    GetEvent { event_id: String },

    /// Request related events (same process, same host, etc.)
    GetRelatedEvents { event_id: String },

    // ==================== NEW: Component Status ====================
    /// Request comprehensive component status (driver, collectors, backend, health)
    GetComponentStatus,

    // ==================== NEW: Performance Profile ====================
    /// Request current performance profile
    GetPerformanceProfile,

    // ==================== GUI -> Service: Write Operations (require auth) ====================
    /// Authenticate with token hash (legacy - still supported for backwards compatibility)
    Authenticate { token_hash: String },

    /// Request authentication challenge (new challenge-response protocol)
    RequestChallenge,

    /// Respond to authentication challenge
    AuthenticateChallenge { response: ChallengeResponse },

    /// Start on-demand file/directory scan
    StartScan {
        path: PathBuf,
        recursive: bool,
        scan_archives: bool,
    },

    /// Cancel ongoing scan
    CancelScan { scan_id: String },

    /// Update agent configuration
    UpdateConfig { config: AgentConfigUpdate },

    /// Execute response action
    ExecuteAction { action: ResponseAction },

    /// Block an IP address locally.
    #[serde(rename = "block_ip")]
    BlockIp {
        ip: String,
        reason: Option<String>,
        direction: Option<String>,
    },

    /// Unblock an IP address locally.
    #[serde(rename = "unblock_ip")]
    UnblockIp {
        ip: String,
        reason: Option<String>,
        direction: Option<String>,
    },

    /// Block a domain locally.
    #[serde(rename = "block_domain")]
    BlockDomain {
        domain: String,
        reason: Option<String>,
    },

    /// Unblock a domain locally.
    #[serde(rename = "unblock_domain")]
    UnblockDomain {
        domain: String,
        reason: Option<String>,
    },

    /// List locally blocked IP addresses.
    #[serde(rename = "list_blocked_ips")]
    ListBlockedIps,

    /// List locally blocked domains.
    #[serde(rename = "list_blocked_domains")]
    ListBlockedDomains,

    /// Isolate the host network locally.
    #[serde(rename = "isolate_network")]
    IsolateNetwork { allowed_ips: Option<Vec<String>> },

    /// Restore the host network after isolation.
    #[serde(rename = "restore_network")]
    RestoreNetwork,

    /// Restore file from quarantine
    RestoreFile { quarantine_id: String },

    /// Delete quarantined file permanently
    DeleteQuarantinedFile { quarantine_id: String },

    /// Kill process
    KillProcess { pid: u32 },

    /// Test connection to backend
    TestBackendConnection,

    /// Trigger manual update check
    CheckForUpdates,

    /// Apply pending update
    ApplyUpdate,

    /// Acknowledge alert
    AcknowledgeAlert { alert_id: String },

    // ==================== NEW: Set Performance Profile (requires auth) ====================
    /// Set performance profile (Aggressive/Balanced/Lightweight)
    SetPerformanceProfile { profile: PerformanceProfile },

    // ==================== Driver Control (requires auth) ====================
    /// Load the kernel driver
    LoadDriver,

    /// Unload the kernel driver
    UnloadDriver,

    /// Get detailed driver status
    GetDriverStatus,

    // ==================== Agent Control (requires auth) ====================
    /// Request agent to gracefully stop
    StopAgent,

    /// Request agent to restart
    RestartAgent,

    // ==================== Service -> GUI: Responses ====================
    /// Agent status update
    StatusUpdate(AgentStatus),

    /// Metrics update
    MetricsUpdate(AgentMetrics),

    /// Scan progress notification
    ScanProgress {
        scan_id: String,
        path: PathBuf,
        progress: f32,
        files_scanned: u64,
        threats_found: u32,
    },

    /// Scan completed
    ScanComplete {
        scan_id: String,
        results: ScanResults,
    },

    /// New alert notification
    Alert(AlertNotification),

    /// Log entries response
    LogEntries(Vec<LogEntry>),

    /// Alerts response
    Alerts(Vec<AlertNotification>),

    /// Quarantined files response
    QuarantinedFiles(Vec<QuarantineEntry>),

    /// Active connections response
    ActiveConnections(Vec<NetworkConnection>),

    /// Process tree response
    ProcessTree(Vec<ProcessInfo>),

    // ==================== NEW: Event History Responses ====================
    /// Telemetry events response
    Events(Vec<TelemetryEvent>),

    /// Event statistics response
    EventStatisticsResponse(EventStatistics),

    /// Single event response
    Event(Option<TelemetryEvent>),

    /// Related events response
    RelatedEvents(Vec<TelemetryEvent>),

    /// Authentication challenge from server
    Challenge(AuthChallenge),

    /// Version info response
    VersionInfo(VersionInfo),

    /// Backend connection test result
    BackendTestResult {
        connected: bool,
        latency_ms: Option<u64>,
        error: Option<String>,
    },

    /// Update check result
    UpdateCheckResult {
        update_available: bool,
        current_version: String,
        latest_version: Option<String>,
        release_notes: Option<String>,
        download_size: Option<u64>,
    },

    /// Update download progress
    UpdateProgress {
        version: String,
        downloaded_bytes: u64,
        total_bytes: u64,
        percent: f32,
    },

    /// Update installation started
    UpdateInstalling { version: String },

    /// Update completed, restart required
    UpdateReady {
        version: String,
        requires_restart: bool,
    },

    /// Update failed
    UpdateError { message: String, recoverable: bool },

    // ==================== NEW: Component Status Response ====================
    /// Comprehensive component status
    ComponentStatusUpdate(ComponentStatus),

    // ==================== NEW: Profile Responses ====================
    /// Current performance profile
    PerformanceProfileResponse(PerformanceProfile),

    /// Profile change notification
    ProfileChanged {
        old: PerformanceProfile,
        new: PerformanceProfile,
        collectors_affected: Vec<String>,
    },

    /// Profile change error
    ProfileChangeError { reason: String },

    /// Available performance profiles with detailed info
    PerformanceProfilesInfo(Vec<ProfileInfo>),

    // ==================== Driver & Agent Control Responses ====================
    /// Detailed driver status response
    DriverStatusResponse(DriverStatusInfo),

    /// Driver operation result (load/unload)
    DriverOperationResult {
        operation: String,
        success: bool,
        message: Option<String>,
    },

    /// Agent stopping notification
    AgentStopping {
        reason: String,
        restart_scheduled: bool,
    },

    /// Response action execution result.
    ResponseCommandResult(ResponseCommandResult),

    // ==================== Generic Responses ====================
    /// Authentication successful
    Authenticated,

    /// Generic success response
    Success,

    /// Generic error response
    Error {
        message: String,
        code: Option<String>,
    },
}

// ==================== Authentication Types ====================

/// Challenge sent from server to client for authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthChallenge {
    /// Random nonce (32 bytes, hex-encoded)
    pub nonce: String,
    /// Unix timestamp when challenge was created
    pub timestamp: u64,
}

/// Response from client to server challenge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeResponse {
    /// The nonce from the challenge (echoed back)
    pub nonce: String,
    /// The timestamp from the challenge (echoed back)
    pub timestamp: u64,
    /// HMAC-SHA256(nonce || timestamp, token_secret), hex-encoded
    pub signature: String,
}

impl ChallengeResponse {
    /// Create a response to a challenge using the token secret
    pub fn create(challenge: &AuthChallenge, secret: &str) -> Self {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        type HmacSha256 = Hmac<Sha256>;

        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");

        // HMAC(nonce || timestamp, secret)
        mac.update(challenge.nonce.as_bytes());
        mac.update(&challenge.timestamp.to_le_bytes());

        let signature = hex::encode(mac.finalize().into_bytes());

        Self {
            nonce: challenge.nonce.clone(),
            timestamp: challenge.timestamp,
            signature,
        }
    }
}

// ==================== Data Types ====================

/// Agent status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub agent_id: String,
    pub version: String,
    pub state: AgentState,
    pub backend_connected: bool,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub collectors_running: Vec<String>,
    pub protection_enabled: bool,
    pub scan_in_progress: bool,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub uptime_seconds: u64,
}

/// Agent operational state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentState {
    Starting,
    Running,
    Degraded,
    Stopped,
    Error,
}

/// Agent performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    pub timestamp: DateTime<Utc>,
    pub events_processed: u64,
    pub events_per_second: f64,
    pub alerts_generated: u32,
    pub actions_executed: u32,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub network_bytes_sent: u64,
    pub network_bytes_received: u64,
    pub collector_metrics: Vec<CollectorMetrics>,
}

/// Per-collector metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectorMetrics {
    pub name: String,
    pub events_collected: u64,
    pub events_per_second: f64,
    pub errors: u32,
    pub cpu_percent: f32,
}

// ==================== NEW: Component Status Types ====================

/// Comprehensive component status for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentStatus {
    pub driver: DriverStatus,
    pub collectors: Vec<CollectorStatus>,
    pub backend: BackendStatus,
    pub pressure_level: PressureLevel,
    pub health: HealthStatus,
    pub uptime_seconds: u64,
}

/// Driver/kernel module status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverStatus {
    pub loaded: bool,
    pub version: Option<String>,
    /// Total events captured via driver. None if telemetry not wired to IPC.
    pub events_captured: Option<u64>,
    pub last_event_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Individual collector status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectorStatus {
    pub name: String,
    pub running: bool,
    pub events_per_second: f64,
    pub total_events: u64,
    pub errors: u32,
    pub last_error: Option<String>,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
}

/// Backend connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendStatus {
    pub connected: bool,
    pub url: String,
    pub latency_ms: Option<u64>,
    pub events_queued: u64,
    pub events_sent: u64,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Resource pressure level from governor
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PressureLevel {
    None,
    Light,
    Moderate,
    Heavy,
    Critical,
}

impl PressureLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            PressureLevel::None => "none",
            PressureLevel::Light => "light",
            PressureLevel::Moderate => "moderate",
            PressureLevel::Heavy => "heavy",
            PressureLevel::Critical => "critical",
        }
    }

    pub fn multiplier(&self) -> f32 {
        match self {
            PressureLevel::None => 1.0,
            PressureLevel::Light => 2.0,
            PressureLevel::Moderate => 4.0,
            PressureLevel::Heavy => 8.0,
            PressureLevel::Critical => 16.0,
        }
    }
}

/// Health check status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: HealthState,
    pub checks: Vec<HealthCheck>,
    pub last_check_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthState {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub name: String,
    pub passed: bool,
    pub message: Option<String>,
}

/// Result returned by local response commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseCommandResult {
    pub success: bool,
    pub error: Option<String>,
    pub result_data: Option<serde_json::Value>,
}

// ==================== Driver Control Types ====================

/// Detailed driver status information for GUI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverStatusInfo {
    /// Whether the driver is currently loaded (minifilter port accessible)
    pub loaded: bool,
    /// Whether an active communication channel exists with the driver.
    /// Note: The IPC server does not hold a DriverConnection; this reflects
    /// whether the server can verify active telemetry flow (currently false).
    pub connected: bool,
    /// Driver version string
    pub version: Option<String>,
    /// Service name in Windows SCM
    pub service_name: String,
    /// Path to the driver .sys file
    pub driver_path: Option<String>,
    /// Whether the agent is in usermode fallback mode (driver unavailable).
    /// Note: Cannot be determined from IPC server context - requires DriverIntegration state.
    pub usermode_fallback: bool,
    /// Consecutive communication failures.
    /// Note: Cannot be determined from IPC server context - requires DriverIntegration state.
    pub consecutive_failures: u32,
    /// Total events captured via driver. None if telemetry stats not wired to IPC.
    pub events_captured: Option<u64>,
    /// Last successful communication timestamp. None if not tracked or not wired.
    pub last_communication: Option<DateTime<Utc>>,
    /// Current error message if any
    pub error: Option<String>,
    /// Whether driver installation is available (embedded driver present)
    pub install_available: bool,
}

// ==================== Performance Profile ====================

/// Performance profile presets
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PerformanceProfile {
    /// Maximum detection coverage (15-25% CPU)
    Aggressive,
    /// Balanced detection and performance (5-10% CPU)
    Balanced,
    /// Minimal footprint (1-3% CPU)
    Lightweight,
}

impl PerformanceProfile {
    pub fn as_str(&self) -> &'static str {
        match self {
            PerformanceProfile::Aggressive => "aggressive",
            PerformanceProfile::Balanced => "balanced",
            PerformanceProfile::Lightweight => "lightweight",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            PerformanceProfile::Aggressive => "Maximum detection coverage. All collectors enabled with tight intervals. Higher CPU/memory usage (~15-25%).",
            PerformanceProfile::Balanced => "Good detection with reasonable resource usage (~5-10% CPU). Suitable for most workstations.",
            PerformanceProfile::Lightweight => "Minimal footprint (~1-3% CPU). Only core collectors active. Best for performance-sensitive systems.",
        }
    }

    pub fn cpu_target(&self) -> (f32, f32) {
        match self {
            PerformanceProfile::Aggressive => (15.0, 25.0),
            PerformanceProfile::Balanced => (5.0, 10.0),
            PerformanceProfile::Lightweight => (1.0, 3.0),
        }
    }

    pub fn cpu_target_str(&self) -> &'static str {
        match self {
            PerformanceProfile::Aggressive => "15-25%",
            PerformanceProfile::Balanced => "5-10%",
            PerformanceProfile::Lightweight => "1-3%",
        }
    }

    /// Get the list of collectors enabled for this profile
    pub fn enabled_collectors(&self) -> Vec<&'static str> {
        match self {
            PerformanceProfile::Aggressive => vec![
                "process",
                "file",
                "network",
                "dns",
                "registry",
                "usb",
                "ransomware_canary",
                "health",
                "etw",
                "persistence",
                "fim",
            ],
            PerformanceProfile::Balanced => vec![
                "process",
                "file",
                "network",
                "dns",
                "registry",
                "usb",
                "ransomware_canary",
                "health",
                "persistence",
                "fim",
                "etw",
            ],
            PerformanceProfile::Lightweight => vec![
                "process",
                "file",
                "network",
                "dns",
                "registry",
                "usb",
                "ransomware_canary",
                "health",
            ],
        }
    }

    /// Get profile features description
    pub fn features(&self) -> Vec<&'static str> {
        match self {
            PerformanceProfile::Aggressive => vec![
                "All collectors active",
                "Tight polling intervals (3s process, 1s DNS)",
                "Full memory scanning",
                "Deep network inspection",
                "Real-time ML analysis",
                "Full scan features enabled",
            ],
            PerformanceProfile::Balanced => vec![
                "Core collectors active",
                "Balanced intervals (5s process, 2s DNS)",
                "Standard scanning",
                "Basic network monitoring",
                "Periodic ML checks",
                "Skip expensive analysis",
            ],
            PerformanceProfile::Lightweight => vec![
                "Essential collectors only",
                "Relaxed intervals (15s process, 5s DNS)",
                "On-demand scanning",
                "Minimal network capture",
                "Event-triggered ML",
                "Offline detection disabled",
            ],
        }
    }
}

/// Detailed information about a performance profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInfo {
    pub profile: PerformanceProfile,
    pub cpu_target: String,
    pub description: String,
    pub collectors_enabled: Vec<String>,
    pub features: Vec<String>,
}

// ==================== Alert Types ====================

/// Alert notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertNotification {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub severity: AlertSeverity,
    pub title: String,
    pub description: String,
    pub threat_name: Option<String>,
    pub process_name: Option<String>,
    pub process_id: Option<u32>,
    pub file_path: Option<PathBuf>,
    pub mitre_tactics: Vec<String>,
    pub remediation: Option<String>,
    pub acknowledged: bool,
}

/// Alert severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum AlertSeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

/// Log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    #[serde(default)]
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub message: String,
    pub module: Option<String>,
    pub fields: std::collections::HashMap<String, String>,
}

/// Scan results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResults {
    pub scan_id: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub files_scanned: u64,
    pub threats_found: u32,
    pub threats: Vec<ThreatDetection>,
    pub errors: Vec<String>,
}

/// Threat detection details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatDetection {
    pub file_path: PathBuf,
    pub threat_name: String,
    pub severity: AlertSeverity,
    pub detection_method: String,
    pub action_taken: String,
}

/// Quarantine entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineEntry {
    pub id: String,
    pub original_path: PathBuf,
    pub quarantined_at: DateTime<Utc>,
    pub threat_name: String,
    pub file_size: u64,
    pub file_hash: String,
}

/// Network connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub protocol: String,
    pub local_addr: String,
    pub local_port: u16,
    pub remote_addr: String,
    pub remote_port: u16,
    pub state: String,
    pub pid: u32,
    pub process_name: String,
}

/// Process information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
    pub path: PathBuf,
    pub command_line: String,
    pub user: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub started_at: DateTime<Utc>,
    pub children: Vec<ProcessInfo>,
}

/// Version information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub build_date: String,
    pub commit_hash: String,
    pub rust_version: String,
}

// ==================== Event History Types ====================

/// Telemetry event for event history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub id: String,
    pub event_type: String,
    pub severity: String,
    pub timestamp: DateTime<Utc>,
    pub message: String,
    pub agent_id: String,
    pub hostname: String,
    // Process fields
    pub process_name: Option<String>,
    pub process_id: Option<u32>,
    pub parent_process_id: Option<u32>,
    pub command_line: Option<String>,
    pub exe_path: Option<String>,
    pub user: Option<String>,
    // File fields
    pub file_path: Option<String>,
    pub file_action: Option<String>,
    pub file_hash: Option<String>,
    // Network fields
    pub remote_ip: Option<String>,
    pub remote_port: Option<u16>,
    pub local_port: Option<u16>,
    pub protocol: Option<String>,
    pub direction: Option<String>,
    // Registry fields (Windows)
    pub registry_key: Option<String>,
    pub registry_value: Option<String>,
    pub registry_action: Option<String>,
    // Alert fields
    pub alert_source: Option<String>,
    pub alert_severity: Option<String>,
    pub rule_name: Option<String>,
    pub mitre_tactics: Option<Vec<String>>,
    // Raw data
    pub raw_data: Option<serde_json::Value>,
}

/// Event statistics for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventStatistics {
    pub events_per_hour: Vec<HourlyCount>,
    pub event_type_distribution: Vec<TypeCount>,
    pub top_processes: Vec<ProcessCount>,
    pub total_events: u64,
    pub time_range_hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyCount {
    pub hour: DateTime<Utc>,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeCount {
    pub event_type: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessCount {
    pub process_name: String,
    pub count: u64,
}

/// Agent configuration update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfigUpdate {
    pub scan_interval_seconds: Option<u64>,
    pub heartbeat_interval_seconds: Option<u64>,
    pub enable_real_time_protection: Option<bool>,
    pub enable_cloud_lookup: Option<bool>,
    pub excluded_paths: Option<Vec<PathBuf>>,
    pub excluded_processes: Option<Vec<String>>,
}

/// Response action to execute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseAction {
    KillProcess { pid: u32 },
    QuarantineFile { path: PathBuf },
    IsolateHost,
    RestoreHost,
    BlockIp { ip: String },
    UnblockIp { ip: String },
}

impl IpcMessage {
    /// Check if this message requires authentication
    pub fn requires_auth(&self) -> bool {
        match self {
            // Read-only operations don't require auth
            IpcMessage::GetStatus
            | IpcMessage::GetMetrics
            | IpcMessage::GetAlerts { .. }
            | IpcMessage::GetLogs { .. }
            | IpcMessage::GetQuarantinedFiles
            | IpcMessage::GetActiveConnections
            | IpcMessage::GetProcessTree
            | IpcMessage::GetVersion
            | IpcMessage::GetComponentStatus
            | IpcMessage::GetPerformanceProfile
            | IpcMessage::GetEvents { .. }
            | IpcMessage::GetEventStatistics { .. }
            | IpcMessage::GetEvent { .. }
            | IpcMessage::GetRelatedEvents { .. }
            | IpcMessage::Authenticate { .. } => false,

            // Write operations require auth
            _ => !self.is_response(),
        }
    }

    /// Check if this is a response message
    pub fn is_response(&self) -> bool {
        matches!(
            self,
            IpcMessage::StatusUpdate(_)
                | IpcMessage::MetricsUpdate(_)
                | IpcMessage::ScanProgress { .. }
                | IpcMessage::ScanComplete { .. }
                | IpcMessage::Alert(_)
                | IpcMessage::LogEntries(_)
                | IpcMessage::Alerts(_)
                | IpcMessage::QuarantinedFiles(_)
                | IpcMessage::ActiveConnections(_)
                | IpcMessage::ProcessTree(_)
                | IpcMessage::Events(_)
                | IpcMessage::EventStatisticsResponse(_)
                | IpcMessage::Event(_)
                | IpcMessage::RelatedEvents(_)
                | IpcMessage::VersionInfo(_)
                | IpcMessage::BackendTestResult { .. }
                | IpcMessage::UpdateCheckResult { .. }
                | IpcMessage::UpdateProgress { .. }
                | IpcMessage::UpdateInstalling { .. }
                | IpcMessage::UpdateReady { .. }
                | IpcMessage::UpdateError { .. }
                | IpcMessage::ComponentStatusUpdate(_)
                | IpcMessage::PerformanceProfileResponse(_)
                | IpcMessage::ProfileChanged { .. }
                | IpcMessage::ProfileChangeError { .. }
                | IpcMessage::PerformanceProfilesInfo(_)
                | IpcMessage::ResponseCommandResult(_)
                | IpcMessage::Authenticated
                | IpcMessage::Success
                | IpcMessage::Error { .. }
        )
    }
}
