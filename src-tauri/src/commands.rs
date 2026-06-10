use chrono::{DateTime, Timelike, Utc};
use rusqlite::{Connection, OpenFlags};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::{command, AppHandle};

use crate::auth::{
    AuditEvent, AuthConfig, BiometricCapability, PasswordStrength, Session, SessionStatus,
    SetupStatus,
};
use crate::ipc::{
    AgentConfigUpdate, AgentMetrics, AgentStatus, AlertNotification, ComponentStatus,
    EventStatistics, LogEntry, PerformanceProfile, ProfileInfo, QuarantineEntry,
    ResponseCommandResult, TelemetryEvent,
};
use crate::state::AppState;

// ============================================================================
// Privilege Commands
// ============================================================================

/// Current desktop process privilege state.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PrivilegeStatus {
    pub is_elevated: bool,
    pub can_read_agent_token: bool,
    pub platform: String,
    pub elevation_hint: String,
}

/// Return whether the GUI process is elevated and can read the protected agent
/// IPC token. Reading the token is the practical gate for privileged agent
/// management actions.
#[command]
pub async fn get_privilege_status() -> Result<PrivilegeStatus, String> {
    let is_elevated = is_current_process_elevated();
    let can_read_agent_token = crate::ipc::auth::can_read_token().await;

    Ok(PrivilegeStatus {
        is_elevated,
        can_read_agent_token,
        platform: std::env::consts::OS.to_string(),
        elevation_hint: elevation_hint().to_string(),
    })
}

/// Relaunch the GUI with administrator/root privileges.
///
/// On Windows this triggers UAC through ShellExecute/PowerShell `runas`.
/// On Linux/macOS there is no universal desktop UAC equivalent, so we return a
/// clear error and let the frontend show the platform-specific hint.
#[command]
pub async fn relaunch_as_administrator(
    app: AppHandle,
    exit_current: Option<bool>,
) -> Result<(), String> {
    relaunch_current_process_elevated()?;

    if exit_current.unwrap_or(true) {
        app.exit(0);
    }

    Ok(())
}

fn elevation_hint() -> &'static str {
    #[cfg(windows)]
    {
        "Restart Tamandua EDR as Administrator to manage the agent service, driver, and protected IPC actions."
    }

    #[cfg(target_os = "macos")]
    {
        "macOS keeps the desktop app unprivileged. Tamandua will use the macOS administrator prompt only when installing or starting the LaunchDaemon."
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        "Restart Tamandua EDR with sudo/root privileges for privileged agent management actions."
    }
}

#[cfg(windows)]
fn is_current_process_elevated() -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = windows::Win32::Foundation::HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut len = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut len,
        )
        .is_ok();

        let _ = CloseHandle(token);
        ok && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
fn is_current_process_elevated() -> bool {
    unsafe extern "C" {
        fn geteuid() -> u32;
    }

    unsafe { geteuid() == 0 }
}

#[cfg(windows)]
fn relaunch_current_process_elevated() -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to resolve current executable: {}", e))?;

    let args: Vec<String> = std::env::args().skip(1).collect();
    let escaped_exe = powershell_single_quote(&exe.to_string_lossy());
    let escaped_args = if args.is_empty() {
        String::new()
    } else {
        let joined = args
            .iter()
            .map(|arg| powershell_single_quote(arg))
            .collect::<Vec<_>>()
            .join(",");
        format!(" -ArgumentList @({})", joined)
    };

    let script = format!(
        "Start-Process -FilePath {}{} -Verb RunAs",
        escaped_exe, escaped_args
    );

    let status = hidden_command("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .status()
        .map_err(|e| format!("Failed to request UAC elevation: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "UAC elevation request failed or was cancelled (exit code: {:?})",
            status.code()
        ))
    }
}

#[cfg(windows)]
fn powershell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(windows)]
fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut command = std::process::Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(windows))]
fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    std::process::Command::new(program)
}

#[cfg(not(windows))]
fn relaunch_current_process_elevated() -> Result<(), String> {
    Err(elevation_hint().to_string())
}

// ============================================================================
// Agent Status Commands
// ============================================================================

/// Get current agent status
#[command]
pub async fn get_status(state: tauri::State<'_, AppState>) -> Result<AgentStatus, String> {
    state.get_status().await
}

/// Get agent metrics
#[command]
pub async fn get_metrics(state: tauri::State<'_, AppState>) -> Result<AgentMetrics, String> {
    state.get_metrics().await
}

/// System metrics for resource monitoring
#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemMetrics {
    pub cpu_usage: f64,
    pub memory_total_mb: f64,
    pub memory_used_mb: f64,
    pub memory_available_mb: f64,
    pub disk_usage: Vec<DiskMetric>,
    pub network_connections: u32,
    pub active_processes: u32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GuiCapabilities {
    pub ipc_online: bool,
    pub agent_authenticated: bool,
    pub driver_available: bool,
    pub backend_enrolled: bool,
    pub quarantine_read_supported: bool,
    pub quarantine_action_supported: bool,
    pub network_isolation_supported: bool,
    pub threat_intel_supported: bool,
    pub mitre_coverage_supported: bool,
    pub license_supported: bool,
    pub scan_status_supported: bool,
    pub alert_export_supported: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LinuxCapabilityItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LinuxCapabilities {
    pub platform: String,
    pub supported: bool,
    pub kernel_release: Option<String>,
    pub items: Vec<LinuxCapabilityItem>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PlatformCapabilityItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub windows: String,
    pub linux: String,
    pub macos: String,
    pub current: String,
    pub detail: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PlatformCapabilities {
    pub platform: String,
    pub items: Vec<PlatformCapabilityItem>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiskMetric {
    pub mount_point: String,
    pub total_gb: f64,
    pub used_gb: f64,
    pub available_gb: f64,
    pub usage_percent: f64,
}

/// Get real-time system metrics (CPU, memory, disk)
#[command]
pub async fn get_system_metrics() -> Result<SystemMetrics, String> {
    use sysinfo::{Disks, System};

    let mut sys = System::new();

    // sysinfo needs two CPU refreshes separated by a short interval. A fresh
    // System sampled once reports 0.0% on many hosts.
    sys.refresh_cpu_usage();
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, false);

    let cpu_usage = sys.global_cpu_usage() as f64;

    // Memory
    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_available = memory_total.saturating_sub(memory_used);

    // Disk usage
    let disks = Disks::new_with_refreshed_list();
    let disk_usage: Vec<DiskMetric> = disks
        .iter()
        .map(|disk| {
            let total = disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            let used =
                (disk.total_space() - disk.available_space()) as f64 / (1024.0 * 1024.0 * 1024.0);
            let available = disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            let usage_percent = if total > 0.0 {
                (used / total) * 100.0
            } else {
                0.0
            };

            DiskMetric {
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_gb: total,
                used_gb: used,
                available_gb: available,
                usage_percent,
            }
        })
        .collect();

    // Process count
    let active_processes = sys.processes().len() as u32;

    Ok(SystemMetrics {
        cpu_usage,
        memory_total_mb: memory_total as f64 / (1024.0 * 1024.0),
        memory_used_mb: memory_used as f64 / (1024.0 * 1024.0),
        memory_available_mb: memory_available as f64 / (1024.0 * 1024.0),
        disk_usage,
        network_connections: 0, // Would need additional crate for network connections
        active_processes,
    })
}

/// Get component status (driver, collectors, backend, health)
#[command]
pub async fn get_component_status(
    state: tauri::State<'_, AppState>,
) -> Result<ComponentStatus, String> {
    state.get_component_status().await
}

/// Check if connected to agent
#[command]
pub async fn is_connected(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(state.is_connected().await)
}

/// Check if authenticated with agent
#[command]
pub async fn is_agent_authenticated(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    Ok(state.is_authenticated().await)
}

#[command]
pub async fn get_gui_capabilities(
    state: tauri::State<'_, AppState>,
) -> Result<GuiCapabilities, String> {
    let ipc_online = state.is_connected().await;
    let agent_authenticated = state.is_authenticated().await;

    let (backend_enrolled, driver_available) = match state.get_component_status().await {
        Ok(component) => (component.backend.connected, component.driver.loaded),
        Err(_) => (false, false),
    };

    Ok(GuiCapabilities {
        ipc_online,
        agent_authenticated,
        driver_available,
        backend_enrolled,
        quarantine_read_supported: ipc_online && agent_authenticated,
        quarantine_action_supported: false,
        network_isolation_supported: cfg!(any(
            target_os = "windows",
            target_os = "linux",
            target_os = "macos"
        )),
        threat_intel_supported: false,
        mitre_coverage_supported: false,
        license_supported: false,
        scan_status_supported: false,
        alert_export_supported: false,
    })
}

#[command]
pub async fn get_linux_capabilities() -> Result<LinuxCapabilities, String> {
    Ok(resolve_linux_capabilities())
}

#[command]
pub async fn get_platform_capabilities() -> Result<PlatformCapabilities, String> {
    Ok(resolve_platform_capabilities())
}

fn resolve_platform_capabilities() -> PlatformCapabilities {
    let platform = std::env::consts::OS.to_string();
    let mut items = vec![
        platform_capability(
            "agent_lifecycle",
            "Agent lifecycle",
            "setup",
            "supported",
            "supported",
            "supported",
            "Windows uses SCM; Linux uses systemd; macOS uses launchd LaunchDaemon. GUI fallback is complete on Windows/macOS and should be wired for Linux systemd.",
        ),
        platform_capability(
            "privileged_gui",
            "Privileged desktop app",
            "setup",
            "supported",
            "degraded",
            "not_applicable",
            "Windows can relaunch through UAC. Linux should move to polkit/service-mediated actions. macOS keeps the GUI unprivileged and delegates setup/start to OS authorization.",
        ),
        platform_capability(
            "kernel_driver",
            "Kernel driver",
            "telemetry",
            "supported",
            "not_applicable",
            "not_applicable",
            "Windows minifilter driver only. Linux/macOS should not show driver controls.",
        ),
        platform_capability(
            "endpoint_security",
            "Endpoint Security telemetry",
            "telemetry",
            "not_applicable",
            "not_applicable",
            if cfg!(target_os = "macos") {
                "stubbed"
            } else {
                "planned"
            },
            "macOS requires EndpointSecurity.framework, entitlement, signing/notarization, and System Extension/TCC flows. Current local build reported a stub collector.",
        ),
        platform_capability(
            "network_isolation",
            "Network isolation",
            "response",
            "supported",
            "supported",
            "supported",
            "Windows targets WFP, Linux nftables/iptables, macOS pfctl. GUI must show backend and command result per platform.",
        ),
        platform_capability(
            "app_control",
            "Application control",
            "response",
            "supported",
            "partial",
            "planned",
            "Windows has the strongest path. Linux depends on AppArmor/SELinux availability. macOS needs a System Extension/ES-backed policy path.",
        ),
        platform_capability(
            "quarantine",
            "Quarantine",
            "response",
            "supported",
            "supported",
            "supported",
            "Runtime success still depends on agent IPC auth, file permissions, and quarantine manager initialization.",
        ),
        platform_capability(
            "threat_intel",
            "Threat intelligence",
            "content",
            "partial",
            "partial",
            "partial",
            "IOC/YARA/Sigma paths exist, but the GUI needs source health, feed version, parse errors, and active indicator counts before claiming full coverage.",
        ),
        platform_capability(
            "container_security",
            "Container security",
            "telemetry",
            "not_applicable",
            "partial",
            "not_applicable",
            "Linux collector exists but is profile/config/prerequisite dependent. GUI must show disabled_by_profile vs unavailable vs running.",
        ),
        platform_capability(
            "ebpf",
            "eBPF/auditd telemetry",
            "telemetry",
            "not_applicable",
            "partial",
            "not_applicable",
            "Linux eBPF is feature/kernel/privilege dependent; auditd code exists but must be wired and validated before product claims.",
        ),
        platform_capability(
            "signing_distribution",
            "Signing and distribution",
            "distribution",
            "partial",
            "partial",
            "partial",
            "Scripts exist, but production needs Authenticode, Linux package/signature flow, and macOS Developer ID/hardened runtime/notarization.",
        ),
    ];

    for item in &mut items {
        item.current = match platform.as_str() {
            "windows" => item.windows.clone(),
            "linux" => item.linux.clone(),
            "macos" => item.macos.clone(),
            _ => "unsupported_on_platform".to_string(),
        };
    }

    PlatformCapabilities { platform, items }
}

fn platform_capability(
    id: &str,
    name: &str,
    category: &str,
    windows: &str,
    linux: &str,
    macos: &str,
    detail: &str,
) -> PlatformCapabilityItem {
    PlatformCapabilityItem {
        id: id.to_string(),
        name: name.to_string(),
        category: category.to_string(),
        windows: windows.to_string(),
        linux: linux.to_string(),
        macos: macos.to_string(),
        current: String::new(),
        detail: detail.to_string(),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn resolve_linux_capabilities() -> LinuxCapabilities {
    let mut items = Vec::new();
    let is_root = is_current_process_elevated();

    items.push(capability_item(
        "root",
        "Root privileges",
        "host",
        if is_root { "running" } else { "unavailable_on_host" },
        if is_root {
            "GUI process is running as root."
        } else {
            "GUI process is not root; privileged response actions require the agent/service context."
        },
    ));

    items.push(command_capability(
        "systemd",
        "systemd",
        "host",
        &["systemctl"],
        "systemctl is available.",
        "systemctl was not found on PATH.",
    ));
    items.push(command_capability(
        "nftables",
        "nftables",
        "response",
        &["nft"],
        "nft command is available for nftables-backed containment.",
        "nft command was not found on PATH.",
    ));
    items.push(command_capability(
        "iptables",
        "iptables",
        "response",
        &["iptables"],
        "iptables command is available as firewall fallback.",
        "iptables command was not found on PATH.",
    ));
    items.push(command_capability(
        "apparmor",
        "AppArmor",
        "response",
        &["aa-status"],
        "aa-status is available for AppArmor status checks.",
        "aa-status was not found on PATH.",
    ));
    items.push(command_capability(
        "selinux",
        "SELinux",
        "response",
        &["sestatus"],
        "sestatus is available for SELinux status checks.",
        "sestatus was not found on PATH.",
    ));
    items.push(command_capability(
        "auditd",
        "auditd",
        "collector",
        &["auditctl"],
        "auditctl is available; runtime wiring still must be reported by agent collector status.",
        "auditctl was not found on PATH.",
    ));

    let container_runtime = ["docker", "containerd", "ctr", "crictl", "podman"]
        .iter()
        .find(|command| command_exists(command))
        .copied();
    items.push(capability_item(
        "container_runtime",
        "Container runtime",
        "collector",
        if container_runtime.is_some() {
            "available_on_host"
        } else {
            "unavailable_on_host"
        },
        container_runtime
            .map(|runtime| {
                format!(
                    "{runtime} is available on PATH; collector state still depends on agent profile/config."
                )
            })
            .unwrap_or_else(|| "No supported container runtime command was found on PATH.".to_string()),
    ));

    let btf_available = std::path::Path::new("/sys/kernel/btf/vmlinux").exists();
    items.push(capability_item(
        "btf",
        "Kernel BTF",
        "collector",
        if btf_available {
            "available_on_host"
        } else {
            "unavailable_on_host"
        },
        if btf_available {
            "Kernel BTF is present; eBPF still requires a binary compiled with the eBPF feature and successful hook attach.".to_string()
        } else {
            "Kernel BTF was not found at /sys/kernel/btf/vmlinux.".to_string()
        },
    ));

    LinuxCapabilities {
        platform: std::env::consts::OS.to_string(),
        supported: true,
        kernel_release: linux_kernel_release(),
        items,
    }
}

#[cfg(not(all(unix, not(target_os = "macos"))))]
fn resolve_linux_capabilities() -> LinuxCapabilities {
    LinuxCapabilities {
        platform: std::env::consts::OS.to_string(),
        supported: false,
        kernel_release: None,
        items: vec![capability_item(
            "linux",
            "Linux capability resolver",
            "host",
            "unsupported_on_platform",
            "This resolver reports Linux host prerequisites only when the GUI runs on Linux.",
        )],
    }
}

fn capability_item(
    id: &str,
    name: &str,
    category: &str,
    status: &str,
    detail: impl Into<String>,
) -> LinuxCapabilityItem {
    LinuxCapabilityItem {
        id: id.to_string(),
        name: name.to_string(),
        category: category.to_string(),
        status: status.to_string(),
        detail: detail.into(),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn command_capability(
    id: &str,
    name: &str,
    category: &str,
    commands: &[&str],
    available_detail: &str,
    missing_detail: &str,
) -> LinuxCapabilityItem {
    let available = commands.iter().any(|command| command_exists(command));
    capability_item(
        id,
        name,
        category,
        if available {
            "available_on_host"
        } else {
            "unavailable_on_host"
        },
        if available {
            available_detail
        } else {
            missing_detail
        },
    )
}

#[cfg(all(unix, not(target_os = "macos")))]
fn linux_kernel_release() -> Option<String> {
    std::process::Command::new("uname")
        .arg("-r")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn command_exists(command: &str) -> bool {
    let Some(paths) = std::env::var_os("PATH") else {
        return false;
    };

    std::env::split_paths(&paths).any(|path| path.join(command).is_file())
}

// ============================================================================
// Performance Profile Commands
// ============================================================================

/// Get current performance profile
#[command]
pub async fn get_performance_profile(
    state: tauri::State<'_, AppState>,
) -> Result<PerformanceProfile, String> {
    state.get_performance_profile().await
}

/// Set performance profile (requires authentication)
#[command]
pub async fn set_performance_profile(
    state: tauri::State<'_, AppState>,
    profile: String,
) -> Result<ProfileChangeResult, String> {
    let profile = match profile.to_lowercase().as_str() {
        "aggressive" => PerformanceProfile::Aggressive,
        "balanced" => PerformanceProfile::Balanced,
        "lightweight" => PerformanceProfile::Lightweight,
        _ => {
            return Err(format!(
                "Invalid profile: {}. Use aggressive, balanced, or lightweight.",
                profile
            ))
        }
    };

    state.set_performance_profile(profile).await
}

/// Result of a profile change operation
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProfileChangeResult {
    pub old_profile: String,
    pub new_profile: String,
    pub collectors_affected: Vec<String>,
}

/// Get information about all available performance profiles
#[command]
pub async fn get_performance_profiles_info() -> Result<Vec<ProfileInfo>, String> {
    Ok(vec![
        ProfileInfo {
            profile: PerformanceProfile::Aggressive,
            cpu_target: "15-25%".to_string(),
            description: PerformanceProfile::Aggressive.description().to_string(),
            collectors_enabled: PerformanceProfile::Aggressive
                .enabled_collectors()
                .iter()
                .map(|s| s.to_string())
                .collect(),
            features: PerformanceProfile::Aggressive
                .features()
                .iter()
                .map(|s| s.to_string())
                .collect(),
        },
        ProfileInfo {
            profile: PerformanceProfile::Balanced,
            cpu_target: "5-10%".to_string(),
            description: PerformanceProfile::Balanced.description().to_string(),
            collectors_enabled: PerformanceProfile::Balanced
                .enabled_collectors()
                .iter()
                .map(|s| s.to_string())
                .collect(),
            features: PerformanceProfile::Balanced
                .features()
                .iter()
                .map(|s| s.to_string())
                .collect(),
        },
        ProfileInfo {
            profile: PerformanceProfile::Lightweight,
            cpu_target: "1-3%".to_string(),
            description: PerformanceProfile::Lightweight.description().to_string(),
            collectors_enabled: PerformanceProfile::Lightweight
                .enabled_collectors()
                .iter()
                .map(|s| s.to_string())
                .collect(),
            features: PerformanceProfile::Lightweight
                .features()
                .iter()
                .map(|s| s.to_string())
                .collect(),
        },
    ])
}

// ============================================================================
// Alert Commands
// ============================================================================

#[derive(Debug, Clone, serde::Deserialize)]
pub struct AlertFilter {
    pub severity: Option<String>,
    pub source: Option<String>,
    pub dismissed: Option<bool>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GuiAlert {
    pub id: String,
    pub agent_id: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub created_at: String,
    pub source: String,
    pub mitre_tactics: Vec<String>,
    pub process_name: Option<String>,
    pub process_id: Option<u32>,
    pub file_path: Option<String>,
    pub dismissed: bool,
    pub metadata: HashMap<String, serde_json::Value>,
    pub proof: Option<serde_json::Value>,
    pub incident_hash: Option<String>,
    pub manifest_hash: Option<String>,
    pub attestation_tlp: Option<String>,
    pub attestation_ioc_count: Option<u32>,
    pub attestation_ioc_types: Option<Vec<String>>,
    pub attestation_redacted_ioc_count: Option<u32>,
    pub attestation_confidence: Option<f64>,
    pub blockchain_tx_id: Option<String>,
    pub blockchain_attested_at: Option<String>,
    pub bounty_tx_id: Option<String>,
    pub bounty_amount_sol: Option<f64>,
    pub rule_author_pubkey: Option<String>,
}

#[derive(Debug, Clone)]
struct ServerApiConfig {
    base_url: String,
    bearer_token: Option<String>,
    api_key: Option<String>,
}

/// Get alerts with optional filter
#[command]
pub async fn get_alerts(
    state: tauri::State<'_, AppState>,
    filter: Option<AlertFilter>,
    since: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<GuiAlert>, String> {
    let since = since
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .map_err(|e| format!("Invalid date format: {}", e))
        })
        .transpose()?;

    let agent_id = state
        .get_status()
        .await
        .map(|status| status.agent_id)
        .unwrap_or_else(|_| "local".to_string());

    let requested_limit = filter.as_ref().and_then(|f| f.limit).or(limit);
    let requested_offset = filter.as_ref().and_then(|f| f.offset).unwrap_or(0);
    let effective_limit = requested_limit.map(|limit| limit.saturating_add(requested_offset));
    if let Some(server_config) = read_server_api_config() {
        match fetch_server_alerts(&server_config, filter.as_ref(), requested_limit).await {
            Ok(alerts) if !alerts.is_empty() => return Ok(alerts),
            Ok(_) => {
                tracing::warn!(
                    "Server alerts returned no rows; checking local agent alerts before showing an empty page"
                );
            }
            Err(error) => {
                tracing::warn!(
                    error = %error,
                    "Server alerts unavailable; falling back to local agent IPC alerts"
                );
            }
        }
    }

    let alerts = match state.get_alerts(since, effective_limit).await {
        Ok(alerts) if !alerts.is_empty() => alerts,
        Ok(_) => local_alerts_from_event_history(since, effective_limit).unwrap_or_default(),
        Err(error) => {
            tracing::warn!(error = %error, "Agent IPC alerts unavailable; using local persisted event history fallback");
            local_alerts_from_event_history(since, effective_limit)?
        }
    };
    let mut alerts = alerts
        .into_iter()
        .map(|alert| gui_alert_from_agent_alert(alert, &agent_id))
        .collect::<Vec<_>>();

    if let Some(filter) = filter.as_ref() {
        alerts = apply_gui_alert_filter(alerts, filter, requested_offset);
    }

    Ok(alerts)
}

#[command]
pub async fn get_alert_count(
    state: tauri::State<'_, AppState>,
    filter: Option<AlertFilter>,
) -> Result<usize, String> {
    if let Some(server_config) = read_server_api_config() {
        match fetch_server_alert_count(&server_config, filter.as_ref()).await {
            Ok(count) => return Ok(count),
            Err(error) => {
                tracing::warn!(error = %error, "Server alert count unavailable; falling back to local alert count");
            }
        }
    }

    let agent_id = state
        .get_status()
        .await
        .map(|status| status.agent_id)
        .unwrap_or_else(|_| "local".to_string());
    let alerts = match state.get_alerts(None, None).await {
        Ok(alerts) if !alerts.is_empty() => alerts,
        Ok(_) => local_alerts_from_event_history(None, None).unwrap_or_default(),
        Err(_) => local_alerts_from_event_history(None, None)?,
    };
    let mut alerts = alerts
        .into_iter()
        .map(|alert| gui_alert_from_agent_alert(alert, &agent_id))
        .collect::<Vec<_>>();
    if let Some(filter) = filter.as_ref() {
        alerts = apply_gui_alert_filter(alerts, filter, 0);
    }
    Ok(alerts.len())
}

async fn fetch_server_alerts(
    config: &ServerApiConfig,
    filter: Option<&AlertFilter>,
    limit: Option<usize>,
) -> Result<Vec<GuiAlert>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build server API client: {e}"))?;

    let mut request = client.get(format!("{}/alerts", config.base_url));
    let mut query: Vec<(&str, String)> = Vec::new();

    let mut per_page = limit.unwrap_or(50).clamp(1, 200);
    let page = 1usize;

    if let Some(filter) = filter {
        if let Some(severity) = filter.severity.as_ref().filter(|v| !v.trim().is_empty()) {
            query.push(("severity", severity.trim().to_string()));
        }
        if let Some(source) = filter.source.as_ref().filter(|v| !v.trim().is_empty()) {
            query.push(("source", source.trim().to_string()));
        }
        if let Some(status) = alert_status_filter(filter) {
            query.push(("status", status));
        }
        if let Some(offset) = filter.offset {
            query.push(("offset", offset.to_string()));
        }
        if let Some(limit) = filter.limit {
            per_page = limit.clamp(1, 200);
        }
    }
    query.push(("page", page.to_string()));
    query.push(("per_page", per_page.to_string()));
    if !query.is_empty() {
        request = request.query(&query);
    }

    request = apply_server_auth(request, config);

    let response = request
        .send()
        .await
        .map_err(|e| format!("Server alerts request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Server alerts returned HTTP {status}"));
    }

    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Server alerts JSON decode failed: {e}"))?;

    let data = payload
        .get("data")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Server alerts response did not include a data array".to_string())?;

    Ok(data
        .iter()
        .filter_map(gui_alert_from_server_alert)
        .collect())
}

async fn fetch_server_alert_count(
    config: &ServerApiConfig,
    filter: Option<&AlertFilter>,
) -> Result<usize, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build server API client: {e}"))?;

    let mut request = client.get(format!("{}/alerts", config.base_url));
    let mut query: Vec<(&str, String)> = vec![
        ("page", "1".to_string()),
        ("per_page", "1".to_string()),
        ("offset", "0".to_string()),
    ];
    if let Some(filter) = filter {
        if let Some(severity) = filter.severity.as_ref().filter(|v| !v.trim().is_empty()) {
            query.push(("severity", severity.trim().to_string()));
        }
        if let Some(source) = filter.source.as_ref().filter(|v| !v.trim().is_empty()) {
            query.push(("source", source.trim().to_string()));
        }
        if let Some(status) = alert_status_filter(filter) {
            query.push(("status", status));
        }
    }
    request = apply_server_auth(request.query(&query), config);

    let response = request
        .send()
        .await
        .map_err(|e| format!("Server alert count request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Server alert count returned HTTP {status}"));
    }
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Server alert count JSON decode failed: {e}"))?;
    if let Some(total) = payload
        .get("meta")
        .and_then(|meta| meta.get("total"))
        .and_then(|value| value.as_u64())
    {
        return usize::try_from(total)
            .map_err(|_| "Server alert count overflowed usize".to_string());
    }
    Ok(payload
        .get("data")
        .and_then(|value| value.as_array())
        .map(|data| data.len())
        .unwrap_or(0))
}

fn alert_status_filter(filter: &AlertFilter) -> Option<String> {
    filter.dismissed.map(|dismissed| {
        if dismissed {
            "dismissed".to_string()
        } else {
            "active".to_string()
        }
    })
}

fn apply_gui_alert_filter(
    mut alerts: Vec<GuiAlert>,
    filter: &AlertFilter,
    offset: usize,
) -> Vec<GuiAlert> {
    if let Some(severity) = filter
        .severity
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        alerts.retain(|alert| alert.severity.eq_ignore_ascii_case(severity.trim()));
    }
    if let Some(source) = filter
        .source
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        alerts.retain(|alert| alert.source.eq_ignore_ascii_case(source.trim()));
    }
    if let Some(dismissed) = filter.dismissed {
        alerts.retain(|alert| alert.dismissed == dismissed);
    }
    if offset > 0 {
        alerts = alerts.into_iter().skip(offset).collect();
    }
    alerts
}

#[command]
pub async fn get_incident(id: String) -> Result<serde_json::Value, String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("Incident id is required".to_string());
    }

    let config = read_server_api_config().ok_or_else(|| {
        "Server API credentials are not configured for incident lookup".to_string()
    })?;
    fetch_server_incident(&config, id).await
}

async fn fetch_server_incident(
    config: &ServerApiConfig,
    id: &str,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build server API client: {e}"))?;

    let request = apply_server_auth(
        client.get(format!("{}/incidents/{}", config.base_url, id)),
        config,
    );

    let response = request
        .send()
        .await
        .map_err(|e| format!("Server incident request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Server incident returned HTTP {status}"));
    }

    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Server incident JSON decode failed: {e}"))?;

    payload
        .get("data")
        .cloned()
        .ok_or_else(|| "Server incident response did not include data".to_string())
}

fn apply_server_auth(
    mut request: reqwest::RequestBuilder,
    config: &ServerApiConfig,
) -> reqwest::RequestBuilder {
    if let Some(token) = config
        .bearer_token
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        request = request.bearer_auth(token.trim());
    }
    if let Some(api_key) = config
        .api_key
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        request = request.header("x-api-key", api_key.trim());
    }
    request
}

fn gui_alert_from_server_alert(value: &serde_json::Value) -> Option<GuiAlert> {
    let id = server_json_string(value, &["id"])?;
    let proof = value.get("proof").cloned();
    let metadata = json_object(value.get("metadata"))
        .or_else(|| json_object(value.get("detection_metadata")))
        .unwrap_or_default();
    let status = server_json_string(value, &["status"]).unwrap_or_else(|| "new".to_string());
    let evidence = value.get("evidence");
    let raw_event = value.get("raw_event");
    let proof_tx = proof
        .as_ref()
        .and_then(|p| server_json_string(p, &["tx_id", "blockchain_tx_id"]));
    let proof_attested_at = proof
        .as_ref()
        .and_then(|p| server_json_string(p, &["attested_at", "blockchain_attested_at"]));
    let bounty_amount_sol = proof
        .as_ref()
        .and_then(|p| p.get("bounty"))
        .and_then(|bounty| server_json_f64(bounty, &["amount_sol"]))
        .or_else(|| server_json_f64(value, &["bounty_amount_sol"]));

    Some(GuiAlert {
        id,
        agent_id: server_json_string(value, &["agent_id"]).unwrap_or_else(|| "server".to_string()),
        severity: server_json_string(value, &["severity"]).unwrap_or_else(|| "info".to_string()),
        title: server_json_string(value, &["title"])
            .unwrap_or_else(|| "Untitled alert".to_string()),
        description: server_json_string(value, &["description"]).unwrap_or_default(),
        created_at: server_json_string(value, &["created_at", "inserted_at"]).unwrap_or_default(),
        source: server_json_string(value, &["source"])
            .or_else(|| {
                server_json_string_map(&metadata, &["source", "detection_source", "alert_source"])
            })
            .or_else(|| {
                raw_event.and_then(|v| {
                    server_json_string(v, &["source", "detection_source", "alert_source"])
                })
            })
            .or_else(|| {
                evidence.and_then(|v| {
                    server_json_string(v, &["source", "detection_source", "alert_source"])
                })
            })
            .unwrap_or_else(|| "behavioral".to_string()),
        mitre_tactics: server_json_string_array(value, &["mitre_tactics"]),
        process_name: server_json_string(value, &["process_name"])
            .or_else(|| evidence.and_then(|v| server_json_string(v, &["process_name", "process"])))
            .or_else(|| raw_event.and_then(|v| server_json_string(v, &["process_name", "process"])))
            .or_else(|| {
                metadata
                    .get("process_name")
                    .and_then(|v| v.as_str().map(str::to_string))
            }),
        process_id: server_json_u32(value, &["process_id", "pid"])
            .or_else(|| evidence.and_then(|v| server_json_u32(v, &["process_id", "pid"])))
            .or_else(|| raw_event.and_then(|v| server_json_u32(v, &["process_id", "pid"]))),
        file_path: server_json_string(value, &["file_path"])
            .or_else(|| evidence.and_then(|v| server_json_string(v, &["file_path", "path"])))
            .or_else(|| raw_event.and_then(|v| server_json_string(v, &["file_path", "path"])))
            .or_else(|| {
                metadata
                    .get("file_path")
                    .and_then(|v| v.as_str().map(str::to_string))
            }),
        dismissed: matches!(
            status.to_ascii_lowercase().as_str(),
            "resolved" | "false_positive" | "dismissed"
        ),
        metadata,
        proof,
        incident_hash: server_json_string(value, &["incident_hash"]),
        manifest_hash: server_json_string(value, &["manifest_hash"]),
        attestation_tlp: server_json_string(value, &["attestation_tlp"]),
        attestation_ioc_count: server_json_u32(value, &["attestation_ioc_count"]),
        attestation_ioc_types: Some(server_json_string_array(value, &["attestation_ioc_types"])),
        attestation_redacted_ioc_count: server_json_u32(value, &["attestation_redacted_ioc_count"]),
        attestation_confidence: server_json_f64(value, &["attestation_confidence"]),
        blockchain_tx_id: server_json_string(value, &["blockchain_tx_id"]).or(proof_tx),
        blockchain_attested_at: server_json_string(value, &["blockchain_attested_at"])
            .or(proof_attested_at),
        bounty_tx_id: server_json_string(value, &["bounty_tx_id"]),
        bounty_amount_sol,
        rule_author_pubkey: server_json_string(value, &["rule_author_pubkey"]),
    })
}

fn read_server_api_config() -> Option<ServerApiConfig> {
    let content = agent_config_contents().ok();
    let server_url = std::env::var("TAMANDUA_GUI_SERVER_URL")
        .ok()
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "api_url"))
        })
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "server_url"))
        })?;
    let base_url = normalize_server_api_url(&server_url)?;

    let bearer_token = std::env::var("TAMANDUA_GUI_API_TOKEN")
        .ok()
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "server_api_token"))
        })
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "user_api_token"))
        })
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "api_token"))
        });
    let api_key = std::env::var("TAMANDUA_GUI_API_KEY")
        .ok()
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "server_api_key"))
        })
        .or_else(|| {
            content
                .as_deref()
                .and_then(|c| read_toml_string(c, "api_key"))
        });

    if bearer_token
        .as_ref()
        .map(|s| s.trim().is_empty())
        .unwrap_or(true)
        && api_key
            .as_ref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true)
    {
        return None;
    }

    Some(ServerApiConfig {
        base_url,
        bearer_token,
        api_key,
    })
}

fn normalize_server_api_url(raw: &str) -> Option<String> {
    let mut url = raw.trim().trim_end_matches('/').to_string();
    if url.is_empty() {
        return None;
    }
    if let Some(rest) = url.strip_prefix("wss://") {
        url = format!("https://{rest}");
    } else if let Some(rest) = url.strip_prefix("ws://") {
        url = format!("http://{rest}");
    }
    for suffix in ["/socket/agent", "/socket/dashboard", "/socket/stream"] {
        if let Some(stripped) = url.strip_suffix(suffix) {
            url = stripped.to_string();
            break;
        }
    }
    if !url.ends_with("/api/v1") {
        url = format!("{}/api/v1", url.trim_end_matches('/'));
    }
    Some(url)
}

fn agent_config_contents() -> Result<String, String> {
    let config_path = agent_config_path();
    std::fs::read_to_string(&config_path).map_err(|e| {
        format!(
            "Failed to read agent config {}: {}",
            config_path.display(),
            e
        )
    })
}

fn agent_config_path() -> PathBuf {
    #[cfg(windows)]
    {
        return windows_program_data_dir()
            .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
            .join("Tamandua")
            .join("config")
            .join("agent.toml");
    }

    #[cfg(target_os = "macos")]
    {
        return PathBuf::from("/Library/Application Support/Tamandua/config/agent.toml");
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        PathBuf::from("/etc/tamandua/agent.toml")
    }
}

fn server_json_string(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|value| match value {
            serde_json::Value::String(s) if !s.trim().is_empty() => Some(s.clone()),
            serde_json::Value::Number(n) => Some(n.to_string()),
            _ => None,
        })
}

fn server_json_u32(value: &serde_json::Value, keys: &[&str]) -> Option<u32> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|value| value.as_u64())
        .and_then(|value| u32::try_from(value).ok())
}

fn server_json_f64(value: &serde_json::Value, keys: &[&str]) -> Option<f64> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|value| value.as_f64())
}

fn server_json_string_array(value: &serde_json::Value, keys: &[&str]) -> Vec<String> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn server_json_string_map(
    value: &HashMap<String, serde_json::Value>,
    keys: &[&str],
) -> Option<String> {
    keys.iter().find_map(|key| {
        value.get(*key).and_then(|value| match value {
            serde_json::Value::String(s) if !s.trim().is_empty() => Some(s.clone()),
            serde_json::Value::Number(n) => Some(n.to_string()),
            _ => None,
        })
    })
}

fn json_object(value: Option<&serde_json::Value>) -> Option<HashMap<String, serde_json::Value>> {
    value
        .and_then(|value| value.as_object())
        .map(|object| object.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
}

/// Acknowledge an alert
#[command]
pub async fn acknowledge_alert(
    state: tauri::State<'_, AppState>,
    alert_id: String,
) -> Result<(), String> {
    state.acknowledge_alert(alert_id).await
}

fn gui_alert_from_agent_alert(alert: AlertNotification, agent_id: &str) -> GuiAlert {
    let severity = alert_severity_slug(&alert.severity).to_string();
    let mut metadata = HashMap::new();

    if let Some(threat_name) = alert.threat_name.clone() {
        metadata.insert(
            "threat_name".to_string(),
            serde_json::Value::String(threat_name),
        );
    }
    if let Some(remediation) = alert.remediation.clone() {
        metadata.insert(
            "remediation".to_string(),
            serde_json::Value::String(remediation),
        );
    }

    GuiAlert {
        id: alert.id,
        agent_id: agent_id.to_string(),
        severity,
        title: alert.title,
        description: alert.description,
        created_at: alert.timestamp.to_rfc3339(),
        source: "behavioral".to_string(),
        mitre_tactics: alert.mitre_tactics,
        process_name: alert.process_name,
        process_id: alert.process_id,
        file_path: alert
            .file_path
            .map(|path| path.to_string_lossy().to_string()),
        dismissed: alert.acknowledged,
        metadata,
        proof: None,
        incident_hash: None,
        manifest_hash: None,
        attestation_tlp: None,
        attestation_ioc_count: None,
        attestation_ioc_types: None,
        attestation_redacted_ioc_count: None,
        attestation_confidence: None,
        blockchain_tx_id: None,
        blockchain_attested_at: None,
        bounty_tx_id: None,
        bounty_amount_sol: None,
        rule_author_pubkey: None,
    }
}

fn alert_severity_slug(severity: &crate::ipc::AlertSeverity) -> &'static str {
    match severity {
        crate::ipc::AlertSeverity::Info => "info",
        crate::ipc::AlertSeverity::Low => "low",
        crate::ipc::AlertSeverity::Medium => "medium",
        crate::ipc::AlertSeverity::High => "high",
        crate::ipc::AlertSeverity::Critical => "critical",
    }
}

// ============================================================================
// Scan Commands
// ============================================================================

/// Start a scan
#[command]
pub async fn start_scan(
    state: tauri::State<'_, AppState>,
    path: String,
    recursive: bool,
    scan_archives: Option<bool>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    let scan_archives = scan_archives.unwrap_or(false);
    state.start_scan(path, recursive, scan_archives).await
}

// ============================================================================
// Configuration Commands
// ============================================================================

/// Update agent configuration
#[command]
pub async fn update_config(
    state: tauri::State<'_, AppState>,
    config: AgentConfigUpdate,
) -> Result<(), String> {
    state.update_config(config).await
}

// ============================================================================
// Response Action Commands
// ============================================================================

/// Kill a process
#[command]
pub async fn kill_process(state: tauri::State<'_, AppState>, pid: u32) -> Result<(), String> {
    let result = state.kill_process(pid).await;
    record_response_action(
        "kill_process",
        &format!("PID {}", pid),
        result.as_ref().map(|_| "success").unwrap_or("failed"),
        result.as_ref().err().map(|e| e.as_str()),
    );
    result
}

#[command]
pub async fn block_ip(
    state: tauri::State<'_, AppState>,
    ip: String,
    reason: Option<String>,
    direction: Option<String>,
) -> Result<ResponseCommandResult, String> {
    let result = state.block_ip(ip.clone(), reason, direction).await;
    record_response_command_result("block_ip", &ip, &result);
    result
}

#[command]
pub async fn unblock_ip(
    state: tauri::State<'_, AppState>,
    ip: String,
    reason: Option<String>,
    direction: Option<String>,
) -> Result<ResponseCommandResult, String> {
    let result = state.unblock_ip(ip.clone(), reason, direction).await;
    record_response_command_result("unblock_ip", &ip, &result);
    result
}

#[command]
pub async fn block_domain(
    state: tauri::State<'_, AppState>,
    domain: String,
    reason: Option<String>,
) -> Result<ResponseCommandResult, String> {
    let result = state.block_domain(domain.clone(), reason).await;
    record_response_command_result("block_domain", &domain, &result);
    result
}

#[command]
pub async fn unblock_domain(
    state: tauri::State<'_, AppState>,
    domain: String,
    reason: Option<String>,
) -> Result<ResponseCommandResult, String> {
    let result = state.unblock_domain(domain.clone(), reason).await;
    record_response_command_result("unblock_domain", &domain, &result);
    result
}

#[command]
pub async fn list_blocked_ips(
    state: tauri::State<'_, AppState>,
) -> Result<ResponseCommandResult, String> {
    state.list_blocked_ips().await
}

#[command]
pub async fn list_blocked_domains(
    state: tauri::State<'_, AppState>,
) -> Result<ResponseCommandResult, String> {
    state.list_blocked_domains().await
}

#[command]
pub async fn restore_network(
    state: tauri::State<'_, AppState>,
) -> Result<ResponseCommandResult, String> {
    let result = state.restore_network().await;
    record_response_command_result("restore_network", "network", &result);
    result
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ResponseActionRecord {
    pub id: String,
    pub action_type: String,
    pub timestamp: String,
    pub target: String,
    pub result: String,
    pub triggered_by: String,
    pub hostname: String,
    pub error_message: Option<String>,
    pub can_undo: bool,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ResponseActionFilter {
    pub search: Option<String>,
    pub results: Option<Vec<String>>,
    pub action_types: Option<Vec<String>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ResponseActionStats {
    pub total_actions: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub success_rate: f64,
    pub by_type: std::collections::BTreeMap<String, usize>,
    pub by_trigger: std::collections::BTreeMap<String, usize>,
    pub recent_trend: String,
    pub avg_response_time_ms: u64,
}

static RESPONSE_ACTIONS: OnceLock<Mutex<Vec<ResponseActionRecord>>> = OnceLock::new();

fn response_actions() -> &'static Mutex<Vec<ResponseActionRecord>> {
    RESPONSE_ACTIONS.get_or_init(|| Mutex::new(Vec::new()))
}

fn record_response_action(
    action_type: &str,
    target: &str,
    result: &str,
    error_message: Option<&str>,
) {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "localhost".to_string());

    if let Ok(mut actions) = response_actions().lock() {
        actions.insert(
            0,
            ResponseActionRecord {
                id: uuid::Uuid::new_v4().to_string(),
                action_type: action_type.to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                target: target.to_string(),
                result: result.to_string(),
                triggered_by: "manual".to_string(),
                hostname,
                error_message: error_message.map(|value| value.to_string()),
                can_undo: false,
                duration_ms: None,
            },
        );
        actions.truncate(500);
    }
}

fn record_response_command_result(
    action_type: &str,
    target: &str,
    result: &Result<ResponseCommandResult, String>,
) {
    let status = match result {
        Ok(command_result) if command_result.success => "success",
        _ => "failed",
    };
    let error = match result {
        Ok(command_result) => command_result.error.as_deref(),
        Err(error) => Some(error.as_str()),
    };

    record_response_action(action_type, target, status, error);
}

#[command]
pub async fn get_response_actions(
    filter: Option<ResponseActionFilter>,
) -> Result<Vec<ResponseActionRecord>, String> {
    let actions = response_actions()
        .lock()
        .map_err(|_| "Response action log is unavailable".to_string())?;

    let mut filtered = actions.clone();
    if let Some(filter) = filter {
        if let Some(search) = filter.search {
            let search = search.to_lowercase();
            filtered.retain(|action| {
                action.target.to_lowercase().contains(&search)
                    || action.hostname.to_lowercase().contains(&search)
                    || action.action_type.to_lowercase().contains(&search)
            });
        }
        if let Some(results) = filter.results {
            filtered.retain(|action| results.contains(&action.result));
        }
        if let Some(types) = filter.action_types {
            filtered.retain(|action| types.contains(&action.action_type));
        }
        let offset = filter.offset.unwrap_or(0);
        let limit = filter.limit.unwrap_or(100);
        return Ok(filtered.into_iter().skip(offset).take(limit).collect());
    }

    Ok(filtered)
}

#[command]
pub async fn get_response_action_stats(
    filter: Option<ResponseActionFilter>,
) -> Result<ResponseActionStats, String> {
    let actions = get_response_actions(filter).await?;
    let success_count = actions
        .iter()
        .filter(|action| action.result == "success")
        .count();
    let failed_count = actions
        .iter()
        .filter(|action| action.result == "failed")
        .count();
    let mut by_type = std::collections::BTreeMap::new();
    let mut by_trigger = std::collections::BTreeMap::new();

    for action in &actions {
        *by_type.entry(action.action_type.clone()).or_insert(0) += 1;
        *by_trigger.entry(action.triggered_by.clone()).or_insert(0) += 1;
    }

    Ok(ResponseActionStats {
        total_actions: actions.len(),
        success_count,
        failed_count,
        success_rate: if actions.is_empty() {
            0.0
        } else {
            (success_count as f64 / actions.len() as f64) * 100.0
        },
        by_type,
        by_trigger,
        recent_trend: "stable".to_string(),
        avg_response_time_ms: 0,
    })
}

#[command]
pub async fn undo_response_action(action_id: String) -> Result<serde_json::Value, String> {
    let _ = action_id;
    Err("No reversible response actions are currently wired for undo".to_string())
}

/// Get quarantined files
#[command]
pub async fn get_quarantined_files(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<QuarantineEntry>, String> {
    state.get_quarantined_files().await
}

// ============================================================================
// Log Commands
// ============================================================================

/// Get logs with optional filter
#[command]
pub async fn get_logs(
    state: tauri::State<'_, AppState>,
    since: Option<String>,
    level: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let since = since
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .map_err(|e| format!("Invalid date format: {}", e))
        })
        .transpose()?;

    match state.get_logs(since, level.clone(), limit).await {
        Ok(logs) if !logs.is_empty() => Ok(logs),
        Ok(_) => local_logs_from_event_history(since, level, limit),
        Err(error) => {
            tracing::warn!(error = %error, "Agent IPC logs unavailable; using local persisted event history fallback");
            local_logs_from_event_history(since, level, limit)
        }
    }
}

#[command]
pub async fn get_log_modules(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let logs = match state.get_logs(None, None, Some(500)).await {
        Ok(logs) if !logs.is_empty() => logs,
        Ok(_) => local_logs_from_event_history(None, None, Some(500))?,
        Err(error) => {
            tracing::warn!(error = %error, "Agent IPC log modules unavailable; using local persisted event history fallback");
            local_logs_from_event_history(None, None, Some(500))?
        }
    };
    let mut modules: Vec<String> = logs.into_iter().filter_map(|log| log.module).collect();
    modules.sort();
    modules.dedup();
    Ok(modules)
}

#[command]
pub async fn export_logs(
    state: tauri::State<'_, AppState>,
    format: Option<String>,
) -> Result<String, String> {
    let logs = match state.get_logs(None, None, Some(5000)).await {
        Ok(logs) if !logs.is_empty() => logs,
        Ok(_) => local_logs_from_event_history(None, None, Some(5000))?,
        Err(error) => {
            tracing::warn!(error = %error, "Agent IPC log export unavailable; using local persisted event history fallback");
            local_logs_from_event_history(None, None, Some(5000))?
        }
    };
    let format = format.unwrap_or_else(|| "txt".to_string());

    if format == "json" {
        serde_json::to_string_pretty(&logs).map_err(|e| e.to_string())
    } else {
        Ok(logs
            .into_iter()
            .map(|log| {
                format!(
                    "{} [{}] {}: {}",
                    log.timestamp,
                    log.level,
                    log.module.unwrap_or_else(|| "agent".to_string()),
                    log.message
                )
            })
            .collect::<Vec<_>>()
            .join("\n"))
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GuiNetworkConnection {
    pub pid: u32,
    pub process_name: String,
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: Option<String>,
    pub remote_port: Option<u16>,
    pub state: String,
    pub country_code: Option<String>,
    pub country_name: Option<String>,
    pub city: Option<String>,
    pub asn: Option<String>,
    pub org: Option<String>,
}

#[command]
pub async fn get_network_connections() -> Result<Vec<GuiNetworkConnection>, String> {
    use sysinfo::{ProcessesToUpdate, System};

    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    #[cfg(target_os = "windows")]
    let output = hidden_command("netstat")
        .args(["-ano"])
        .output()
        .map_err(|e| format!("Failed to run netstat: {}", e))?;

    #[cfg(all(unix, not(target_os = "macos")))]
    let output = std::process::Command::new("ss")
        .args(["-tunap"])
        .output()
        .map_err(|e| format!("Failed to run ss: {}", e))?;

    #[cfg(target_os = "macos")]
    let output = hidden_command("netstat")
        .args(["-anv"])
        .output()
        .map_err(|e| format!("Failed to run netstat: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut connections = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }

        #[cfg(target_os = "windows")]
        {
            let protocol = parts[0].to_uppercase();
            if protocol != "TCP" && protocol != "UDP" {
                continue;
            }

            let local = parts.get(1).copied().unwrap_or("");
            let remote = parts.get(2).copied().unwrap_or("");
            let (state, pid_text) = if protocol == "UDP" {
                ("LISTENING", parts.get(3).copied().unwrap_or("0"))
            } else {
                (
                    parts.get(3).copied().unwrap_or("UNKNOWN"),
                    parts.get(4).copied().unwrap_or("0"),
                )
            };
            let pid = pid_text.parse::<u32>().unwrap_or(0);
            let (local_address, local_port) = split_addr_port(local);
            let (remote_address, remote_port) = split_addr_port(remote);
            let process_name = sys
                .process(sysinfo::Pid::from_u32(pid))
                .map(|process| process.name().to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            connections.push(GuiNetworkConnection {
                pid,
                process_name,
                protocol,
                local_address,
                local_port,
                remote_address: Some(remote_address)
                    .filter(|value| value != "*" && value != "0.0.0.0"),
                remote_port: Some(remote_port).filter(|port| *port != 0),
                state: normalize_connection_state(state),
                country_code: None,
                country_name: None,
                city: None,
                asn: None,
                org: None,
            });
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            let protocol = parts[0].to_uppercase();
            if protocol != "TCP" && protocol != "UDP" {
                continue;
            }
            let state = if protocol == "UDP" {
                "LISTENING"
            } else {
                parts.get(1).copied().unwrap_or("UNKNOWN")
            };
            let local = parts.get(4).copied().unwrap_or("");
            let remote = parts.get(5).copied().unwrap_or("");
            let pid = parts
                .iter()
                .find_map(|part| part.split("pid=").nth(1))
                .and_then(|value| value.split(',').next())
                .and_then(|value| value.parse::<u32>().ok())
                .unwrap_or(0);
            let (local_address, local_port) = split_addr_port(local);
            let (remote_address, remote_port) = split_addr_port(remote);
            let process_name = sys
                .process(sysinfo::Pid::from_u32(pid))
                .map(|process| process.name().to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            connections.push(GuiNetworkConnection {
                pid,
                process_name,
                protocol,
                local_address,
                local_port,
                remote_address: Some(remote_address)
                    .filter(|value| value != "*" && value != "0.0.0.0"),
                remote_port: Some(remote_port).filter(|port| *port != 0),
                state: normalize_connection_state(state),
                country_code: None,
                country_name: None,
                city: None,
                asn: None,
                org: None,
            });
        }

        #[cfg(target_os = "macos")]
        {
            let protocol = parts[0].to_uppercase();
            if !protocol.starts_with("TCP") && !protocol.starts_with("UDP") {
                continue;
            }

            let is_udp = protocol.starts_with("UDP");
            let local = parts.get(3).copied().unwrap_or("");
            let remote = parts.get(4).copied().unwrap_or("");
            let state = if is_udp {
                "LISTENING"
            } else {
                parts.get(5).copied().unwrap_or("UNKNOWN")
            };
            let pid_index = if is_udp { 7 } else { 8 };
            let pid = parts
                .get(pid_index)
                .and_then(|value| value.parse::<u32>().ok())
                .unwrap_or(0);
            let (local_address, local_port) = split_macos_addr_port(local);
            let (remote_address, remote_port) = split_macos_addr_port(remote);
            let process_name = sys
                .process(sysinfo::Pid::from_u32(pid))
                .map(|process| process.name().to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            connections.push(GuiNetworkConnection {
                pid,
                process_name,
                protocol,
                local_address,
                local_port,
                remote_address: Some(remote_address)
                    .filter(|value| value != "*" && value != "0.0.0.0"),
                remote_port: Some(remote_port).filter(|port| *port != 0),
                state: normalize_connection_state(state),
                country_code: None,
                country_name: None,
                city: None,
                asn: None,
                org: None,
            });
        }
    }

    Ok(connections)
}

#[cfg(target_os = "macos")]
fn split_macos_addr_port(value: &str) -> (String, u16) {
    let trimmed = value.trim_matches(['[', ']']);
    if trimmed == "*.*" {
        return ("*".to_string(), 0);
    }
    if let Some((addr, port)) = trimmed.rsplit_once('.') {
        return (
            addr.trim_matches(['[', ']']).to_string(),
            port.parse::<u16>().unwrap_or(0),
        );
    }
    split_addr_port(trimmed)
}

fn split_addr_port(value: &str) -> (String, u16) {
    let trimmed = value.trim_matches(['[', ']']);
    if let Some((addr, port)) = trimmed.rsplit_once(':') {
        (
            addr.trim_matches(['[', ']']).to_string(),
            port.parse::<u16>().unwrap_or(0),
        )
    } else {
        (trimmed.to_string(), 0)
    }
}

fn normalize_connection_state(state: &str) -> String {
    match state.to_uppercase().as_str() {
        "LISTEN" => "LISTENING".to_string(),
        other => other.to_string(),
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileBrowserEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub entry_type: String,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

#[command]
pub async fn list_directory(path: String) -> Result<Vec<FileBrowserEntry>, String> {
    let dir = PathBuf::from(path);
    let entries =
        std::fs::read_dir(&dir).map_err(|e| format!("Failed to read {}: {}", dir.display(), e))?;

    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let metadata = entry.metadata().ok();
        let modified = metadata
            .as_ref()
            .and_then(|meta| meta.modified().ok())
            .map(chrono::DateTime::<chrono::Utc>::from)
            .map(|dt| dt.to_rfc3339());

        out.push(FileBrowserEntry {
            id: path.to_string_lossy().to_string(),
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            entry_type: if metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false) {
                "directory".to_string()
            } else {
                "file".to_string()
            },
            size: metadata.as_ref().filter(|m| m.is_file()).map(|m| m.len()),
            modified,
        });
    }

    out.sort_by(|a, b| {
        a.entry_type
            .cmp(&b.entry_type)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[command]
pub async fn get_threat_intel_feed() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[command]
pub async fn get_ioc_stats() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "total": 0,
        "active_count": 0,
        "matched_count": 0,
        "recent_24h": 0
    }))
}

#[command]
pub async fn test_connection(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    state
        .test_backend_connection()
        .await
        .map(|(connected, _)| connected)
}

#[command]
pub async fn reload_rules() -> Result<(), String> {
    Err("Rule reload IPC command is not implemented by the agent yet".to_string())
}

#[command]
pub async fn isolate_network(
    state: tauri::State<'_, AppState>,
    allowed_ips: Option<Vec<String>>,
) -> Result<ResponseCommandResult, String> {
    let result = state.isolate_network(allowed_ips).await;
    record_response_command_result("isolate_network", "network", &result);
    result
}

// ============================================================================
// Backend Connection Commands
// ============================================================================

/// Test backend connection
#[command]
pub async fn test_backend_connection(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let (connected, latency_ms) = state.test_backend_connection().await?;
    Ok(serde_json::json!({
        "connected": connected,
        "latency_ms": latency_ms
    }))
}

// ============================================================================
// Authentication Commands
// ============================================================================

/// Get the current authentication setup status
#[command]
pub async fn get_auth_status(state: tauri::State<'_, AppState>) -> Result<SetupStatus, String> {
    let status = state.get_auth_status().await.map_err(|e| e.to_string())?;
    tracing::info!("get_auth_status returning: {:?}", status);
    Ok(status)
}

/// Setup the initial master password (first-run wizard)
#[command]
pub async fn setup_password(
    state: tauri::State<'_, AppState>,
    password: String,
) -> Result<(), String> {
    state
        .setup_password(&password)
        .await
        .map_err(|e| e.to_string())
}

/// Verify password and create a session
#[command]
pub async fn verify_password(
    state: tauri::State<'_, AppState>,
    password: String,
) -> Result<Session, String> {
    state
        .verify_password(&password)
        .await
        .map_err(|e| e.to_string())
}

/// Change the master password
#[command]
pub async fn change_password(
    state: tauri::State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    state
        .change_password(&current_password, &new_password)
        .await
        .map_err(|e| e.to_string())
}

/// Check password strength without setting it
#[command]
pub async fn check_password_strength(
    state: tauri::State<'_, AppState>,
    password: String,
) -> Result<PasswordStrength, String> {
    Ok(state.check_password_strength(&password))
}

/// Check if biometric authentication is available
#[command]
pub async fn check_biometric_available(
    state: tauri::State<'_, AppState>,
) -> Result<BiometricCapability, String> {
    state
        .check_biometric_available()
        .await
        .map_err(|e| e.to_string())
}

/// Authenticate using biometrics
#[command]
pub async fn authenticate_biometric(
    state: tauri::State<'_, AppState>,
    reason: String,
) -> Result<Session, String> {
    state
        .authenticate_biometric(&reason)
        .await
        .map_err(|e| e.to_string())
}

/// Get current session status
#[command]
pub async fn get_session_status(
    state: tauri::State<'_, AppState>,
    token: String,
) -> Result<SessionStatus, String> {
    state
        .get_session_status(&token)
        .await
        .map_err(|e| e.to_string())
}

/// Validate session and optionally extend it
#[command]
pub async fn validate_session(
    state: tauri::State<'_, AppState>,
    token: String,
    extend: bool,
) -> Result<bool, String> {
    state
        .validate_session(&token, extend)
        .await
        .map_err(|e| e.to_string())
}

/// Check if authentication is required for an action
#[command]
pub async fn require_auth(
    state: tauri::State<'_, AppState>,
    token: String,
    sensitive: bool,
) -> Result<(), String> {
    state
        .require_auth(&token, sensitive)
        .await
        .map_err(|e| e.to_string())
}

/// Logout and invalidate the session
#[command]
pub async fn logout(state: tauri::State<'_, AppState>, token: String) -> Result<(), String> {
    state.logout(&token).await.map_err(|e| e.to_string())
}

/// Emergency recovery using server admin token
#[command]
pub async fn emergency_recovery(
    state: tauri::State<'_, AppState>,
    recovery_token: String,
) -> Result<(), String> {
    state
        .emergency_recovery(&recovery_token)
        .await
        .map_err(|e| e.to_string())
}

/// Get audit log entries
#[command]
pub async fn get_auth_audit_log(
    state: tauri::State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<AuditEvent>, String> {
    state
        .get_auth_audit_log(limit)
        .await
        .map_err(|e| e.to_string())
}

/// Get authentication configuration
#[command]
pub async fn get_auth_config(state: tauri::State<'_, AppState>) -> Result<AuthConfig, String> {
    Ok(state.get_auth_config().await)
}

/// Update authentication configuration
#[command]
pub async fn update_auth_config(
    state: tauri::State<'_, AppState>,
    config: AuthConfig,
) -> Result<(), String> {
    state.update_auth_config(config).await;
    Ok(())
}

// ============================================================================
// Update Commands
// ============================================================================

/// Check for software updates
#[command]
pub async fn check_for_updates(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    state.check_for_updates().await
}

/// Download available update
#[command]
pub async fn download_update(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.download_update().await
}

/// Install downloaded update
#[command]
pub async fn install_update(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.install_update().await
}

/// Get current application version
#[command]
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Restart the application to apply update
#[command]
pub async fn restart_app(app_handle: tauri::AppHandle) -> Result<(), String> {
    app_handle.restart();
    #[allow(unreachable_code)]
    Ok(())
}

// ============================================================================
// Event Commands
// ============================================================================

/// Event filter for querying events
#[derive(Debug, Clone, serde::Deserialize)]
pub struct EventFilter {
    pub event_types: Option<Vec<String>>,
    pub severities: Option<Vec<String>>,
    pub search: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub agent_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

// TelemetryEvent, EventStatistics, HourlyCount, TypeCount, ProcessCount
// are imported from crate::ipc

/// Get events with filter
#[command]
pub async fn get_events(
    state: tauri::State<'_, AppState>,
    filter: Option<EventFilter>,
) -> Result<Vec<TelemetryEvent>, String> {
    // Parse date filters
    let (date_from, date_to) = if let Some(ref f) = filter {
        let from = f
            .date_from
            .as_ref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));
        let to = f
            .date_to
            .as_ref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));
        (from, to)
    } else {
        (None, None)
    };

    let event_types = filter.as_ref().and_then(|f| f.event_types.clone());
    let severities = filter.as_ref().and_then(|f| f.severities.clone());
    let search = filter.as_ref().and_then(|f| f.search.clone());
    let limit = filter.as_ref().and_then(|f| f.limit);
    let offset = filter.as_ref().and_then(|f| f.offset);

    match state
        .get_events(
            event_types,
            severities,
            search,
            date_from,
            date_to,
            limit,
            offset,
        )
        .await
    {
        Ok(events) if !events.is_empty() => Ok(events),
        Ok(_) => local_events_from_event_history(filter.as_ref(), date_from, date_to),
        Err(error) => {
            tracing::warn!(error = %error, "Agent IPC events unavailable; using local persisted event history fallback");
            local_events_from_event_history(filter.as_ref(), date_from, date_to)
        }
    }
}

/// Get a single event by ID
#[command]
pub async fn get_event(
    state: tauri::State<'_, AppState>,
    event_id: String,
) -> Result<Option<TelemetryEvent>, String> {
    state.get_event(event_id).await
}

fn local_events_from_event_history(
    filter: Option<&EventFilter>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
) -> Result<Vec<TelemetryEvent>, String> {
    let mut events = read_local_event_history()?;

    let event_types = filter.and_then(|f| f.event_types.as_ref());
    let severities = filter.and_then(|f| f.severities.as_ref());
    let search = filter
        .and_then(|f| f.search.as_deref())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_ascii_lowercase());
    let agent_id = filter
        .and_then(|f| f.agent_id.as_deref())
        .filter(|s| !s.trim().is_empty());

    events.retain(|event| {
        if let Some(types) = event_types {
            if !types.is_empty()
                && !types
                    .iter()
                    .any(|filter| event_type_matches_gui_filter(&event.event_type, filter))
            {
                return false;
            }
        }

        if let Some(sevs) = severities {
            if !sevs.is_empty()
                && !sevs
                    .iter()
                    .any(|sev| sev.eq_ignore_ascii_case(&event.severity))
            {
                return false;
            }
        }

        if let Some(from) = date_from {
            if event.timestamp < from {
                return false;
            }
        }

        if let Some(to) = date_to {
            if event.timestamp > to {
                return false;
            }
        }

        if let Some(agent_id) = agent_id {
            if event.agent_id != agent_id {
                return false;
            }
        }

        if let Some(search) = &search {
            let haystack = format!(
                "{} {} {} {} {} {}",
                event.message,
                event.event_type,
                event.hostname,
                event.process_name.as_deref().unwrap_or_default(),
                event.file_path.as_deref().unwrap_or_default(),
                event.remote_ip.as_deref().unwrap_or_default()
            )
            .to_ascii_lowercase();

            if !haystack.contains(search) {
                return false;
            }
        }

        true
    });

    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    let offset = filter.and_then(|f| f.offset).unwrap_or(0);
    let events = events.into_iter().skip(offset);

    Ok(match filter.and_then(|f| f.limit) {
        Some(limit) => events.take(limit).collect(),
        None => events.collect(),
    })
}

fn local_logs_from_event_history(
    since: Option<DateTime<Utc>>,
    level: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let mut events = read_local_event_history()?;
    let level = level.filter(|value| !value.trim().is_empty());

    events.retain(|event| {
        if let Some(since) = since {
            if event.timestamp < since {
                return false;
            }
        }

        if let Some(level) = &level {
            if !event_severity_to_log_level(&event.severity).eq_ignore_ascii_case(level) {
                return false;
            }
        }

        true
    });

    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(events
        .into_iter()
        .take(limit.unwrap_or(1000))
        .map(event_to_log_entry)
        .collect())
}

fn local_alerts_from_event_history(
    since: Option<DateTime<Utc>>,
    limit: Option<usize>,
) -> Result<Vec<AlertNotification>, String> {
    let mut events = read_local_event_history()?;

    events.retain(|event| {
        since.map(|since| event.timestamp >= since).unwrap_or(true)
            && event_is_alert_candidate(event)
    });
    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(events
        .into_iter()
        .take(limit.unwrap_or(100))
        .map(event_to_alert_notification)
        .collect())
}

fn read_local_event_history() -> Result<Vec<TelemetryEvent>, String> {
    let path = local_event_history_path();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let path_string = path.to_string_lossy();
    let sqlite_uri = format!("file:{}?immutable=1", path_string.replace(' ', "%20"));
    let conn = Connection::open_with_flags(
        sqlite_uri,
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_NO_MUTEX
            | OpenFlags::SQLITE_OPEN_URI,
    )
    .map_err(|e| {
        format!(
            "Failed to open local event history {}: {}",
            path.display(),
            e
        )
    })?;
    conn.busy_timeout(Duration::from_millis(250))
        .map_err(|e| format!("Failed to configure event history reader: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT event_json FROM events NOT INDEXED")
        .map_err(|e| format!("Failed to read local event history: {}", e))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to scan local event history: {}", e))?;

    let mut events = Vec::new();
    for row in rows {
        let raw = match row {
            Ok(raw) => raw,
            Err(error) => {
                tracing::warn!(error = %error, "Skipping unreadable local persisted event row");
                continue;
            }
        };

        match serde_json::from_str::<TelemetryEvent>(&raw) {
            Ok(event) => events.push(event),
            Err(error) => {
                tracing::warn!(error = %error, "Skipping invalid local persisted event JSON")
            }
        }
    }

    Ok(events)
}

fn local_event_history_path() -> PathBuf {
    #[cfg(windows)]
    {
        std::env::var_os("ProgramData")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
            .join("Tamandua")
            .join("event_history.sqlite")
    }

    #[cfg(target_os = "macos")]
    {
        PathBuf::from("/Library/Application Support/Tamandua/event_history.sqlite")
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        PathBuf::from("/var/lib/tamandua/event_history.sqlite")
    }
}

fn event_type_matches_gui_filter(event_type: &str, filter: &str) -> bool {
    if event_type == filter {
        return true;
    }

    match filter {
        "process" => event_type.starts_with("process_"),
        "file" => event_type.starts_with("file_"),
        "network" => {
            event_type.starts_with("network_")
                || event_type.starts_with("dns_")
                || matches!(
                    event_type,
                    "connection" | "connection_start" | "connection_end" | "dns_query"
                )
        }
        "registry" => event_type.starts_with("registry_"),
        "alert" => event_type.starts_with("alert_") || event_type.contains("detection"),
        "response" => event_type.starts_with("response_") || event_type.starts_with("remediation_"),
        "system" => {
            event_type.starts_with("system_")
                || event_type.starts_with("security_")
                || event_type.ends_with("_audit")
        }
        _ => false,
    }
}

fn event_severity_to_log_level(severity: &str) -> &'static str {
    match severity.to_ascii_lowercase().as_str() {
        "critical" | "high" => "ERROR",
        "medium" => "WARN",
        "low" | "info" => "INFO",
        _ => "DEBUG",
    }
}

fn event_to_log_entry(event: TelemetryEvent) -> LogEntry {
    let mut fields = HashMap::new();
    fields.insert("event_id".to_string(), event.id.clone());
    fields.insert("event_type".to_string(), event.event_type.clone());
    fields.insert("severity".to_string(), event.severity.clone());
    if let Some(process_name) = &event.process_name {
        fields.insert("process".to_string(), process_name.clone());
    }
    if let Some(file_path) = &event.file_path {
        fields.insert("file".to_string(), file_path.clone());
    }
    if let Some(remote_ip) = &event.remote_ip {
        fields.insert("remote_ip".to_string(), remote_ip.clone());
    }

    LogEntry {
        id: format!("log-{}", event.id),
        timestamp: event.timestamp,
        level: event_severity_to_log_level(&event.severity).to_string(),
        message: event.message,
        module: Some(event.event_type),
        fields,
    }
}

fn event_is_alert_candidate(event: &TelemetryEvent) -> bool {
    let event_type = event.event_type.to_ascii_lowercase();
    let severity = event
        .alert_severity
        .as_deref()
        .unwrap_or(&event.severity)
        .to_ascii_lowercase();

    matches!(severity.as_str(), "critical" | "high")
        || event_type.starts_with("alert_")
        || event_type.contains("detection")
        || matches!(
            event_type.as_str(),
            "defense_evasion"
                | "etw_tamper"
                | "credential_theft"
                | "process_hollowing"
                | "syscall_evasion"
                | "exploit_mitigation"
                | "lateral_movement"
        )
}

fn event_to_alert_notification(event: TelemetryEvent) -> AlertNotification {
    let severity = event.alert_severity.as_deref().unwrap_or(&event.severity);

    AlertNotification {
        id: format!("alert-{}", event.id),
        timestamp: event.timestamp,
        severity: alert_severity_from_event(severity),
        title: event
            .rule_name
            .clone()
            .unwrap_or_else(|| title_from_event_type(&event.event_type)),
        description: event.message.clone(),
        threat_name: event
            .rule_name
            .clone()
            .or(event.alert_source.clone())
            .or_else(|| Some(event.event_type.clone())),
        process_name: event.process_name.clone(),
        process_id: event.process_id,
        file_path: event.file_path.as_ref().map(PathBuf::from),
        mitre_tactics: event.mitre_tactics.clone().unwrap_or_default(),
        remediation: None,
        acknowledged: false,
    }
}

fn alert_severity_from_event(severity: &str) -> crate::ipc::AlertSeverity {
    match severity.to_ascii_lowercase().as_str() {
        "critical" => crate::ipc::AlertSeverity::Critical,
        "high" => crate::ipc::AlertSeverity::High,
        "medium" => crate::ipc::AlertSeverity::Medium,
        "low" => crate::ipc::AlertSeverity::Low,
        _ => crate::ipc::AlertSeverity::Info,
    }
}

fn title_from_event_type(event_type: &str) -> String {
    event_type
        .split('_')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Get related events
#[command]
pub async fn get_related_events(
    state: tauri::State<'_, AppState>,
    event_id: String,
) -> Result<Vec<TelemetryEvent>, String> {
    state.get_related_events(event_id).await
}

/// Get event statistics
#[command]
pub async fn get_event_statistics(
    state: tauri::State<'_, AppState>,
    filter: Option<EventFilter>,
) -> Result<EventStatistics, String> {
    let (date_from, date_to) = parse_event_date_filters(filter.as_ref());
    let event_types = filter.as_ref().and_then(|f| f.event_types.clone());
    let severities = filter.as_ref().and_then(|f| f.severities.clone());
    let search = filter.as_ref().and_then(|f| f.search.clone());

    let events = match state
        .get_events(
            event_types,
            severities,
            search,
            date_from,
            date_to,
            None,
            None,
        )
        .await
    {
        Ok(events) => events,
        Err(error) => {
            tracing::warn!(error = %error, "Agent IPC event statistics unavailable; using local persisted event history fallback");
            local_events_from_event_history(filter.as_ref(), date_from, date_to)?
        }
    };

    Ok(build_event_statistics(events, date_from, date_to))
}

/// Get event count
#[command]
pub async fn get_event_count(
    state: tauri::State<'_, AppState>,
    filter: Option<EventFilter>,
) -> Result<usize, String> {
    let count_filter = filter.map(|mut f| {
        f.limit = None;
        f.offset = None;
        f
    });
    let (date_from, date_to) = parse_event_date_filters(count_filter.as_ref());
    let events = match local_events_from_event_history(count_filter.as_ref(), date_from, date_to) {
        Ok(events) => events,
        Err(error) => {
            tracing::warn!(error = %error, "Local event count unavailable; falling back to IPC event count");
            get_events(state, count_filter).await?
        }
    };
    Ok(events.len())
}

/// Export events
#[command]
pub async fn export_events(
    state: tauri::State<'_, AppState>,
    options: serde_json::Value,
) -> Result<String, String> {
    let filter = options
        .get("filter")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map_err(|e| format!("Invalid event export filter: {}", e))?;

    let format = options
        .get("format")
        .and_then(|value| value.as_str())
        .unwrap_or("json");

    let events = get_events(state, filter).await?;

    match format {
        "json" => serde_json::to_string_pretty(&events)
            .map_err(|e| format!("Failed to serialize events as JSON: {}", e)),
        "csv" => {
            let mut output =
                String::from("id,timestamp,event_type,severity,agent_id,hostname,message\n");

            for event in events {
                output.push_str(&format!(
                    "{},{},{},{},{},{},{}\n",
                    csv_escape(&event.id),
                    csv_escape(&event.timestamp.to_rfc3339()),
                    csv_escape(&event.event_type),
                    csv_escape(&event.severity),
                    csv_escape(&event.agent_id),
                    csv_escape(&event.hostname),
                    csv_escape(&event.message)
                ));
            }

            Ok(output)
        }
        other => Err(format!("Unsupported export format: {}", other)),
    }
}

/// Get filter presets
#[command]
pub async fn get_filter_presets() -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![])
}

/// Save filter preset
#[command]
pub async fn save_filter_preset(
    _name: String,
    _filter: EventFilter,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "name": _name,
        "filter": {},
        "created_at": chrono::Utc::now().to_rfc3339()
    }))
}

/// Delete filter preset
#[command]
pub async fn delete_filter_preset(_preset_id: String) -> Result<(), String> {
    Ok(())
}

/// Create detection rule from event
#[command]
pub async fn create_detection_rule_from_event(
    _event_id: String,
    _rule_type: String,
) -> Result<String, String> {
    Err(
        "Detection rule generation from events is not wired to a real rules backend yet"
            .to_string(),
    )
}

fn parse_event_date_filters(
    filter: Option<&EventFilter>,
) -> (Option<DateTime<Utc>>, Option<DateTime<Utc>>) {
    if let Some(f) = filter {
        let from = f
            .date_from
            .as_ref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));
        let to = f
            .date_to
            .as_ref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));
        (from, to)
    } else {
        (None, None)
    }
}

fn build_event_statistics(
    events: Vec<TelemetryEvent>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
) -> EventStatistics {
    let mut by_type: HashMap<String, u64> = HashMap::new();
    let mut by_process: HashMap<String, u64> = HashMap::new();
    let mut by_hour: HashMap<DateTime<Utc>, u64> = HashMap::new();

    for event in &events {
        *by_type.entry(event.event_type.clone()).or_default() += 1;

        if let Some(process_name) = &event.process_name {
            if !process_name.is_empty() {
                *by_process.entry(process_name.clone()).or_default() += 1;
            }
        }

        if let Some(hour) = event
            .timestamp
            .date_naive()
            .and_hms_opt(event.timestamp.hour(), 0, 0)
            .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
        {
            *by_hour.entry(hour).or_default() += 1;
        }
    }

    let mut event_type_distribution: Vec<_> = by_type
        .into_iter()
        .map(|(event_type, count)| crate::ipc::TypeCount { event_type, count })
        .collect();
    event_type_distribution.sort_by(|a, b| b.count.cmp(&a.count));

    let mut top_processes: Vec<_> = by_process
        .into_iter()
        .map(|(process_name, count)| crate::ipc::ProcessCount {
            process_name,
            count,
        })
        .collect();
    top_processes.sort_by(|a, b| b.count.cmp(&a.count));
    top_processes.truncate(10);

    let mut events_per_hour: Vec<_> = by_hour
        .into_iter()
        .map(|(hour, count)| crate::ipc::HourlyCount { hour, count })
        .collect();
    events_per_hour.sort_by(|a, b| a.hour.cmp(&b.hour));

    EventStatistics {
        events_per_hour,
        event_type_distribution,
        top_processes,
        total_events: events.len() as u64,
        time_range_hours: date_from
            .zip(date_to)
            .map(|(from, to)| (to - from).num_hours().max(0) as u32)
            .unwrap_or(24),
    }
}

fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

// ============================================================================
// WSL Status Commands (Windows only)
// ============================================================================

/// Cache for WSL status to avoid spawning processes on every call
static WSL_STATUS_CACHE: Mutex<Option<(WslStatus, Instant)>> = Mutex::new(None);
const WSL_CACHE_TTL: Duration = Duration::from_secs(30); // Cache for 30 seconds

/// WSL status information
#[derive(Debug, Clone, serde::Serialize)]
pub struct WslStatus {
    pub available: bool,
    pub installed: bool,
    pub running: bool,
    pub version: Option<String>,
    pub kernel_version: Option<String>,
    pub default_distro: Option<String>,
    pub distros: Vec<WslDistro>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct WslDistro {
    pub name: String,
    pub state: String, // Running, Stopped
    pub version: u8,   // WSL 1 or 2
    pub is_default: bool,
}

/// Get WSL status (Windows only) - cached to avoid spawning processes frequently
#[command]
pub async fn get_wsl_status() -> Result<WslStatus, String> {
    // Check cache first
    {
        if let Ok(cache) = WSL_STATUS_CACHE.lock() {
            if let Some((status, timestamp)) = cache.as_ref() {
                if timestamp.elapsed() < WSL_CACHE_TTL {
                    tracing::debug!(
                        "Returning cached WSL status (age: {:?})",
                        timestamp.elapsed()
                    );
                    return Ok(status.clone());
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let status = get_wsl_status_windows().await?;
        // Update cache
        if let Ok(mut cache) = WSL_STATUS_CACHE.lock() {
            *cache = Some((status.clone(), Instant::now()));
        }
        Ok(status)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = WslStatus {
            available: false,
            installed: false,
            running: false,
            version: None,
            kernel_version: None,
            default_distro: None,
            distros: vec![],
            error: Some("WSL is only available on Windows".to_string()),
        };
        // Update cache
        if let Ok(mut cache) = WSL_STATUS_CACHE.lock() {
            *cache = Some((status.clone(), Instant::now()));
        }
        Ok(status)
    }
}

#[cfg(target_os = "windows")]
async fn get_wsl_status_windows() -> Result<WslStatus, String> {
    let mut status = WslStatus {
        available: false,
        installed: false,
        running: false,
        version: None,
        kernel_version: None,
        default_distro: None,
        distros: vec![],
        error: None,
    };

    // Check if wsl.exe exists
    let wsl_check = hidden_command("where").arg("wsl.exe").output();

    match wsl_check {
        Ok(output) if output.status.success() => {
            status.available = true;
        }
        _ => {
            status.error = Some("WSL not found in PATH".to_string());
            return Ok(status);
        }
    }

    // Get WSL version info
    let version_output = hidden_command("wsl").arg("--version").output();

    if let Ok(output) = version_output {
        if output.status.success() {
            status.installed = true;
            let stdout = String::from_utf8_lossy(&output.stdout);

            // Parse version info
            for line in stdout.lines() {
                let line = line.trim();
                if line.starts_with("WSL") && line.contains(':') {
                    if let Some(ver) = line.split(':').nth(1) {
                        status.version = Some(ver.trim().to_string());
                    }
                } else if line.contains("kernel") || line.contains("Kernel") {
                    if let Some(ver) = line.split(':').nth(1) {
                        status.kernel_version = Some(ver.trim().to_string());
                    }
                }
            }
        }
    }

    // List distros
    let list_output = hidden_command("wsl").args(["--list", "--verbose"]).output();

    if let Ok(output) = list_output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Remove null bytes (UTF-16 encoding issue)
            let stdout: String = stdout.chars().filter(|c| *c != '\0').collect();

            let mut lines = stdout.lines().skip(1); // Skip header

            for line in lines {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                let is_default = line.starts_with('*');
                let line = line.trim_start_matches('*').trim();

                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    let name = parts[0].to_string();
                    let state = parts[1].to_string();
                    let version: u8 = parts[2].parse().unwrap_or(2);

                    if state == "Running" {
                        status.running = true;
                    }

                    if is_default {
                        status.default_distro = Some(name.clone());
                    }

                    status.distros.push(WslDistro {
                        name,
                        state,
                        version,
                        is_default,
                    });
                }
            }
        }
    }

    Ok(status)
}

// ============================================================================
// Process Commands (using sysinfo crate)
// ============================================================================

/// Process information
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
    pub exe_path: Option<String>,
    pub command_line: Option<String>,
    pub user: Option<String>,
    pub cpu_usage: f32,
    pub memory_mb: f64,
    pub status: String,
    pub start_time: Option<String>,
    pub threads: u32,
    pub is_elevated: bool,
    pub is_system: bool,
}

/// Process details
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessDetails {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
    pub exe_path: Option<String>,
    pub command_line: Option<String>,
    pub user: Option<String>,
    pub cpu_usage: f32,
    pub memory_mb: f64,
    pub status: String,
    pub start_time: Option<String>,
    pub threads: u32,
    pub is_elevated: bool,
    pub is_system: bool,
    pub environment: Vec<(String, String)>,
    pub open_files: Vec<String>,
    pub network_connections: Vec<NetworkConnection>,
    pub loaded_modules: Vec<String>,
    pub children: Vec<u32>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct NetworkConnection {
    pub local_addr: String,
    pub local_port: u16,
    pub remote_addr: Option<String>,
    pub remote_port: Option<u16>,
    pub protocol: String,
    pub state: String,
}

/// Get list of running processes
#[command]
pub async fn get_processes() -> Result<Vec<ProcessInfo>, String> {
    use sysinfo::{ProcessesToUpdate, System};

    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let processes: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .map(|(pid, process)| ProcessInfo {
            pid: pid.as_u32(),
            ppid: process.parent().map(|p| p.as_u32()).unwrap_or(0),
            name: process.name().to_string_lossy().to_string(),
            exe_path: process.exe().map(|p| p.to_string_lossy().to_string()),
            command_line: Some(
                process
                    .cmd()
                    .iter()
                    .map(|s| s.to_string_lossy().to_string())
                    .collect::<Vec<_>>()
                    .join(" "),
            ),
            user: process.user_id().map(|u| u.to_string()),
            cpu_usage: process.cpu_usage(),
            memory_mb: process.memory() as f64 / 1024.0 / 1024.0,
            status: format!("{:?}", process.status()),
            start_time: Some(process.start_time().to_string()),
            threads: 0,
            is_elevated: false,
            is_system: process
                .user_id()
                .map(|u| u.to_string().contains("SYSTEM"))
                .unwrap_or(false),
        })
        .collect();

    Ok(processes)
}

/// Get detailed information about a specific process
#[command]
pub async fn get_process_details(pid: u32) -> Result<ProcessDetails, String> {
    use sysinfo::{Pid, ProcessesToUpdate, System};

    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let process = sys
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("Process {} not found", pid))?;

    Ok(ProcessDetails {
        pid,
        ppid: process.parent().map(|p| p.as_u32()).unwrap_or(0),
        name: process.name().to_string_lossy().to_string(),
        exe_path: process.exe().map(|p| p.to_string_lossy().to_string()),
        command_line: Some(
            process
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" "),
        ),
        user: process.user_id().map(|u| u.to_string()),
        cpu_usage: process.cpu_usage(),
        memory_mb: process.memory() as f64 / 1024.0 / 1024.0,
        status: format!("{:?}", process.status()),
        start_time: Some(process.start_time().to_string()),
        threads: 0,
        is_elevated: false,
        is_system: false,
        environment: process
            .environ()
            .iter()
            .map(|s| {
                let s_str = s.to_string_lossy();
                if let Some(eq_pos) = s_str.find('=') {
                    (s_str[..eq_pos].to_string(), s_str[eq_pos + 1..].to_string())
                } else {
                    (s_str.to_string(), String::new())
                }
            })
            .collect(),
        open_files: vec![],
        network_connections: vec![],
        loaded_modules: vec![],
        children: sys
            .processes()
            .iter()
            .filter(|(_, p)| p.parent().map(|pp| pp.as_u32()) == Some(pid))
            .map(|(child_pid, _)| child_pid.as_u32())
            .collect(),
    })
}

// ============================================================================
// Configuration Commands
// ============================================================================

/// Agent configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AgentConfigFull {
    pub server_url: String,
    pub collection_interval_ms: u64,
    pub enabled_collectors: Vec<String>,
    pub yara_rules_path: Option<String>,
    pub sigma_rules_path: Option<String>,
    pub auto_quarantine: bool,
    pub ml_detection_enabled: bool,
    pub log_level: String,
}

/// Get agent configuration
#[command]
pub async fn get_config(_state: tauri::State<'_, AppState>) -> Result<AgentConfigFull, String> {
    let config_path = agent_config_path();

    let content = std::fs::read_to_string(&config_path).map_err(|e| {
        format!(
            "Failed to read agent config {}: {}",
            config_path.display(),
            e
        )
    })?;

    Ok(AgentConfigFull {
        server_url: read_toml_string(&content, "server_url").unwrap_or_default(),
        collection_interval_ms: read_toml_u64(&content, "process_interval_ms").unwrap_or(1000),
        enabled_collectors: read_enabled_collectors(&content),
        yara_rules_path: read_toml_string(&content, "yara_rules_path"),
        sigma_rules_path: read_toml_string(&content, "sigma_rules_path"),
        auto_quarantine: read_toml_bool(&content, "auto_quarantine").unwrap_or(false),
        ml_detection_enabled: read_toml_bool(&content, "ml_detection_enabled").unwrap_or(false),
        log_level: read_toml_string(&content, "log_level").unwrap_or_else(|| "info".to_string()),
    })
}

fn read_toml_string(content: &str, key: &str) -> Option<String> {
    let (_, value) = find_toml_assignment(content, key)?;
    let value = value.trim();
    value
        .strip_prefix('"')
        .and_then(|s| s.strip_suffix('"'))
        .or_else(|| value.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')))
        .map(|s| s.to_string())
}

fn read_toml_u64(content: &str, key: &str) -> Option<u64> {
    let (_, value) = find_toml_assignment(content, key)?;
    value.trim().parse().ok()
}

fn read_toml_bool(content: &str, key: &str) -> Option<bool> {
    let (_, value) = find_toml_assignment(content, key)?;
    value.trim().parse().ok()
}

fn find_toml_assignment<'a>(content: &'a str, key: &str) -> Option<(&'a str, &'a str)> {
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with('['))
        .filter_map(|line| line.split_once('='))
        .find(|(left, _)| left.trim() == key)
}

fn read_enabled_collectors(content: &str) -> Vec<String> {
    let mut collectors = Vec::new();
    for key in [
        "process_interval_ms",
        "file_interval_ms",
        "network_interval_ms",
        "registry_interval_ms",
        "dns_interval_ms",
    ] {
        if read_toml_u64(content, key).is_some() {
            collectors.push(key.trim_end_matches("_interval_ms").to_string());
        }
    }
    collectors
}

// ============================================================================
// Schedule Commands
// ============================================================================

/// Schedule frequency
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum ScheduleFrequency {
    #[serde(rename = "once")]
    Once { datetime: String },
    #[serde(rename = "daily")]
    Daily { time: String },
    #[serde(rename = "weekly")]
    Weekly { days: Vec<String>, time: String },
    #[serde(rename = "monthly")]
    Monthly { day: u8, time: String },
    #[serde(rename = "cron")]
    Cron { expression: String },
}

/// Scan options
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScanOptions {
    pub scan_archives: bool,
    pub follow_symlinks: bool,
    pub cpu_priority: String,
    pub skip_if_on_battery: bool,
    pub wake_to_scan: bool,
}

/// Detection action
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum DetectionAction {
    #[serde(rename = "alert")]
    Alert,
    #[serde(rename = "quarantine")]
    Quarantine,
    #[serde(rename = "custom")]
    Custom {
        action_name: String,
        params: serde_json::Value,
    },
}

/// Schedule
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub scan_type: String,
    pub frequency: ScheduleFrequency,
    pub frequency_display: String,
    pub next_run: Option<String>,
    pub last_run: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub paths: Vec<String>,
    pub options: ScanOptions,
    pub detection_action: DetectionAction,
    pub created_at: String,
    pub updated_at: String,
}

/// Schedule config for create/update
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ScheduleConfig {
    pub name: String,
    pub scan_type: String,
    pub frequency: ScheduleFrequency,
    pub paths: Vec<String>,
    pub options: ScanOptions,
    pub detection_action: DetectionAction,
}

/// Schedule history entry
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScheduleHistory {
    pub id: String,
    pub schedule_id: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub status: String,
    pub files_scanned: usize,
    pub threats_found: usize,
    pub error_message: Option<String>,
}

/// Schedule running status
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScheduleRunningStatus {
    pub schedule_id: String,
    pub started_at: String,
    pub current_path: Option<String>,
    pub files_scanned: usize,
    pub files_total: Option<usize>,
    pub threats_found: usize,
}

/// Get all schedules
#[command]
pub async fn get_schedules() -> Result<Vec<Schedule>, String> {
    Ok(vec![])
}

/// Get a single schedule
#[command]
pub async fn get_schedule(schedule_id: String) -> Result<Option<Schedule>, String> {
    Ok(None)
}

/// Create a new schedule
#[command]
pub async fn create_schedule(config: ScheduleConfig) -> Result<Schedule, String> {
    let _ = config;
    Err("Scheduled scans are not wired to a persistent scheduler yet".to_string())
}

/// Update an existing schedule
#[command]
pub async fn update_schedule(
    schedule_id: String,
    config: ScheduleConfig,
) -> Result<Schedule, String> {
    let _ = (schedule_id, config);
    Err("Scheduled scans are not wired to a persistent scheduler yet".to_string())
}

/// Delete a schedule
#[command]
pub async fn delete_schedule(schedule_id: String) -> Result<(), String> {
    let _ = schedule_id;
    Err("Scheduled scans are not wired to a persistent scheduler yet".to_string())
}

/// Enable or disable a schedule
#[command]
pub async fn set_schedule_enabled(schedule_id: String, enabled: bool) -> Result<(), String> {
    let _ = (schedule_id, enabled);
    Err("Scheduled scans are not wired to a persistent scheduler yet".to_string())
}

/// Run a schedule immediately
#[command]
pub async fn run_schedule_now(schedule_id: String) -> Result<(), String> {
    let _ = schedule_id;
    Err("Scheduled scans are not wired to a persistent scheduler yet".to_string())
}

/// Get schedule history
#[command]
pub async fn get_schedule_history(
    schedule_id: String,
    limit: Option<usize>,
) -> Result<Vec<ScheduleHistory>, String> {
    Ok(vec![])
}

/// Get running status of a scheduled scan
#[command]
pub async fn get_schedule_running_status(
    schedule_id: String,
) -> Result<Option<ScheduleRunningStatus>, String> {
    Ok(None)
}

/// Cancel a running scheduled scan
#[command]
pub async fn cancel_scheduled_scan(schedule_id: String) -> Result<(), String> {
    let _ = schedule_id;
    Err("Scheduled scans are not wired to a persistent scheduler yet".to_string())
}

/// Get scheduled exports
#[command]
pub async fn get_scheduled_exports() -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![])
}

// ============================================================================
// Driver Control Commands
// ============================================================================

/// Driver status information for GUI
#[derive(Debug, Clone, serde::Serialize)]
pub struct DriverStatusInfo {
    pub loaded: bool,
    pub connected: bool,
    pub version: Option<String>,
    pub service_name: String,
    pub driver_path: Option<String>,
    pub usermode_fallback: bool,
    pub consecutive_failures: u32,
    /// Total events captured via driver. None if telemetry not wired to IPC.
    pub events_captured: Option<u64>,
    pub last_communication: Option<String>,
    pub error: Option<String>,
    pub install_available: bool,
}

/// Driver operation result
#[derive(Debug, Clone, serde::Serialize)]
pub struct DriverOperationResult {
    pub operation: String,
    pub success: bool,
    pub message: Option<String>,
}

/// Get detailed driver status
#[command]
pub async fn get_driver_status(
    state: tauri::State<'_, AppState>,
) -> Result<DriverStatusInfo, String> {
    let info = state.get_driver_status().await?;

    Ok(DriverStatusInfo {
        loaded: info.loaded,
        connected: info.connected,
        version: info.version,
        service_name: info.service_name,
        driver_path: info.driver_path,
        usermode_fallback: info.usermode_fallback,
        consecutive_failures: info.consecutive_failures,
        events_captured: info.events_captured,
        last_communication: info.last_communication.map(|dt| dt.to_rfc3339()),
        error: info.error,
        install_available: info.install_available,
    })
}

/// Load the kernel driver (requires authentication)
#[command]
pub async fn load_driver(
    state: tauri::State<'_, AppState>,
) -> Result<DriverOperationResult, String> {
    let (success, message) = state.load_driver().await?;
    Ok(DriverOperationResult {
        operation: "load".to_string(),
        success,
        message,
    })
}

/// Unload the kernel driver (requires authentication)
#[command]
pub async fn unload_driver(
    state: tauri::State<'_, AppState>,
) -> Result<DriverOperationResult, String> {
    let (success, message) = state.unload_driver().await?;
    Ok(DriverOperationResult {
        operation: "unload".to_string(),
        success,
        message,
    })
}

// ============================================================================
// Agent Control Commands
// ============================================================================

/// Agent stopping notification
#[derive(Debug, Clone, serde::Serialize)]
pub struct AgentStoppingInfo {
    pub reason: String,
    pub restart_scheduled: bool,
}

/// Agent service start result.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AgentStartInfo {
    pub service_name: String,
    pub started: bool,
    pub message: String,
}

/// Local agent setup status used by the GUI setup/recovery wizard.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AgentSetupStatus {
    pub is_elevated: bool,
    pub can_read_agent_token: bool,
    pub agent_id: Option<String>,
    pub platform: String,
    pub service_installed: bool,
    pub service_name: Option<String>,
    pub service_state: Option<String>,
    pub service_path: Option<String>,
    pub process_running: bool,
    pub agent_binary_path: Option<String>,
    pub next_action: String,
}

/// Result of installing/enrolling the local agent service.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AgentInstallInfo {
    pub success: bool,
    pub service_name: String,
    pub agent_id: Option<String>,
    pub message: String,
}

/// Result of repairing/updating the local agent service without consuming a new
/// enrollment token.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AgentRepairInfo {
    pub success: bool,
    pub service_name: String,
    pub agent_id: Option<String>,
    pub ipc_ready: bool,
    pub message: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct UpdateCenterStatus {
    pub source: String,
    pub checked_at: String,
    pub components: Vec<ComponentUpdateStatus>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ComponentUpdateStatus {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub installed_version: Option<String>,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub status: String,
    pub source_url: Option<String>,
    pub download_url: Option<String>,
    pub sha256: Option<String>,
    pub signature: Option<String>,
    pub error: Option<String>,
}

/// Stop the agent (requires authentication)
/// WARNING: This will terminate the IPC connection
#[command]
pub async fn stop_agent(state: tauri::State<'_, AppState>) -> Result<AgentStoppingInfo, String> {
    let (reason, restart_scheduled) = state.stop_agent().await?;
    Ok(AgentStoppingInfo {
        reason,
        restart_scheduled,
    })
}

/// Restart the agent (requires authentication)
/// The agent will exit and Windows SCM will restart it
#[command]
pub async fn restart_agent(state: tauri::State<'_, AppState>) -> Result<AgentStoppingInfo, String> {
    let (reason, restart_scheduled) = match state.restart_agent().await {
        Ok(result) => result,
        Err(ipc_error) => {
            #[cfg(windows)]
            {
                restart_agent_service_fallback()
                    .await
                    .map(|message| (message, true))
                    .map_err(|service_error| {
                        format!(
                            "IPC restart failed: {}. Service restart fallback failed: {}",
                            ipc_error, service_error
                        )
                    })?
            }

            #[cfg(not(windows))]
            {
                return Err(ipc_error);
            }
        }
    };
    Ok(AgentStoppingInfo {
        reason,
        restart_scheduled,
    })
}

/// Start the local Tamandua Agent service without requiring an active IPC
/// connection. This is the recovery path when the GUI shows "agent offline".
#[command]
pub async fn start_agent(state: tauri::State<'_, AppState>) -> Result<AgentStartInfo, String> {
    let result = start_agent_service().await?;
    let _ = state.refresh_agent_connection().await;
    Ok(result)
}

/// Inspect local setup state without requiring IPC. This works when the agent is
/// offline and powers the GUI recovery wizard.
#[command]
pub async fn get_agent_setup_status() -> Result<AgentSetupStatus, String> {
    get_local_agent_setup_status().await
}

/// Install/enroll the local agent service by invoking the agent binary's
/// `install` subcommand. The GUI should call this only after UAC elevation.
#[command]
pub async fn install_agent_service(
    state: tauri::State<'_, AppState>,
    token: String,
    server: Option<String>,
    enrollment_url: Option<String>,
    service_name: Option<String>,
    no_driver: Option<bool>,
) -> Result<AgentInstallInfo, String> {
    let requested_service_name = normalized_agent_service_name(service_name.as_deref());
    let result = match install_local_agent_service(
        token,
        server,
        enrollment_url,
        service_name,
        no_driver,
    )
    .await
    {
        Ok(result) => result,
        Err(error) if is_reused_enrollment_token_error(&error) => {
            if let Some(agent_id) = read_local_agent_id() {
                AgentInstallInfo {
                    success: true,
                    service_name: requested_service_name,
                    agent_id: Some(agent_id),
                    message: "Agent is already enrolled locally; the enrollment token has already been consumed. Use Repair Local Agent to update or restart without re-enrolling.".to_string(),
                }
            } else {
                return Err(error);
            }
        }
        Err(error) => return Err(error),
    };

    // The installer restarts the Windows service. Drop any cached IPC status so
    // the GUI does not keep showing the pre-enrollment pending state.
    let _ = state.refresh_agent_connection().await;

    Ok(result)
}

/// Repair/update the local agent service without enrolling again. This is used
/// when a token was already consumed, the service binary is stale, or IPC needs
/// local recovery.
#[command]
pub async fn repair_agent_service(
    state: tauri::State<'_, AppState>,
) -> Result<AgentRepairInfo, String> {
    let result = repair_local_agent_service().await?;
    let _ = state.refresh_agent_connection().await;
    Ok(result)
}

/// Query the Treantlab update catalog and local component versions. Missing
/// remote endpoints are reported explicitly instead of replaced with mock data.
#[command]
pub async fn get_update_center_status(
    catalog_url: Option<String>,
) -> Result<UpdateCenterStatus, String> {
    get_component_update_status(catalog_url).await
}

#[cfg(windows)]
async fn start_agent_service() -> Result<AgentStartInfo, String> {
    let mut errors = Vec::new();
    ensure_installed_agent_is_not_older()?;

    for service_name in candidate_agent_service_names() {
        let query = hidden_command("sc.exe")
            .args(["query", service_name])
            .output()
            .map_err(|e| format!("Failed to query Windows services: {}", e))?;

        if !query.status.success() {
            errors.push(format!("{}: service not found", service_name));
            continue;
        }

        let query_text = String::from_utf8_lossy(&query.stdout);
        if query_text.contains("RUNNING") {
            return Ok(AgentStartInfo {
                service_name: (*service_name).to_string(),
                started: false,
                message: "Agent service is already running.".to_string(),
            });
        }

        let repaired_path = repair_agent_service_config(service_name)?;

        let start = hidden_command("sc.exe")
            .args(["start", service_name])
            .output()
            .map_err(|e| format!("Failed to start Windows service: {}", e))?;

        let stdout = String::from_utf8_lossy(&start.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&start.stderr).trim().to_string();
        let combined = [stdout.as_str(), stderr.as_str()]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        if start.status.success() || combined.contains("1056") {
            return Ok(AgentStartInfo {
                service_name: (*service_name).to_string(),
                started: start.status.success(),
                message: if combined.is_empty() {
                    "Agent service start requested.".to_string()
                } else {
                    combined
                },
            });
        }

        let post_start_query = hidden_command("sc.exe")
            .args(["query", service_name])
            .output()
            .map_err(|e| format!("Failed to query Windows service after start: {}", e))?;
        let post_start_text = String::from_utf8_lossy(&post_start_query.stdout);
        if post_start_text.contains("RUNNING") {
            return Ok(AgentStartInfo {
                service_name: (*service_name).to_string(),
                started: true,
                message: "Agent service is running after SCM recovery query.".to_string(),
            });
        }

        if is_agent_process_running() {
            return Err(format!(
                "A tamandua-agent.exe process is running outside the '{}' Windows service, which is still not RUNNING. Close the stray process or use Agent Setup recovery, then start again. Repaired service command: {}. Last SCM response: {}",
                service_name,
                repaired_path.unwrap_or_else(|| "unchanged".to_string()),
                if combined.is_empty() {
                    format!("sc.exe exited with {:?}", start.status.code())
                } else {
                    combined.clone()
                }
            ));
        }

        errors.push(format!(
            "{}: {}",
            service_name,
            if combined.is_empty() {
                format!("sc.exe exited with {:?}", start.status.code())
            } else {
                combined
            }
        ));
    }

    Err(format!(
        "Could not start Tamandua Agent service. Tried: {}",
        errors.join(" | ")
    ))
}

#[cfg(windows)]
async fn restart_agent_service_fallback() -> Result<String, String> {
    ensure_installed_agent_is_not_older()?;

    let mut errors = Vec::new();
    for service_name in candidate_agent_service_names() {
        let query = hidden_command("sc.exe")
            .args(["query", service_name])
            .output()
            .map_err(|e| format!("Failed to query Windows service: {}", e))?;

        if !query.status.success() {
            errors.push(format!("{}: service not found", service_name));
            continue;
        }

        let _ = repair_agent_service_config(service_name);

        let query_text = String::from_utf8_lossy(&query.stdout);
        if query_text.contains("RUNNING") || query_text.contains("START_PENDING") {
            let stop = hidden_command("sc.exe")
                .args(["stop", service_name])
                .output()
                .map_err(|e| format!("Failed to stop Windows service: {}", e))?;

            let stop_text = command_output_text(&stop);
            if !stop.status.success()
                && !stop_text.contains("1062")
                && !stop_text.contains("1052")
                && !stop_text.contains("1061")
            {
                errors.push(format!("{} stop: {}", service_name, stop_text));
                continue;
            }

            wait_for_service_state(service_name, "STOPPED", Duration::from_secs(20));
        }

        let start = hidden_command("sc.exe")
            .args(["start", service_name])
            .output()
            .map_err(|e| format!("Failed to start Windows service: {}", e))?;
        let start_text = command_output_text(&start);

        if start.status.success() || start_text.contains("1056") {
            wait_for_service_state(service_name, "RUNNING", Duration::from_secs(20));
            return Ok(if start_text.is_empty() {
                format!(
                    "{} restart requested via Windows Service Control.",
                    service_name
                )
            } else {
                start_text
            });
        }

        let post_query = hidden_command("sc.exe")
            .args(["query", service_name])
            .output()
            .map_err(|e| format!("Failed to query Windows service after restart: {}", e))?;
        let post_text = String::from_utf8_lossy(&post_query.stdout);
        if post_text.contains("RUNNING") {
            return Ok(format!(
                "{} is running after service restart fallback.",
                service_name
            ));
        }

        errors.push(format!(
            "{} start: {}",
            service_name,
            if start_text.is_empty() {
                format!("sc.exe exited with {:?}", start.status.code())
            } else {
                start_text
            }
        ));
    }

    Err(format!(
        "Could not restart Tamandua Agent service. Tried: {}",
        errors.join(" | ")
    ))
}

#[cfg(windows)]
fn wait_for_service_state(service_name: &str, expected: &str, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Ok(output) = hidden_command("sc.exe")
            .args(["query", service_name])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            if text.contains(expected) {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    false
}

#[cfg(windows)]
fn command_output_text(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    [stdout.as_str(), stderr.as_str()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(not(windows))]
fn command_output_text(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    [stdout.as_str(), stderr.as_str()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn normalized_agent_service_name(service_name: Option<&str>) -> String {
    if let Some(name) = service_name.map(str::trim).filter(|name| !name.is_empty()) {
        return name.to_string();
    }

    #[cfg(target_os = "macos")]
    let default_name = default_macos_service_name();

    #[cfg(not(target_os = "macos"))]
    let default_name = "TamanduaAgent".to_string();

    default_name
}

fn is_reused_enrollment_token_error(error: &str) -> bool {
    let lower = error.to_ascii_lowercase();
    lower.contains("token has reached its maximum number of uses")
        || (lower.contains("http 401") && lower.contains("token validation failed"))
}

fn parse_agent_id_from_installer_output(output: &str) -> Option<String> {
    output
        .lines()
        .find_map(|line| line.trim().strip_prefix("Agent ID:").map(str::trim))
        .filter(|value| !value.is_empty() && *value != "assigned")
        .map(ToString::to_string)
}

fn local_agent_config_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(windows)]
    {
        if let Some(program_data) = windows_program_data_dir() {
            candidates.push(
                program_data
                    .join("Tamandua")
                    .join("config")
                    .join("agent.toml"),
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from(
            "/Library/Application Support/Tamandua/config/agent.toml",
        ));
        candidates.push(PathBuf::from("/var/lib/tamandua/config/agent.toml"));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        candidates.push(PathBuf::from("/var/lib/tamandua/config/agent.toml"));
    }

    candidates
}

fn read_local_agent_id() -> Option<String> {
    local_agent_config_candidates()
        .into_iter()
        .find_map(|path| std::fs::read_to_string(path).ok())
        .and_then(|contents| parse_agent_id_from_config(&contents))
}

fn parse_agent_id_from_config(contents: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let line = line.split('#').next()?.trim();
        let value = line.strip_prefix("agent_id")?.trim();
        let value = value.strip_prefix('=')?.trim();
        parse_toml_like_string(value)
    })
}

fn parse_toml_like_string(value: &str) -> Option<String> {
    let value = value.trim();
    let parsed = if let Some(rest) = value.strip_prefix('"') {
        rest.split('"').next()
    } else if let Some(rest) = value.strip_prefix('\'') {
        rest.split('\'').next()
    } else {
        value.split_whitespace().next()
    }?;

    let parsed = parsed.trim();
    if parsed.is_empty() {
        None
    } else {
        Some(parsed.to_string())
    }
}

#[cfg(windows)]
fn ensure_installed_agent_is_not_older() -> Result<(), String> {
    let Some(installed) = find_installed_agent_executable() else {
        return Ok(());
    };
    let Some(latest) = find_latest_agent_executable() else {
        return Ok(());
    };

    let installed_modified = std::fs::metadata(&installed)
        .and_then(|meta| meta.modified())
        .map_err(|e| format!("Failed to inspect installed agent binary: {}", e))?;
    let latest_modified = std::fs::metadata(&latest)
        .and_then(|meta| meta.modified())
        .map_err(|e| format!("Failed to inspect bundled agent binary: {}", e))?;

    if latest != installed && latest_modified > installed_modified {
        return Err(format!(
            "Installed agent binary is older than the bundled GUI agent. Run Install / Enroll Agent before Start Agent. Installed: {}. Bundled: {}.",
            installed.display(),
            latest.display()
        ));
    }

    Ok(())
}

#[cfg(windows)]
fn repair_agent_service_config(service_name: &str) -> Result<Option<String>, String> {
    let agent_exe = find_installed_agent_executable()
        .or_else(find_agent_executable)
        .ok_or_else(|| {
            "Could not locate tamandua-agent.exe to repair the Windows service.".to_string()
        })?;

    let config_path = windows_program_data_dir()
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
        .join("Tamandua")
        .join("config")
        .join("agent.toml");

    let command_line = format!(
        "{} --config {} service",
        quote_windows_command_arg(&agent_exe.to_string_lossy()),
        quote_windows_command_arg(&config_path.to_string_lossy())
    );

    let current_path = query_service_binary_path(service_name);
    if current_path.as_deref() == Some(command_line.as_str()) {
        return Ok(None);
    }

    let output = hidden_command("sc.exe")
        .args(["config", service_name, "binPath=", &command_line])
        .output()
        .map_err(|e| format!("Failed to repair Windows service command line: {}", e))?;

    if output.status.success() {
        Ok(Some(command_line))
    } else {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message = [stdout.as_str(), stderr.as_str()]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        Err(if message.is_empty() {
            format!(
                "Failed to repair Windows service command line: sc.exe exited with {:?}",
                output.status.code()
            )
        } else {
            format!("Failed to repair Windows service command line: {}", message)
        })
    }
}

#[cfg(windows)]
async fn get_local_agent_setup_status() -> Result<AgentSetupStatus, String> {
    let is_elevated = is_current_process_elevated();
    let can_read_agent_token = crate::ipc::auth::can_read_token().await;
    let service = find_agent_service();
    let process_running = is_agent_process_running();
    let agent_binary_path = find_agent_executable().map(|p| p.to_string_lossy().to_string());

    let next_action = if !is_elevated {
        "elevate".to_string()
    } else if service.is_none() {
        "install".to_string()
    } else if service.as_ref().and_then(|s| s.state.as_deref()) != Some("RUNNING") {
        "start".to_string()
    } else if !can_read_agent_token {
        "wait_for_token".to_string()
    } else {
        "ready".to_string()
    };

    Ok(AgentSetupStatus {
        is_elevated,
        can_read_agent_token,
        agent_id: read_local_agent_id(),
        platform: std::env::consts::OS.to_string(),
        service_installed: service.is_some(),
        service_name: service.as_ref().map(|s| s.name.clone()),
        service_state: service.as_ref().and_then(|s| s.state.clone()),
        service_path: service.as_ref().and_then(|s| s.path.clone()),
        process_running,
        agent_binary_path,
        next_action,
    })
}

#[cfg(target_os = "macos")]
async fn get_local_agent_setup_status() -> Result<AgentSetupStatus, String> {
    let is_elevated = is_current_process_elevated();
    let can_read_agent_token = crate::ipc::auth::can_read_token().await;
    let service_name = default_macos_service_name();
    let service_path = macos_launchd_plist_path(&service_name);
    let service_installed = service_path.exists();
    let service_state = if service_installed {
        Some(macos_service_state(&service_name))
    } else {
        None
    };
    let process_running = is_macos_agent_process_running();
    let agent_binary_path = find_agent_executable().map(|p| p.to_string_lossy().to_string());

    let next_action = if agent_binary_path.is_none() {
        "unsupported".to_string()
    } else if !service_installed {
        "install".to_string()
    } else if service_state.as_deref() != Some("RUNNING") && !process_running {
        "start".to_string()
    } else if !can_read_agent_token {
        "wait_for_token".to_string()
    } else {
        "ready".to_string()
    };

    Ok(AgentSetupStatus {
        is_elevated,
        can_read_agent_token,
        agent_id: read_local_agent_id(),
        platform: std::env::consts::OS.to_string(),
        service_installed,
        service_name: Some(service_name),
        service_state,
        service_path: Some(service_path.to_string_lossy().to_string()),
        process_running,
        agent_binary_path,
        next_action,
    })
}

#[cfg(all(not(windows), not(target_os = "macos")))]
async fn get_local_agent_setup_status() -> Result<AgentSetupStatus, String> {
    Ok(AgentSetupStatus {
        is_elevated: is_current_process_elevated(),
        can_read_agent_token: crate::ipc::auth::can_read_token().await,
        agent_id: read_local_agent_id(),
        platform: std::env::consts::OS.to_string(),
        service_installed: false,
        service_name: None,
        service_state: None,
        service_path: None,
        process_running: false,
        agent_binary_path: None,
        next_action: "unsupported".to_string(),
    })
}

#[cfg(windows)]
async fn install_local_agent_service(
    token: String,
    server: Option<String>,
    enrollment_url: Option<String>,
    service_name: Option<String>,
    no_driver: Option<bool>,
) -> Result<AgentInstallInfo, String> {
    if token.trim().is_empty() {
        return Err("Enrollment token is required.".to_string());
    }

    let service_name = service_name.unwrap_or_else(|| "TamanduaAgent".to_string());
    let agent_exe = find_latest_agent_executable().ok_or_else(|| {
        "Could not locate tamandua-agent.exe. Build or install the agent first.".to_string()
    })?;
    let installer_exe = stage_agent_installer_binary(&agent_exe)?;

    let mut args = vec![
        "install".to_string(),
        "--name".to_string(),
        service_name.clone(),
        "--token".to_string(),
        token,
    ];

    if let Some(server) = server.filter(|s| !s.trim().is_empty()) {
        args.push("--server".to_string());
        args.push(server);
    }

    if let Some(enrollment_url) = enrollment_url.filter(|s| !s.trim().is_empty()) {
        args.push("--enrollment-url".to_string());
        args.push(enrollment_url);
    }

    if no_driver.unwrap_or(false) {
        args.push("--no-driver".to_string());
    }

    let output = hidden_command(&installer_exe)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run agent installer: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let message = [stdout.as_str(), stderr.as_str()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    let agent_id = parse_agent_id_from_installer_output(&message).or_else(read_local_agent_id);
    let concise_message = summarize_agent_installer_output(&message);

    if output.status.success() {
        Ok(AgentInstallInfo {
            success: true,
            service_name,
            agent_id,
            message: if concise_message.is_empty() {
                "Agent service installed.".to_string()
            } else {
                concise_message
            },
        })
    } else {
        Err(if concise_message.is_empty() {
            format!("Agent installer exited with {:?}", output.status.code())
        } else {
            concise_message
        })
    }
}

fn summarize_agent_installer_output(output: &str) -> String {
    if output.trim().is_empty() {
        return String::new();
    }

    let agent_id =
        parse_agent_id_from_installer_output(output).unwrap_or_else(|| "assigned".to_string());

    let driver_warning = output.contains("driver was installed but not loaded")
        || output.contains("rejected the driver signature");
    let pending_reason = output.lines().find_map(|line| {
        line.trim()
            .strip_prefix("Enrollment pending reason:")
            .map(str::trim)
    });

    if let Some(reason) = pending_reason {
        return format!(
            "Agent service installed locally, but backend enrollment is pending: {reason}"
        );
    }

    if output.contains("The agent is now running and connected to the backend.") {
        if driver_warning {
            return format!(
                "Agent enrolled and connected. Agent ID: {agent_id}. Driver is waiting for a signed build; user-mode protection is running."
            );
        }

        return format!("Agent enrolled and connected. Agent ID: {agent_id}.");
    }

    output
        .lines()
        .map(str::trim)
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with('[')
                && !line.contains("tamandua_agent::")
                && !line.contains("\u{1b}[")
        })
        .take(8)
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(target_os = "macos")]
async fn install_local_agent_service(
    token: String,
    server: Option<String>,
    enrollment_url: Option<String>,
    service_name: Option<String>,
    no_driver: Option<bool>,
) -> Result<AgentInstallInfo, String> {
    if token.trim().is_empty() {
        return Err("Enrollment token is required.".to_string());
    }

    let service_name = service_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(default_macos_service_name);
    let agent_exe = find_agent_executable().ok_or_else(|| {
        "Could not locate the bundled tamandua-agent binary in the macOS app resources.".to_string()
    })?;

    let mut args = vec![
        "install".to_string(),
        "--name".to_string(),
        service_name.clone(),
        "--token".to_string(),
        token,
    ];

    if let Some(server) = server.filter(|s| !s.trim().is_empty()) {
        args.push("--server".to_string());
        args.push(server);
    }

    if let Some(enrollment_url) = enrollment_url.filter(|s| !s.trim().is_empty()) {
        args.push("--enrollment-url".to_string());
        args.push(enrollment_url);
    }

    let _ = no_driver;
    args.push("--no-driver".to_string());

    let install_command = shell_join(
        std::iter::once(agent_exe.to_string_lossy().to_string())
            .chain(args)
            .collect::<Vec<_>>()
            .as_slice(),
    );
    let label = macos_launchd_label(&service_name);
    let command_line = format!(
        "{}; status=$?; if [ $status -eq 0 ]; then launchctl kickstart -k system/{} >/dev/null 2>&1 || true; fi; exit $status",
        install_command,
        shell_quote(&label)
    );
    let output = run_macos_admin_shell(&command_line)
        .map_err(|e| format!("macOS administrator authorization failed: {}", e))?;

    let message = command_output_text(&output);
    let agent_id = parse_agent_id_from_installer_output(&message).or_else(read_local_agent_id);
    let concise_message = summarize_agent_installer_output(&message);

    if output.status.success() {
        Ok(AgentInstallInfo {
            success: true,
            service_name,
            agent_id,
            message: if concise_message.is_empty() {
                "Agent LaunchDaemon installed.".to_string()
            } else {
                concise_message
            },
        })
    } else {
        Err(if concise_message.is_empty() {
            format!("Agent installer exited with {:?}", output.status.code())
        } else {
            concise_message
        })
    }
}

#[cfg(all(not(windows), not(target_os = "macos")))]
async fn install_local_agent_service(
    _token: String,
    _server: Option<String>,
    _enrollment_url: Option<String>,
    _service_name: Option<String>,
    _no_driver: Option<bool>,
) -> Result<AgentInstallInfo, String> {
    Err(
        "Installing the agent service from the GUI is currently implemented for Windows only."
            .to_string(),
    )
}

#[cfg(windows)]
async fn repair_local_agent_service() -> Result<AgentRepairInfo, String> {
    let service_name = find_agent_service()
        .map(|service| service.name)
        .unwrap_or_else(|| "TamanduaAgent".to_string());
    let repaired_path = repair_agent_service_config(&service_name)?;
    let start_result = start_agent_service().await?;
    Ok(AgentRepairInfo {
        success: true,
        service_name,
        agent_id: read_local_agent_id(),
        ipc_ready: crate::ipc::auth::can_read_token().await,
        message: repaired_path
            .map(|path| format!("Agent service command repaired to: {path}"))
            .unwrap_or(start_result.message),
    })
}

#[cfg(target_os = "macos")]
async fn repair_local_agent_service() -> Result<AgentRepairInfo, String> {
    let service_name = default_macos_service_name();
    let plist_path = macos_launchd_plist_path(&service_name);
    if !plist_path.exists() {
        return Err(
            "Tamandua Agent LaunchDaemon is not installed. Install/enroll the agent first."
                .to_string(),
        );
    }

    let bundled_agent = find_agent_executable().ok_or_else(|| {
        "Could not locate the bundled tamandua-agent binary in the macOS app resources.".to_string()
    })?;
    let installed_agent = PathBuf::from("/opt/tamandua/tamandua-agent");
    let label = macos_launchd_label(&service_name);

    let command_line = [
        format!(
            "launchctl bootout system/{} >/dev/null 2>&1 || true",
            shell_quote(&label)
        ),
        "mkdir -p /opt/tamandua".to_string(),
        format!(
            "if [ {} != {} ]; then /usr/bin/install -m 755 {} {}; fi",
            shell_quote(&bundled_agent.to_string_lossy()),
            shell_quote(&installed_agent.to_string_lossy()),
            shell_quote(&bundled_agent.to_string_lossy()),
            shell_quote(&installed_agent.to_string_lossy())
        ),
        format!(
            "launchctl bootstrap system {} >/dev/null 2>&1 || true",
            shell_quote(&plist_path.to_string_lossy())
        ),
        format!("launchctl kickstart -k system/{}", shell_quote(&label)),
    ]
    .join("; ");

    let output = run_macos_admin_shell(&command_line)
        .map_err(|e| format!("macOS administrator authorization failed: {}", e))?;
    let message = command_output_text(&output);

    if !output.status.success() {
        return Err(if message.is_empty() {
            format!("repair exited with {:?}", output.status.code())
        } else {
            message
        });
    }

    Ok(AgentRepairInfo {
        success: true,
        service_name,
        agent_id: read_local_agent_id(),
        ipc_ready: crate::ipc::auth::can_read_token().await,
        message: if message.is_empty() {
            "Agent LaunchDaemon repaired and restart requested.".to_string()
        } else {
            message
        },
    })
}

#[cfg(all(not(windows), not(target_os = "macos")))]
async fn repair_local_agent_service() -> Result<AgentRepairInfo, String> {
    Err(
        "Repairing the agent service from the GUI is not implemented for this platform."
            .to_string(),
    )
}

#[cfg(windows)]
#[derive(Debug, Clone)]
struct LocalServiceInfo {
    name: String,
    state: Option<String>,
    path: Option<String>,
}

#[cfg(windows)]
fn candidate_agent_service_names() -> &'static [&'static str] {
    &[
        "TamanduaAgent",
        "tamandua-agent",
        "tamandua_agent",
        "Tamandua EDR Agent",
    ]
}

#[cfg(windows)]
fn find_agent_service() -> Option<LocalServiceInfo> {
    for service_name in candidate_agent_service_names() {
        let query = hidden_command("sc.exe")
            .args(["query", service_name])
            .output()
            .ok()?;

        if !query.status.success() {
            if let Some(path) = query_service_binary_path_from_registry(service_name) {
                return Some(LocalServiceInfo {
                    name: (*service_name).to_string(),
                    state: if is_agent_process_running() {
                        Some("RUNNING".to_string())
                    } else {
                        Some("UNKNOWN".to_string())
                    },
                    path: Some(path),
                });
            }
            continue;
        }

        let stdout = String::from_utf8_lossy(&query.stdout);
        let state = stdout
            .lines()
            .find(|line| line.trim_start().starts_with("STATE"))
            .and_then(|line| {
                if line.contains("RUNNING") {
                    Some("RUNNING".to_string())
                } else if line.contains("STOPPED") {
                    Some("STOPPED".to_string())
                } else if line.contains("START_PENDING") {
                    Some("START_PENDING".to_string())
                } else if line.contains("STOP_PENDING") {
                    Some("STOP_PENDING".to_string())
                } else {
                    None
                }
            });

        let path = query_service_binary_path(service_name);

        return Some(LocalServiceInfo {
            name: (*service_name).to_string(),
            state,
            path,
        });
    }

    None
}

#[cfg(windows)]
fn query_service_binary_path(service_name: &str) -> Option<String> {
    hidden_command("sc.exe")
        .args(["qc", service_name])
        .output()
        .ok()
        .and_then(|out| {
            if !out.status.success() {
                return None;
            }
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .find(|line| line.contains("BINARY_PATH_NAME"))
                .and_then(|line| {
                    line.split_once(':')
                        .map(|(_, right)| right.trim().to_string())
                })
        })
}

#[cfg(windows)]
fn query_service_binary_path_from_registry(service_name: &str) -> Option<String> {
    hidden_command("reg.exe")
        .args([
            "query",
            &format!(r"HKLM\SYSTEM\CurrentControlSet\Services\{service_name}"),
            "/v",
            "ImagePath",
        ])
        .output()
        .ok()
        .and_then(|out| {
            if !out.status.success() {
                return None;
            }

            String::from_utf8_lossy(&out.stdout)
                .lines()
                .find(|line| line.contains("ImagePath"))
                .and_then(|line| {
                    let path = line
                        .split_whitespace()
                        .skip_while(|part| *part != "REG_EXPAND_SZ" && *part != "REG_SZ")
                        .skip(1)
                        .collect::<Vec<_>>()
                        .join(" ")
                        .trim()
                        .to_string();

                    if path.is_empty() {
                        None
                    } else {
                        Some(path)
                    }
                })
        })
}

#[cfg(windows)]
fn is_agent_process_running() -> bool {
    hidden_command("tasklist.exe")
        .args(["/FI", "IMAGENAME eq tamandua-agent.exe"])
        .output()
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stdout).contains("tamandua-agent.exe"))
        .unwrap_or(false)
}

#[cfg(windows)]
fn find_installed_agent_executable() -> Option<PathBuf> {
    let program_files = windows_program_files_dir()?;
    [
        program_files.join("Tamandua").join("tamandua-agent.exe"),
        program_files
            .join("Tamandua Agent")
            .join("tamandua-agent.exe"),
    ]
    .into_iter()
    .find(|path| path.exists())
}

#[cfg(windows)]
fn find_agent_executable() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(release_dir) = exe.parent() {
            candidates.push(
                release_dir
                    .join("tamandua-agent.exe")
                    .join("tamandua-agent.exe"),
            );
            candidates.push(release_dir.join("tamandua-agent.exe"));
            candidates.push(release_dir.join("resources").join("tamandua-agent.exe"));
            candidates.push(release_dir.join("resources").join("tamandua-agent"));
            candidates.push(release_dir.join("..").join("tamandua-agent.exe"));
            candidates.push(
                release_dir
                    .join("..")
                    .join("resources")
                    .join("tamandua-agent.exe"),
            );
            candidates.push(
                release_dir
                    .join("..")
                    .join("resources")
                    .join("tamandua-agent"),
            );
        }
    }

    if let Some(program_files) = windows_program_files_dir() {
        candidates.push(program_files.join("Tamandua").join("tamandua-agent.exe"));
        candidates.push(
            program_files
                .join("Tamandua Agent")
                .join("tamandua-agent.exe"),
        );
    }

    candidates.into_iter().find(|path| path.is_file())
}

#[cfg(windows)]
fn find_latest_agent_executable() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(release_dir) = exe.parent() {
            candidates.push(release_dir.join("tamandua-agent.exe"));
            candidates.push(release_dir.join("resources").join("tamandua-agent.exe"));
            candidates.push(release_dir.join("resources").join("tamandua-agent"));
            candidates.push(release_dir.join("..").join("tamandua-agent.exe"));
            candidates.push(
                release_dir
                    .join("..")
                    .join("resources")
                    .join("tamandua-agent.exe"),
            );
            candidates.push(
                release_dir
                    .join("..")
                    .join("resources")
                    .join("tamandua-agent"),
            );
        }
    }

    if let Some(program_files) = windows_program_files_dir() {
        candidates.push(program_files.join("Tamandua").join("tamandua-agent.exe"));
        candidates.push(
            program_files
                .join("Tamandua Agent")
                .join("tamandua-agent.exe"),
        );
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(
            cwd.join("apps")
                .join("tamandua_agent")
                .join("target")
                .join("release")
                .join("tamandua-agent.exe"),
        );
        candidates.push(
            cwd.join("..")
                .join("tamandua_agent")
                .join("target")
                .join("release")
                .join("tamandua-agent.exe"),
        );
    }

    candidates
        .into_iter()
        .filter(|path| path.is_file())
        .filter_map(|path| {
            let modified = std::fs::metadata(&path)
                .and_then(|meta| meta.modified())
                .ok()?;
            Some((modified, path))
        })
        .max_by_key(|(modified, _)| *modified)
        .map(|(_, path)| path)
}

#[cfg(target_os = "macos")]
fn find_agent_executable() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos_dir) = exe.parent() {
            candidates.push(macos_dir.join("../Resources/tamandua-agent/tamandua-agent"));
            candidates.push(macos_dir.join("../Resources/tamandua-agent"));
            candidates.push(macos_dir.join("tamandua-agent"));
            candidates.push(macos_dir.join(
                "../../../../tamandua_agent/target/aarch64-apple-darwin/release/tamandua-agent",
            ));
            candidates
                .push(macos_dir.join("../../../../tamandua_agent/target/release/tamandua-agent"));
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(
            cwd.join("../../tamandua_agent/target/aarch64-apple-darwin/release/tamandua-agent"),
        );
        candidates
            .push(cwd.join("../tamandua_agent/target/aarch64-apple-darwin/release/tamandua-agent"));
        candidates.push(
            cwd.join("apps/tamandua_agent/target/aarch64-apple-darwin/release/tamandua-agent"),
        );
    }

    candidates.push(PathBuf::from("/opt/tamandua/tamandua-agent"));
    candidates.push(PathBuf::from("/usr/local/bin/tamandua-agent"));

    candidates
        .into_iter()
        .map(|path| path.components().collect::<PathBuf>())
        .find(|path| path.is_file())
}

#[cfg(target_os = "macos")]
fn find_latest_agent_executable() -> Option<PathBuf> {
    find_agent_executable()
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn find_agent_executable() -> Option<PathBuf> {
    None
}

#[cfg(windows)]
fn stage_agent_installer_binary(agent_exe: &std::path::Path) -> Result<PathBuf, String> {
    let file_name = format!(
        "tamandua-agent-installer-{}-{}.exe",
        std::process::id(),
        chrono::Utc::now().timestamp_millis()
    );

    let mut staging_dirs = Vec::new();
    staging_dirs.push(
        windows_program_data_dir()
            .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
            .join("Tamandua")
            .join("installer"),
    );
    staging_dirs.push(std::env::temp_dir().join("Tamandua").join("installer"));

    let mut errors = Vec::new();

    for staging_dir in staging_dirs {
        if let Err(error) = std::fs::create_dir_all(&staging_dir) {
            errors.push(format!(
                "{}: create directory failed: {}",
                staging_dir.display(),
                error
            ));
            continue;
        }

        let staged = staging_dir.join(&file_name);
        match std::fs::copy(agent_exe, &staged) {
            Ok(_) => return Ok(staged),
            Err(error) => errors.push(format!(
                "{} -> {}: {}",
                agent_exe.display(),
                staged.display(),
                error
            )),
        }
    }

    Err(format!(
        "Failed to stage agent installer binary. Tried protected and user-temp staging paths. {}",
        errors.join(" | ")
    ))
}

#[cfg(windows)]
fn quote_windows_command_arg(value: &str) -> String {
    if value.is_empty() || value.contains(char::is_whitespace) || value.contains('"') {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

#[cfg(windows)]
fn windows_program_files_dir() -> Option<PathBuf> {
    std::env::var_os("ProgramFiles").map(PathBuf::from)
}

#[cfg(windows)]
fn windows_program_data_dir() -> Option<PathBuf> {
    std::env::var_os("ProgramData").map(PathBuf::from)
}

#[cfg(not(windows))]
fn windows_program_files_dir() -> Option<PathBuf> {
    None
}

#[cfg(not(windows))]
fn windows_program_data_dir() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "macos")]
fn default_macos_service_name() -> String {
    "TamanduaAgent".to_string()
}

#[cfg(target_os = "macos")]
fn macos_launchd_label(service_name: &str) -> String {
    format!("com.tamandua.{}", service_name.to_lowercase())
}

#[cfg(target_os = "macos")]
fn macos_launchd_plist_path(service_name: &str) -> PathBuf {
    PathBuf::from(format!(
        "/Library/LaunchDaemons/{}.plist",
        macos_launchd_label(service_name)
    ))
}

#[cfg(target_os = "macos")]
fn macos_service_state(service_name: &str) -> String {
    let label = macos_launchd_label(service_name);
    let output = hidden_command("launchctl")
        .args(["print", &format!("system/{}", label)])
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let text = String::from_utf8_lossy(&output.stdout);
            if text.contains("state = running") || text.contains("state = active") {
                "RUNNING".to_string()
            } else {
                "STOPPED".to_string()
            }
        }
        _ if macos_launchd_plist_path(service_name).exists() => "STOPPED".to_string(),
        _ => "UNKNOWN".to_string(),
    }
}

#[cfg(target_os = "macos")]
fn is_macos_agent_process_running() -> bool {
    hidden_command("pgrep")
        .args(["-x", "tamandua-agent"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn run_macos_admin_shell(command_line: &str) -> Result<std::process::Output, String> {
    let script = format!(
        "do shell script {} with administrator privileges",
        applescript_quote(command_line)
    );
    hidden_command("/usr/bin/osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn shell_join(args: &[String]) -> String {
    args.iter()
        .map(|arg| shell_quote(arg))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(target_os = "macos")]
fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(target_os = "macos")]
fn applescript_quote(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

const DEFAULT_UPDATE_CATALOG: &str = "https://tamandua.treantlab.org/api/v1/updates/manifest.json";

async fn get_component_update_status(
    catalog_url: Option<String>,
) -> Result<UpdateCenterStatus, String> {
    let source = catalog_url
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_UPDATE_CATALOG.to_string());

    let catalog_result = fetch_update_catalog(&source).await;
    let catalog = catalog_result.as_ref().ok();
    let catalog_error = catalog_result.as_ref().err().cloned();

    let mut components = vec![
        build_component_update_status(
            "gui",
            "Tamandua GUI",
            "desktop",
            Some(env!("CARGO_PKG_VERSION").to_string()),
            catalog,
            catalog_error.as_deref(),
        ),
        build_component_update_status(
            "agent",
            "Tamandua Agent",
            "service",
            local_agent_version(),
            catalog,
            catalog_error.as_deref(),
        ),
        build_component_update_status(
            "driver",
            "Kernel Driver",
            "driver",
            local_driver_version(),
            catalog,
            catalog_error.as_deref(),
        ),
        build_component_update_status(
            "ml",
            "ML Models",
            "model",
            local_component_manifest_version(&["models", "manifest.json"]),
            catalog,
            catalog_error.as_deref(),
        ),
        build_component_update_status(
            "rules",
            "Detection Rules",
            "content",
            local_component_manifest_version(&["rules", "manifest.json"]),
            catalog,
            catalog_error.as_deref(),
        ),
    ];

    if catalog.is_none() {
        for component in &mut components {
            component.status = "catalog_unavailable".to_string();
            component.error = catalog_error.clone();
        }
    }

    Ok(UpdateCenterStatus {
        source,
        checked_at: chrono::Utc::now().to_rfc3339(),
        components,
    })
}

async fn fetch_update_catalog(source: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create update client: {}", e))?;

    let response = client
        .get(source)
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Could not reach update catalog: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Update catalog returned HTTP {}", status));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Update catalog is not valid JSON: {}", e))
}

fn build_component_update_status(
    id: &str,
    name: &str,
    kind: &str,
    installed_version: Option<String>,
    catalog: Option<&serde_json::Value>,
    catalog_error: Option<&str>,
) -> ComponentUpdateStatus {
    let remote = catalog.and_then(|value| find_remote_component(value, id));
    let latest_version = remote
        .as_ref()
        .and_then(|value| json_string(value, &["version", "latest_version", "latest"]));
    let download_url = remote
        .as_ref()
        .and_then(|value| json_string(value, &["download_url", "url", "download", "artifact_url"]));
    let source_url = remote
        .as_ref()
        .and_then(|value| json_string(value, &["source_url", "manifest_url", "release_url"]));
    let sha256 = remote
        .as_ref()
        .and_then(|value| json_string(value, &["sha256", "checksum", "hash"]));
    let signature = remote
        .as_ref()
        .and_then(|value| json_string(value, &["signature", "sig"]));
    let update_available = installed_version
        .as_deref()
        .zip(latest_version.as_deref())
        .map(|(installed, latest)| {
            installed.trim_start_matches('v') != latest.trim_start_matches('v')
        })
        .unwrap_or(false);

    let status = if catalog_error.is_some() {
        "catalog_unavailable"
    } else if latest_version.is_none() {
        "not_published"
    } else if installed_version.is_none() {
        "not_installed"
    } else if update_available {
        "update_available"
    } else {
        "current"
    }
    .to_string();

    ComponentUpdateStatus {
        id: id.to_string(),
        name: name.to_string(),
        kind: kind.to_string(),
        installed_version,
        latest_version,
        update_available,
        status,
        source_url,
        download_url,
        sha256,
        signature,
        error: catalog_error.map(|value| value.to_string()),
    }
}

fn find_remote_component(catalog: &serde_json::Value, id: &str) -> Option<serde_json::Value> {
    if let Some(component) = catalog.get(id) {
        return Some(component.clone());
    }

    if let Some(components) = catalog.get("components") {
        if let Some(component) = components.get(id) {
            return Some(component.clone());
        }

        if let Some(list) = components.as_array() {
            return list
                .iter()
                .find(|item| {
                    json_string(item, &["id", "name", "component"])
                        .map(|value| value.eq_ignore_ascii_case(id))
                        .unwrap_or(false)
                })
                .cloned();
        }
    }

    None
}

fn json_string(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(|nested| nested.as_str())
            .map(|nested| nested.to_string())
    })
}

fn local_agent_version() -> Option<String> {
    #[cfg(windows)]
    {
        let exe = find_agent_executable()?;
        hidden_command(&exe)
            .arg("--version")
            .output()
            .ok()
            .and_then(|output| {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if text.is_empty() {
                    None
                } else {
                    Some(text.split_whitespace().last().unwrap_or(&text).to_string())
                }
            })
    }

    #[cfg(target_os = "macos")]
    {
        let exe = find_agent_executable()?;
        hidden_command(&exe)
            .arg("--version")
            .output()
            .ok()
            .and_then(|output| {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if text.is_empty() {
                    None
                } else {
                    Some(text.split_whitespace().last().unwrap_or(&text).to_string())
                }
            })
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        None
    }
}

fn local_driver_version() -> Option<String> {
    local_component_manifest_version(&["driver", "manifest.json"]).or_else(|| {
        windows_program_files_dir()
            .map(|dir| dir.join("Tamandua").join("driver").join("manifest.json"))
            .and_then(local_file_version)
    })
}

fn local_component_manifest_version(parts: &[&str]) -> Option<String> {
    let mut path = windows_program_data_dir()?.join("Tamandua");
    for part in parts {
        path.push(part);
    }
    local_file_version(path)
}

fn local_file_version(path: PathBuf) -> Option<String> {
    let contents = std::fs::read_to_string(path).ok()?;
    let json = serde_json::from_str::<serde_json::Value>(&contents).ok()?;
    json_string(&json, &["version", "latest_version"])
}

#[cfg(target_os = "macos")]
async fn start_agent_service() -> Result<AgentStartInfo, String> {
    let service_name = default_macos_service_name();
    let plist_path = macos_launchd_plist_path(&service_name);

    if !plist_path.exists() {
        return Err(
            "Tamandua Agent LaunchDaemon is not installed. Install/enroll the agent first."
                .to_string(),
        );
    }

    let label = macos_launchd_label(&service_name);
    let command_line = format!("launchctl kickstart -k system/{}", shell_quote(&label));
    let output = run_macos_admin_shell(&command_line)
        .map_err(|e| format!("macOS administrator authorization failed: {}", e))?;
    let message = command_output_text(&output);

    if !output.status.success() {
        return Err(if message.is_empty() {
            format!("launchctl exited with {:?}", output.status.code())
        } else {
            message
        });
    }

    Ok(AgentStartInfo {
        service_name,
        started: true,
        message: if message.is_empty() {
            "Agent LaunchDaemon start requested.".to_string()
        } else {
            message
        },
    })
}

#[cfg(all(not(windows), not(target_os = "macos")))]
async fn start_agent_service() -> Result<AgentStartInfo, String> {
    Err(
        "Starting the agent service from the GUI is currently implemented for Windows only."
            .to_string(),
    )
}
