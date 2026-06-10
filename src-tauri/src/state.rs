use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::auth::{
    AuditEvent, AuthConfig, AuthError, AuthManager, BiometricCapability, PasswordStrength, Session,
    SessionStatus, SetupStatus,
};
use crate::ipc::{
    AgentConfigUpdate, AgentMetrics, AgentStatus, AlertNotification, ComponentStatus, IpcClient,
    LogEntry, PerformanceProfile, QuarantineEntry, ResponseCommandResult,
};

/// Event notification for real-time updates
#[derive(Debug, Clone)]
pub enum EventNotification {
    StatusChanged(AgentStatus),
    Alert(AlertNotification),
    ComponentStatusChanged(ComponentStatus),
    ProfileChanged {
        old: PerformanceProfile,
        new: PerformanceProfile,
    },
    ConnectionStateChanged {
        connected: bool,
    },
}

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    /// IPC client for communicating with the agent (Named Pipe / Unix Socket)
    ipc_client: Arc<tokio::sync::RwLock<IpcClient>>,

    /// Event broadcast channel for real-time updates
    event_tx: broadcast::Sender<EventNotification>,

    /// Cached agent status
    cached_status: Arc<RwLock<Option<AgentStatus>>>,

    /// Cached component status
    cached_component_status: Arc<RwLock<Option<ComponentStatus>>>,

    /// Cached performance profile
    cached_profile: Arc<RwLock<Option<PerformanceProfile>>>,

    /// Authentication manager
    auth_manager: Arc<tokio::sync::RwLock<Option<AuthManager>>>,
}

impl AppState {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(100);

        Self {
            ipc_client: Arc::new(tokio::sync::RwLock::new(IpcClient::new())),
            event_tx,
            cached_status: Arc::new(RwLock::new(None)),
            cached_component_status: Arc::new(RwLock::new(None)),
            cached_profile: Arc::new(RwLock::new(None)),
            auth_manager: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    /// Initialize the authentication manager
    pub async fn init_auth(&self) -> Result<(), AuthError> {
        let manager = AuthManager::new().await?;
        let mut auth = self.auth_manager.write().await;
        *auth = Some(manager);
        info!("Authentication manager initialized");
        Ok(())
    }

    /// Get the authentication manager (initializing if needed)
    async fn get_auth_manager(
        &self,
    ) -> Result<impl std::ops::Deref<Target = AuthManager> + '_, AuthError> {
        debug!("get_auth_manager called");

        // Use write lock for atomic check-and-initialize to prevent race conditions
        {
            let mut auth = self.auth_manager.write().await;
            if auth.is_none() {
                debug!("Auth manager not initialized, initializing now...");
                match AuthManager::new().await {
                    Ok(manager) => {
                        *auth = Some(manager);
                        info!("Authentication manager initialized");
                    }
                    Err(e) => {
                        error!("Failed to initialize auth manager: {:?}", e);
                        return Err(e);
                    }
                }
            }
        }

        let guard = self.auth_manager.read().await;

        if guard.is_none() {
            error!("Auth manager still None after initialization");
            return Err(AuthError::Internal(
                "Auth manager not initialized".to_string(),
            ));
        }

        debug!("Auth manager acquired successfully");
        Ok(tokio::sync::RwLockReadGuard::map(guard, |opt| {
            opt.as_ref().unwrap()
        }))
    }

    /// Start the IPC client and connect to the agent
    pub async fn start_ipc_client(&self) -> Result<(), String> {
        info!("Starting IPC client (Named Pipe / Unix Socket)");

        let client = self.ipc_client.read().await;

        // Connect to agent
        if let Err(e) = client.connect().await {
            warn!(
                "Failed to connect to agent: {}. Will retry in background.",
                e
            );
        }

        // Start background reconnection and notification listener
        let ipc_client = self.ipc_client.clone();
        let event_tx = self.event_tx.clone();
        let cached_status = self.cached_status.clone();
        let cached_component_status = self.cached_component_status.clone();

        tokio::spawn(async move {
            loop {
                // Check connection state
                let client = ipc_client.read().await;
                let connected = client.is_connected().await;
                drop(client);

                if !connected {
                    debug!("IPC client not connected, attempting reconnection...");
                    let client = ipc_client.read().await;
                    if let Err(e) = client.connect().await {
                        warn!("Reconnection failed: {}. Retrying in 5s...", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                        continue;
                    }

                    // Try to authenticate
                    if let Err(e) = client.authenticate().await {
                        warn!("Authentication failed: {}. Will retry.", e);
                    }

                    let _ = event_tx
                        .send(EventNotification::ConnectionStateChanged { connected: true });
                }

                // Poll for status updates periodically
                {
                    let client = ipc_client.read().await;
                    if let Ok(status) = client.get_status().await {
                        let mut cached = cached_status.write();
                        let changed = cached.as_ref() != Some(&status);
                        *cached = Some(status.clone());
                        if changed {
                            let _ = event_tx.send(EventNotification::StatusChanged(status));
                        }
                    }

                    // Also poll component status
                    if let Ok(comp_status) = client.get_component_status().await {
                        let mut cached = cached_component_status.write();
                        *cached = Some(comp_status.clone());
                        let _ =
                            event_tx.send(EventNotification::ComponentStatusChanged(comp_status));
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        });

        info!("IPC client started successfully");
        Ok(())
    }

    /// Check if connected to agent
    pub async fn is_connected(&self) -> bool {
        let client = self.ipc_client.read().await;
        client.is_connected().await
    }

    /// Check if authenticated with agent
    pub async fn is_authenticated(&self) -> bool {
        let client = self.ipc_client.read().await;
        client.is_authenticated().await
    }

    /// Get agent status
    pub async fn get_status(&self) -> Result<AgentStatus, String> {
        // Status is intentionally fetched fresh. Enrollment can rewrite the
        // agent config while the GUI is open, and a permanent cache makes the
        // dashboard show stale agent IDs/backend state.
        let client = self.ipc_client.read().await;
        let status = client.get_status().await.map_err(|e| e.to_string())?;

        // Update cache
        {
            let mut cached = self.cached_status.write();
            *cached = Some(status.clone());
        }

        Ok(status)
    }

    /// Drop stale IPC/cache state after the service has been installed,
    /// restarted, or re-enrolled from the local setup flow.
    pub async fn refresh_agent_connection(&self) -> Result<AgentStatus, String> {
        {
            let mut cached = self.cached_status.write();
            *cached = None;
        }
        {
            let mut cached = self.cached_component_status.write();
            *cached = None;
        }

        let client = self.ipc_client.read().await;
        client.disconnect().await;
        client.connect().await.map_err(|e| e.to_string())?;
        client.authenticate().await.map_err(|e| e.to_string())?;
        let status = client.get_status().await.map_err(|e| e.to_string())?;

        {
            let mut cached = self.cached_status.write();
            *cached = Some(status.clone());
        }

        let _ = self
            .event_tx
            .send(EventNotification::StatusChanged(status.clone()));

        Ok(status)
    }

    /// Get agent metrics
    pub async fn get_metrics(&self) -> Result<AgentMetrics, String> {
        let client = self.ipc_client.read().await;
        client.get_metrics().await.map_err(|e| e.to_string())
    }

    /// Get component status (driver, collectors, backend, health)
    pub async fn get_component_status(&self) -> Result<ComponentStatus, String> {
        // Component status changes during enrollment/restart, so keep it live.
        let client = self.ipc_client.read().await;
        let status = client
            .get_component_status()
            .await
            .map_err(|e| e.to_string())?;

        // Update cache
        {
            let mut cached = self.cached_component_status.write();
            *cached = Some(status.clone());
        }

        Ok(status)
    }

    /// Get current performance profile
    pub async fn get_performance_profile(&self) -> Result<PerformanceProfile, String> {
        let client = self.ipc_client.read().await;
        let profile = client
            .get_performance_profile()
            .await
            .map_err(|e| e.to_string())?;

        // Update cache
        {
            let mut cached = self.cached_profile.write();
            *cached = Some(profile);
        }

        Ok(profile)
    }

    /// Set performance profile (requires authentication)
    pub async fn set_performance_profile(
        &self,
        profile: PerformanceProfile,
    ) -> Result<crate::commands::ProfileChangeResult, String> {
        let client = self.ipc_client.read().await;

        // Ensure authenticated
        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        // Get current profile from the agent before change. The cached value can
        // be stale after a config edit, restart, or tray action.
        let old_profile = client
            .get_performance_profile()
            .await
            .unwrap_or(PerformanceProfile::Balanced);

        client
            .set_performance_profile(profile)
            .await
            .map_err(|e| e.to_string())?;

        // Update cache
        {
            let mut cached = self.cached_profile.write();
            *cached = Some(profile);
        }

        // Determine affected collectors based on profile change
        let affected = Self::get_affected_collectors(old_profile, profile);

        Ok(crate::commands::ProfileChangeResult {
            old_profile: old_profile.as_str().to_string(),
            new_profile: profile.as_str().to_string(),
            collectors_affected: affected,
        })
    }

    /// Get collectors that will be affected by a profile change
    fn get_affected_collectors(old: PerformanceProfile, new: PerformanceProfile) -> Vec<String> {
        let old_collectors: std::collections::HashSet<_> =
            old.enabled_collectors().into_iter().collect();
        let new_collectors: std::collections::HashSet<_> =
            new.enabled_collectors().into_iter().collect();

        // Find collectors that will be enabled or disabled
        let mut affected = Vec::new();

        // Collectors being disabled
        for c in old_collectors.difference(&new_collectors) {
            affected.push(format!("{} (disabled)", c));
        }

        // Collectors being enabled
        for c in new_collectors.difference(&old_collectors) {
            affected.push(format!("{} (enabled)", c));
        }

        // If no specific collectors affected, note interval changes
        if affected.is_empty() {
            affected.push("Interval adjustments only".to_string());
        }

        affected
    }

    /// Get alerts with optional filter
    pub async fn get_alerts(
        &self,
        since: Option<chrono::DateTime<chrono::Utc>>,
        limit: Option<usize>,
    ) -> Result<Vec<AlertNotification>, String> {
        let client = self.ipc_client.read().await;
        client
            .get_alerts(since, limit)
            .await
            .map_err(|e| e.to_string())
    }

    /// Acknowledge an alert
    pub async fn acknowledge_alert(&self, alert_id: String) -> Result<(), String> {
        let client = self.ipc_client.read().await;
        client
            .acknowledge_alert(alert_id)
            .await
            .map_err(|e| e.to_string())
    }

    /// Start a scan
    pub async fn start_scan(
        &self,
        path: std::path::PathBuf,
        recursive: bool,
        scan_archives: bool,
    ) -> Result<(), String> {
        let client = self.ipc_client.read().await;

        // Ensure authenticated for write operations
        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client
            .start_scan(path, recursive, scan_archives)
            .await
            .map_err(|e| e.to_string())
    }

    /// Update agent configuration
    pub async fn update_config(&self, config: AgentConfigUpdate) -> Result<(), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client
            .update_config(config)
            .await
            .map_err(|e| e.to_string())
    }

    /// Kill a process
    pub async fn kill_process(&self, pid: u32) -> Result<(), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.kill_process(pid).await.map_err(|e| e.to_string())
    }

    async fn ensure_agent_authenticated(client: &IpcClient) -> Result<(), String> {
        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    /// Block an IP address through the privileged local agent.
    pub async fn block_ip(
        &self,
        ip: String,
        reason: Option<String>,
        direction: Option<String>,
    ) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client
            .block_ip(ip, reason, direction)
            .await
            .map_err(|e| e.to_string())
    }

    /// Unblock an IP address through the privileged local agent.
    pub async fn unblock_ip(
        &self,
        ip: String,
        reason: Option<String>,
        direction: Option<String>,
    ) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client
            .unblock_ip(ip, reason, direction)
            .await
            .map_err(|e| e.to_string())
    }

    /// Block a domain through the privileged local agent.
    pub async fn block_domain(
        &self,
        domain: String,
        reason: Option<String>,
    ) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client
            .block_domain(domain, reason)
            .await
            .map_err(|e| e.to_string())
    }

    /// Unblock a domain through the privileged local agent.
    pub async fn unblock_domain(
        &self,
        domain: String,
        reason: Option<String>,
    ) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client
            .unblock_domain(domain, reason)
            .await
            .map_err(|e| e.to_string())
    }

    /// List IP addresses blocked by the local agent.
    pub async fn list_blocked_ips(&self) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client.list_blocked_ips().await.map_err(|e| e.to_string())
    }

    /// List domains blocked by the local agent.
    pub async fn list_blocked_domains(&self) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client
            .list_blocked_domains()
            .await
            .map_err(|e| e.to_string())
    }

    /// Isolate host networking through the privileged local agent.
    pub async fn isolate_network(
        &self,
        allowed_ips: Option<Vec<String>>,
    ) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client
            .isolate_network(allowed_ips)
            .await
            .map_err(|e| e.to_string())
    }

    /// Restore host networking through the privileged local agent.
    pub async fn restore_network(&self) -> Result<ResponseCommandResult, String> {
        let client = self.ipc_client.read().await;
        Self::ensure_agent_authenticated(&client).await?;
        client.restore_network().await.map_err(|e| e.to_string())
    }

    /// Get quarantined files
    pub async fn get_quarantined_files(&self) -> Result<Vec<QuarantineEntry>, String> {
        let client = self.ipc_client.read().await;
        client
            .get_quarantined_files()
            .await
            .map_err(|e| e.to_string())
    }

    /// Get logs
    pub async fn get_logs(
        &self,
        since: Option<chrono::DateTime<chrono::Utc>>,
        level: Option<String>,
        limit: Option<usize>,
    ) -> Result<Vec<LogEntry>, String> {
        let client = self.ipc_client.read().await;
        client
            .get_logs(since, level, limit)
            .await
            .map_err(|e| e.to_string())
    }

    /// Test backend connection
    pub async fn test_backend_connection(&self) -> Result<(bool, Option<u64>), String> {
        let client = self.ipc_client.read().await;

        client
            .test_backend_connection()
            .await
            .map_err(|e| e.to_string())
    }

    // ========================================================================
    // Event History Methods
    // ========================================================================

    /// Get telemetry events with filtering
    pub async fn get_events(
        &self,
        event_types: Option<Vec<String>>,
        severities: Option<Vec<String>>,
        search: Option<String>,
        date_from: Option<chrono::DateTime<chrono::Utc>>,
        date_to: Option<chrono::DateTime<chrono::Utc>>,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> Result<Vec<crate::ipc::TelemetryEvent>, String> {
        let client = self.ipc_client.read().await;
        client
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
            .map_err(|e| e.to_string())
    }

    /// Get event statistics for dashboard
    pub async fn get_event_statistics(
        &self,
        date_from: Option<chrono::DateTime<chrono::Utc>>,
        date_to: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<crate::ipc::EventStatistics, String> {
        let client = self.ipc_client.read().await;
        client
            .get_event_statistics(date_from, date_to)
            .await
            .map_err(|e| e.to_string())
    }

    /// Get single event by ID
    pub async fn get_event(
        &self,
        event_id: String,
    ) -> Result<Option<crate::ipc::TelemetryEvent>, String> {
        let client = self.ipc_client.read().await;
        client.get_event(event_id).await.map_err(|e| e.to_string())
    }

    /// Get related events
    pub async fn get_related_events(
        &self,
        event_id: String,
    ) -> Result<Vec<crate::ipc::TelemetryEvent>, String> {
        let client = self.ipc_client.read().await;
        client
            .get_related_events(event_id)
            .await
            .map_err(|e| e.to_string())
    }

    /// Subscribe to real-time events
    pub fn subscribe_events(&self) -> broadcast::Receiver<EventNotification> {
        self.event_tx.subscribe()
    }

    // ========================================================================
    // Authentication Methods
    // ========================================================================

    /// Get authentication setup status
    pub async fn get_auth_status(&self) -> Result<SetupStatus, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.get_setup_status().await
    }

    /// Setup the initial password
    pub async fn setup_password(&self, password: &str) -> Result<(), AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.setup_password(password).await
    }

    /// Verify password and create a session
    pub async fn verify_password(&self, password: &str) -> Result<Session, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.verify_password(password).await
    }

    /// Change the master password
    pub async fn change_password(
        &self,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.change_password(current_password, new_password).await
    }

    /// Check password strength
    pub fn check_password_strength(&self, password: &str) -> PasswordStrength {
        crate::auth::PasswordPolicy::default().check_strength(password)
    }

    /// Check if biometric authentication is available
    pub async fn check_biometric_available(&self) -> Result<BiometricCapability, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.check_biometric_available().await
    }

    /// Authenticate using biometrics
    pub async fn authenticate_biometric(&self, reason: &str) -> Result<Session, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.authenticate_biometric(reason).await
    }

    /// Get session status
    pub async fn get_session_status(&self, token: &str) -> Result<SessionStatus, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.get_session_status(token).await
    }

    /// Validate session
    pub async fn validate_session(&self, token: &str, extend: bool) -> Result<bool, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.validate_session(token, extend).await
    }

    /// Check if authentication is required
    pub async fn require_auth(&self, token: &str, sensitive: bool) -> Result<(), AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.require_auth(token, sensitive).await
    }

    /// Logout
    pub async fn logout(&self, token: &str) -> Result<(), AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.logout(token).await
    }

    /// Emergency recovery
    pub async fn emergency_recovery(&self, recovery_token: &str) -> Result<(), AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.emergency_recovery(recovery_token).await
    }

    /// Get audit log
    pub async fn get_auth_audit_log(
        &self,
        limit: Option<usize>,
    ) -> Result<Vec<AuditEvent>, AuthError> {
        let auth = self.get_auth_manager().await?;
        auth.get_audit_log(limit).await
    }

    /// Get auth config
    pub async fn get_auth_config(&self) -> AuthConfig {
        match self.get_auth_manager().await {
            Ok(auth) => auth.get_config().await,
            Err(_) => AuthConfig::default(),
        }
    }

    /// Update auth config
    pub async fn update_auth_config(&self, config: AuthConfig) {
        if let Ok(auth) = self.get_auth_manager().await {
            auth.update_config(config).await;
        }
    }

    // ========================================================================
    // Update Methods
    // ========================================================================

    /// Check for software updates
    pub async fn check_for_updates(&self) -> Result<serde_json::Value, String> {
        let client = self.ipc_client.read().await;
        client.check_for_updates().await.map_err(|e| e.to_string())
    }

    /// Download available update
    pub async fn download_update(&self) -> Result<(), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.download_update().await.map_err(|e| e.to_string())
    }

    /// Install downloaded update
    pub async fn install_update(&self) -> Result<(), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.install_update().await.map_err(|e| e.to_string())
    }

    // ========================================================================
    // Driver Control Methods
    // ========================================================================

    /// Get detailed driver status
    pub async fn get_driver_status(&self) -> Result<crate::ipc::DriverStatusInfo, String> {
        let client = self.ipc_client.read().await;
        client.get_driver_status().await.map_err(|e| e.to_string())
    }

    /// Load the kernel driver (requires authentication)
    pub async fn load_driver(&self) -> Result<(bool, Option<String>), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.load_driver().await.map_err(|e| e.to_string())
    }

    /// Unload the kernel driver (requires authentication)
    pub async fn unload_driver(&self) -> Result<(bool, Option<String>), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.unload_driver().await.map_err(|e| e.to_string())
    }

    // ========================================================================
    // Agent Control Methods
    // ========================================================================

    /// Stop the agent (requires authentication)
    /// WARNING: This will terminate the IPC connection
    pub async fn stop_agent(&self) -> Result<(String, bool), String> {
        let client = self.ipc_client.read().await;

        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.stop_agent().await.map_err(|e| e.to_string())
    }

    /// Restart the agent (requires authentication)
    pub async fn restart_agent(&self) -> Result<(String, bool), String> {
        let client = self.ipc_client.read().await;

        if client.is_authenticated().await {
            client.disconnect().await;
        }
        if !client.is_connected().await {
            client.connect().await.map_err(|e| e.to_string())?;
        }
        if !client.is_authenticated().await {
            client.authenticate().await.map_err(|e| e.to_string())?;
        }

        client.restart_agent().await.map_err(|e| e.to_string())
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

// Implement PartialEq for AgentStatus to detect changes
impl PartialEq for AgentStatus {
    fn eq(&self, other: &Self) -> bool {
        self.agent_id == other.agent_id
            && self.state == other.state
            && self.backend_connected == other.backend_connected
            && self.protection_enabled == other.protection_enabled
    }
}
