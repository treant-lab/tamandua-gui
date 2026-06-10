//! IPC client implementation
//!
//! Connects to the Agent service via Named Pipe (Windows) or Unix Socket (Linux/macOS).

use anyhow::{bail, Context, Result};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::task::JoinHandle;
use tracing::{debug, error, info, warn};

use super::auth::TokenReader;
use super::protocol::MessageFrame;
use super::{
    AgentConfigUpdate, AgentMetrics, AgentStatus, AlertNotification, ComponentStatus, IpcMessage,
    LogEntry, PerformanceProfile, QuarantineEntry, ResponseCommandResult, VersionInfo,
};

#[cfg(windows)]
use tokio::net::windows::named_pipe::ClientOptions;

#[cfg(unix)]
use tokio::net::UnixStream;

/// Connection state
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Authenticated,
    Error(String),
}

/// IPC client for GUI-to-Agent communication
pub struct IpcClient {
    #[cfg(windows)]
    stream: Arc<Mutex<Option<tokio::net::windows::named_pipe::NamedPipeClient>>>,

    #[cfg(unix)]
    stream: Arc<Mutex<Option<UnixStream>>>,

    token_reader: Arc<RwLock<TokenReader>>,
    state: Arc<RwLock<ConnectionState>>,
    notification_tx: mpsc::Sender<IpcMessage>,
    notification_rx: Arc<Mutex<mpsc::Receiver<IpcMessage>>>,
    authenticated: Arc<RwLock<bool>>,
}

impl IpcClient {
    /// Create a new IPC client (does not connect yet)
    pub fn new() -> Self {
        let (notification_tx, notification_rx) = mpsc::channel(100);

        Self {
            stream: Arc::new(Mutex::new(None)),
            token_reader: Arc::new(RwLock::new(TokenReader::new())),
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            notification_tx,
            notification_rx: Arc::new(Mutex::new(notification_rx)),
            authenticated: Arc::new(RwLock::new(false)),
        }
    }

    /// Connect to the IPC server
    pub async fn connect(&self) -> Result<()> {
        *self.state.write().await = ConnectionState::Connecting;

        #[cfg(windows)]
        {
            let client = Self::connect_windows().await?;
            *self.stream.lock().await = Some(client);
        }

        #[cfg(unix)]
        {
            let client = Self::connect_unix().await?;
            *self.stream.lock().await = Some(client);
        }

        *self.state.write().await = ConnectionState::Connected;
        info!("Connected to Agent IPC server");

        Ok(())
    }

    /// Connect to Windows named pipe
    #[cfg(windows)]
    async fn connect_windows() -> Result<tokio::net::windows::named_pipe::NamedPipeClient> {
        use super::PIPE_NAME;

        debug!("Connecting to IPC server at {}", PIPE_NAME);

        let mut retries = 0;
        let max_retries = 5;

        loop {
            match ClientOptions::new().open(PIPE_NAME) {
                Ok(client) => {
                    info!("Connected to IPC server");
                    return Ok(client);
                }
                Err(e) if retries < max_retries => {
                    let delay = Duration::from_millis(100 * (1 << retries));
                    warn!(
                        "Failed to connect to IPC server (attempt {}/{}): {}. Retrying in {:?}...",
                        retries + 1,
                        max_retries,
                        e,
                        delay
                    );
                    tokio::time::sleep(delay).await;
                    retries += 1;
                }
                Err(e) => {
                    bail!(
                        "Failed to connect to IPC server after {} attempts: {}",
                        max_retries,
                        e
                    );
                }
            }
        }
    }

    /// Connect to Unix domain socket
    #[cfg(unix)]
    async fn connect_unix() -> Result<UnixStream> {
        use super::SOCKET_PATH;

        debug!("Connecting to IPC server at {}", SOCKET_PATH);

        let mut retries = 0;
        let max_retries = 5;

        loop {
            match UnixStream::connect(SOCKET_PATH).await {
                Ok(stream) => {
                    info!("Connected to IPC server");
                    return Ok(stream);
                }
                Err(e) if retries < max_retries => {
                    let delay = Duration::from_millis(100 * (1 << retries));
                    warn!(
                        "Failed to connect to IPC server (attempt {}/{}): {}. Retrying in {:?}...",
                        retries + 1,
                        max_retries,
                        e,
                        delay
                    );
                    tokio::time::sleep(delay).await;
                    retries += 1;
                }
                Err(e) => {
                    bail!(
                        "Failed to connect to IPC server after {} attempts: {}",
                        max_retries,
                        e
                    );
                }
            }
        }
    }

    /// Authenticate with the agent using challenge-response protocol
    ///
    /// This method uses the modern challenge-response protocol which prevents
    /// replay attacks. The flow is:
    ///
    /// 1. Send `RequestChallenge` to the server
    /// 2. Receive `Challenge { nonce, timestamp }` from the server
    /// 3. Compute HMAC-SHA256(nonce || timestamp, token_secret)
    /// 4. Send `AuthenticateChallenge { response }` to the server
    /// 5. Receive `Authenticated` or `Error`
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Token file cannot be read (requires elevated privileges)
    /// - Challenge request fails
    /// - Authentication is rejected (wrong token, expired challenge, replay)
    pub async fn authenticate(&self) -> Result<()> {
        // Load token - this requires elevated privileges
        let mut token_reader = self.token_reader.write().await;
        token_reader.load().await?;

        let token_secret = token_reader
            .token_secret()
            .ok_or_else(|| anyhow::anyhow!("Token not loaded"))?
            .to_string();

        // Drop the write lock before making requests
        drop(token_reader);

        // Step 1: Request challenge from server
        debug!("Requesting authentication challenge from Agent");
        let challenge_response = self.request(IpcMessage::RequestChallenge).await?;

        // Step 2: Extract challenge
        let challenge = match challenge_response {
            IpcMessage::Challenge(c) => c,
            IpcMessage::Error { message, code } => {
                let err_msg = format!("Failed to get challenge: {} (code: {:?})", message, code);
                *self.state.write().await = ConnectionState::Error(err_msg.clone());
                bail!("{}", err_msg);
            }
            _ => bail!(
                "Unexpected response to challenge request: {:?}",
                challenge_response
            ),
        };

        debug!(
            "Received challenge: nonce={}, timestamp={}",
            challenge.nonce, challenge.timestamp
        );

        // Step 3: Compute response using HMAC-SHA256
        let response = super::ChallengeResponse::create(&challenge, &token_secret);

        // Step 4: Send response
        debug!("Sending challenge response");
        let auth_result = self
            .request(IpcMessage::AuthenticateChallenge { response })
            .await?;

        // Step 5: Check result
        match auth_result {
            IpcMessage::Authenticated => {
                *self.authenticated.write().await = true;
                *self.state.write().await = ConnectionState::Authenticated;
                info!("Authenticated with Agent via challenge-response");
                Ok(())
            }
            IpcMessage::Error { message, code } => {
                let err_msg = format!("Authentication failed: {} (code: {:?})", message, code);
                *self.state.write().await = ConnectionState::Error(err_msg.clone());
                bail!("{}", err_msg);
            }
            _ => bail!("Unexpected response to authentication: {:?}", auth_result),
        }
    }

    /// Check if connected
    pub async fn is_connected(&self) -> bool {
        let stream = self.stream.lock().await;
        stream.is_some()
    }

    /// Check if authenticated
    pub async fn is_authenticated(&self) -> bool {
        *self.authenticated.read().await
    }

    /// Get current connection state
    pub async fn state(&self) -> ConnectionState {
        self.state.read().await.clone()
    }

    /// Disconnect from the server
    pub async fn disconnect(&self) {
        *self.stream.lock().await = None;
        *self.authenticated.write().await = false;
        *self.state.write().await = ConnectionState::Disconnected;
        info!("Disconnected from Agent IPC server");
    }

    /// Send a message and wait for response
    pub async fn request(&self, message: IpcMessage) -> Result<IpcMessage> {
        let mut stream_guard = self.stream.lock().await;
        let stream = stream_guard
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("Not connected to IPC server"))?;

        // Send request
        MessageFrame::write(stream, &message)
            .await
            .context("Failed to send IPC request")?;

        // Read response
        let response = MessageFrame::read(stream)
            .await
            .context("Failed to read IPC response")?;

        Ok(response)
    }

    /// Send a message without waiting for response (fire-and-forget)
    pub async fn send(&self, message: IpcMessage) -> Result<()> {
        let mut stream_guard = self.stream.lock().await;
        let stream = stream_guard
            .as_mut()
            .ok_or_else(|| anyhow::anyhow!("Not connected to IPC server"))?;

        MessageFrame::write(stream, &message)
            .await
            .context("Failed to send IPC message")?;

        Ok(())
    }

    /// Start listening for server notifications
    pub fn start_notification_listener(self: Arc<Self>) -> JoinHandle<Result<()>> {
        tokio::spawn(async move {
            loop {
                let message = {
                    let mut stream_guard = self.stream.lock().await;
                    let stream = match stream_guard.as_mut() {
                        Some(s) => s,
                        None => {
                            warn!("No connection, stopping notification listener");
                            break;
                        }
                    };

                    match MessageFrame::read(stream).await {
                        Ok(msg) => msg,
                        Err(e) => {
                            error!("Failed to read notification: {}", e);
                            *self.state.write().await =
                                ConnectionState::Error(format!("Read error: {}", e));
                            break;
                        }
                    }
                };

                // Handle server-initiated messages
                if message.is_response() {
                    if let Err(e) = self.notification_tx.send(message).await {
                        warn!("Failed to forward notification: {}", e);
                    }
                } else {
                    warn!("Received unexpected request from server: {:?}", message);
                }
            }

            Ok(())
        })
    }

    /// Get a receiver for notifications
    pub async fn take_notification_receiver(&self) -> Option<mpsc::Receiver<IpcMessage>> {
        let mut rx = self.notification_rx.lock().await;
        // Create a new channel and swap
        let (new_tx, new_rx) = mpsc::channel(100);
        // Note: This is a simplified implementation
        // In production, use a proper broadcast channel
        Some(new_rx)
    }

    // ==================== Convenience methods ====================

    /// Get agent status
    pub async fn get_status(&self) -> Result<AgentStatus> {
        let response = self.request(IpcMessage::GetStatus).await?;
        match response {
            IpcMessage::StatusUpdate(status) => Ok(status),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get agent metrics
    pub async fn get_metrics(&self) -> Result<AgentMetrics> {
        let response = self.request(IpcMessage::GetMetrics).await?;
        match response {
            IpcMessage::MetricsUpdate(metrics) => Ok(metrics),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get component status (driver, collectors, backend, health)
    pub async fn get_component_status(&self) -> Result<ComponentStatus> {
        let response = self.request(IpcMessage::GetComponentStatus).await?;
        match response {
            IpcMessage::ComponentStatusUpdate(status) => Ok(status),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get current performance profile
    pub async fn get_performance_profile(&self) -> Result<PerformanceProfile> {
        let response = self.request(IpcMessage::GetPerformanceProfile).await?;
        match response {
            IpcMessage::PerformanceProfileResponse(profile) => Ok(profile),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Set performance profile (requires authentication)
    pub async fn set_performance_profile(&self, profile: PerformanceProfile) -> Result<()> {
        if !self.is_authenticated().await {
            bail!("Authentication required to change performance profile");
        }

        let response = self
            .request(IpcMessage::SetPerformanceProfile { profile })
            .await?;

        match response {
            IpcMessage::ProfileChanged { .. } | IpcMessage::Success => Ok(()),
            IpcMessage::Error { message, code } => {
                if code.as_deref() == Some("AUTH_REQUIRED") {
                    bail!("Authentication required");
                }
                bail!("Server error: {}", message);
            }
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get alerts
    pub async fn get_alerts(
        &self,
        since: Option<chrono::DateTime<chrono::Utc>>,
        limit: Option<usize>,
    ) -> Result<Vec<AlertNotification>> {
        let response = self.request(IpcMessage::GetAlerts { since, limit }).await?;
        match response {
            IpcMessage::Alerts(alerts) => Ok(alerts),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get logs
    pub async fn get_logs(
        &self,
        since: Option<chrono::DateTime<chrono::Utc>>,
        level: Option<String>,
        limit: Option<usize>,
    ) -> Result<Vec<LogEntry>> {
        let response = self
            .request(IpcMessage::GetLogs {
                since,
                level,
                limit,
            })
            .await?;
        match response {
            IpcMessage::LogEntries(logs) => Ok(logs),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Start scan
    pub async fn start_scan(
        &self,
        path: std::path::PathBuf,
        recursive: bool,
        scan_archives: bool,
    ) -> Result<()> {
        let response = self
            .request(IpcMessage::StartScan {
                path,
                recursive,
                scan_archives,
            })
            .await?;
        match response {
            IpcMessage::Success => Ok(()),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get version info
    pub async fn get_version(&self) -> Result<VersionInfo> {
        let response = self.request(IpcMessage::GetVersion).await?;
        match response {
            IpcMessage::VersionInfo(info) => Ok(info),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Update configuration
    pub async fn update_config(&self, config: AgentConfigUpdate) -> Result<()> {
        let response = self.request(IpcMessage::UpdateConfig { config }).await?;
        match response {
            IpcMessage::Success => Ok(()),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Kill process
    pub async fn kill_process(&self, pid: u32) -> Result<()> {
        let response = self.request(IpcMessage::KillProcess { pid }).await?;
        match response {
            IpcMessage::Success => Ok(()),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    async fn response_command(&self, message: IpcMessage) -> Result<ResponseCommandResult> {
        let response = self.request(message).await?;
        match response {
            IpcMessage::ResponseCommandResult(result) => Ok(result),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Block an IP address via the local agent.
    pub async fn block_ip(
        &self,
        ip: String,
        reason: Option<String>,
        direction: Option<String>,
    ) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::BlockIp {
            ip,
            reason,
            direction,
        })
        .await
    }

    /// Unblock an IP address via the local agent.
    pub async fn unblock_ip(
        &self,
        ip: String,
        reason: Option<String>,
        direction: Option<String>,
    ) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::UnblockIp {
            ip,
            reason,
            direction,
        })
        .await
    }

    /// Block a domain via the local agent.
    pub async fn block_domain(
        &self,
        domain: String,
        reason: Option<String>,
    ) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::BlockDomain { domain, reason })
            .await
    }

    /// Unblock a domain via the local agent.
    pub async fn unblock_domain(
        &self,
        domain: String,
        reason: Option<String>,
    ) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::UnblockDomain { domain, reason })
            .await
    }

    /// List locally blocked IP addresses.
    pub async fn list_blocked_ips(&self) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::ListBlockedIps).await
    }

    /// List locally blocked domains.
    pub async fn list_blocked_domains(&self) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::ListBlockedDomains).await
    }

    /// Isolate host networking via the local agent.
    pub async fn isolate_network(
        &self,
        allowed_ips: Option<Vec<String>>,
    ) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::IsolateNetwork { allowed_ips })
            .await
    }

    /// Restore host networking via the local agent.
    pub async fn restore_network(&self) -> Result<ResponseCommandResult> {
        self.response_command(IpcMessage::RestoreNetwork).await
    }

    /// Get quarantined files
    pub async fn get_quarantined_files(&self) -> Result<Vec<QuarantineEntry>> {
        let response = self.request(IpcMessage::GetQuarantinedFiles).await?;
        match response {
            IpcMessage::QuarantinedFiles(files) => Ok(files),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Test backend connection
    pub async fn test_backend_connection(&self) -> Result<(bool, Option<u64>)> {
        let response = self.request(IpcMessage::TestBackendConnection).await?;
        match response {
            IpcMessage::BackendTestResult {
                connected,
                latency_ms,
                ..
            } => Ok((connected, latency_ms)),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Acknowledge alert
    pub async fn acknowledge_alert(&self, alert_id: String) -> Result<()> {
        let response = self
            .request(IpcMessage::AcknowledgeAlert { alert_id })
            .await?;
        match response {
            IpcMessage::Success => Ok(()),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    // ==================== Update methods ====================

    /// Check for software updates
    pub async fn check_for_updates(&self) -> Result<serde_json::Value> {
        let response = self.request(IpcMessage::CheckForUpdates).await?;
        match response {
            IpcMessage::UpdateCheckResult {
                update_available,
                current_version,
                latest_version,
                release_notes,
                download_size,
            } => Ok(serde_json::json!({
                "update_available": update_available,
                "current_version": current_version,
                "latest_version": latest_version,
                "release_notes": release_notes,
                "download_size": download_size,
            })),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Download available update
    pub async fn download_update(&self) -> Result<()> {
        let response = self.request(IpcMessage::ApplyUpdate).await?;
        match response {
            IpcMessage::Success | IpcMessage::UpdateInstalling { .. } => Ok(()),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Install downloaded update
    pub async fn install_update(&self) -> Result<()> {
        let response = self.request(IpcMessage::ApplyUpdate).await?;
        match response {
            IpcMessage::Success | IpcMessage::UpdateReady { .. } => Ok(()),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    // ==================== Event History methods ====================

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
    ) -> Result<Vec<super::TelemetryEvent>> {
        let response = self
            .request(IpcMessage::GetEvents {
                event_types,
                severities,
                search,
                date_from,
                date_to,
                limit,
                offset,
            })
            .await?;
        match response {
            IpcMessage::Events(events) => Ok(events),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get event statistics for dashboard
    pub async fn get_event_statistics(
        &self,
        date_from: Option<chrono::DateTime<chrono::Utc>>,
        date_to: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<super::EventStatistics> {
        let response = self
            .request(IpcMessage::GetEventStatistics { date_from, date_to })
            .await?;
        match response {
            IpcMessage::EventStatisticsResponse(stats) => Ok(stats),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get single event by ID
    pub async fn get_event(&self, event_id: String) -> Result<Option<super::TelemetryEvent>> {
        let response = self.request(IpcMessage::GetEvent { event_id }).await?;
        match response {
            IpcMessage::Event(event) => Ok(event),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Get related events
    pub async fn get_related_events(&self, event_id: String) -> Result<Vec<super::TelemetryEvent>> {
        let response = self
            .request(IpcMessage::GetRelatedEvents { event_id })
            .await?;
        match response {
            IpcMessage::RelatedEvents(events) => Ok(events),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    // ==================== Driver Control methods ====================

    /// Get detailed driver status
    pub async fn get_driver_status(&self) -> Result<super::DriverStatusInfo> {
        let response = self.request(IpcMessage::GetDriverStatus).await?;
        match response {
            IpcMessage::DriverStatusResponse(info) => Ok(info),
            IpcMessage::Error { message, .. } => bail!("Server error: {}", message),
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Load the kernel driver (requires authentication)
    pub async fn load_driver(&self) -> Result<(bool, Option<String>)> {
        if !self.is_authenticated().await {
            bail!("Authentication required to load driver");
        }

        let response = self.request(IpcMessage::LoadDriver).await?;
        match response {
            IpcMessage::DriverOperationResult {
                success, message, ..
            } => Ok((success, message)),
            IpcMessage::Error { message, code } => {
                if code.as_deref() == Some("AUTH_REQUIRED") {
                    bail!("Authentication required");
                }
                bail!("Server error: {}", message);
            }
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Unload the kernel driver (requires authentication)
    pub async fn unload_driver(&self) -> Result<(bool, Option<String>)> {
        if !self.is_authenticated().await {
            bail!("Authentication required to unload driver");
        }

        let response = self.request(IpcMessage::UnloadDriver).await?;
        match response {
            IpcMessage::DriverOperationResult {
                success, message, ..
            } => Ok((success, message)),
            IpcMessage::Error { message, code } => {
                if code.as_deref() == Some("AUTH_REQUIRED") {
                    bail!("Authentication required");
                }
                bail!("Server error: {}", message);
            }
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    // ==================== Agent Control methods ====================

    /// Stop the agent (requires authentication)
    /// WARNING: This will terminate the IPC connection
    pub async fn stop_agent(&self) -> Result<(String, bool)> {
        if !self.is_authenticated().await {
            bail!("Authentication required to stop agent");
        }

        let response = self.request(IpcMessage::StopAgent).await?;
        match response {
            IpcMessage::AgentStopping {
                reason,
                restart_scheduled,
            } => Ok((reason, restart_scheduled)),
            IpcMessage::Error { message, code } => {
                if code.as_deref() == Some("AUTH_REQUIRED") {
                    bail!("Authentication required");
                }
                bail!("Server error: {}", message);
            }
            _ => bail!("Unexpected response: {:?}", response),
        }
    }

    /// Restart the agent (requires authentication)
    /// The agent will exit and Windows SCM will restart it
    pub async fn restart_agent(&self) -> Result<(String, bool)> {
        if !self.is_authenticated().await {
            bail!("Authentication required to restart agent");
        }

        let response = self.request(IpcMessage::RestartAgent).await?;
        match response {
            IpcMessage::AgentStopping {
                reason,
                restart_scheduled,
            } => Ok((reason, restart_scheduled)),
            IpcMessage::Error { message, code } => {
                if code.as_deref() == Some("AUTH_REQUIRED") {
                    bail!("Authentication required");
                }
                bail!("Server error: {}", message);
            }
            _ => bail!("Unexpected response: {:?}", response),
        }
    }
}

impl Default for IpcClient {
    fn default() -> Self {
        Self::new()
    }
}
