//! Audit logging for authentication events
//!
//! Comprehensive audit trail for security events:
//! - Login attempts (success/failure)
//! - Password changes
//! - Session lifecycle
//! - Biometric authentication
//! - Account lockouts

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::auth::AuthError;

/// Maximum number of audit entries to keep in memory
const MAX_MEMORY_ENTRIES: usize = 1000;

/// Maximum size of audit log file in bytes (5MB)
const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024;

/// Audit event types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    /// Initial password setup
    PasswordSetup,
    /// Password changed successfully
    PasswordChanged,
    /// Password change failed
    PasswordChangeFailed,
    /// Successful login with password
    LoginSuccess,
    /// Failed login attempt
    LoginFailed,
    /// User logged out
    Logout,
    /// Session created
    SessionCreated,
    /// Session expired
    SessionExpired,
    /// Session invalidated (manual logout)
    SessionInvalidated,
    /// Biometric authentication successful
    BiometricSuccess,
    /// Biometric authentication failed
    BiometricFailed,
    /// Biometric enrolled
    BiometricEnrolled,
    /// Account locked due to failed attempts
    AccountLocked,
    /// Account unlocked (timeout expired)
    AccountUnlocked,
    /// Emergency recovery initiated
    RecoverySuccess,
    /// Emergency recovery failed
    RecoveryFailed,
    /// Configuration changed
    ConfigChanged,
    /// Sensitive action performed
    SensitiveAction,
    /// Re-authentication required
    ReauthRequired,
}

impl AuditEventType {
    /// Get a human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            Self::PasswordSetup => "Password setup completed",
            Self::PasswordChanged => "Password changed",
            Self::PasswordChangeFailed => "Password change failed",
            Self::LoginSuccess => "Login successful",
            Self::LoginFailed => "Login failed",
            Self::Logout => "User logged out",
            Self::SessionCreated => "Session created",
            Self::SessionExpired => "Session expired",
            Self::SessionInvalidated => "Session invalidated",
            Self::BiometricSuccess => "Biometric authentication successful",
            Self::BiometricFailed => "Biometric authentication failed",
            Self::BiometricEnrolled => "Biometric enrolled",
            Self::AccountLocked => "Account locked",
            Self::AccountUnlocked => "Account unlocked",
            Self::RecoverySuccess => "Emergency recovery completed",
            Self::RecoveryFailed => "Emergency recovery failed",
            Self::ConfigChanged => "Configuration changed",
            Self::SensitiveAction => "Sensitive action performed",
            Self::ReauthRequired => "Re-authentication required",
        }
    }

    /// Check if this event type indicates a security concern
    pub fn is_security_concern(&self) -> bool {
        matches!(
            self,
            Self::LoginFailed
                | Self::BiometricFailed
                | Self::AccountLocked
                | Self::RecoveryFailed
                | Self::PasswordChangeFailed
        )
    }
}

/// Audit event record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Unique event identifier
    pub id: Uuid,
    /// Event timestamp
    pub timestamp: DateTime<Utc>,
    /// Event type
    pub event_type: AuditEventType,
    /// Whether the action was successful
    pub success: bool,
    /// Additional details
    pub details: Option<String>,
    /// Source IP (if applicable)
    pub source_ip: Option<String>,
    /// User agent or client info
    pub client_info: Option<String>,
}

impl AuditEvent {
    /// Create a new audit event
    pub fn new(event_type: AuditEventType, success: bool, details: Option<&str>) -> Self {
        Self {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            event_type,
            success,
            details: details.map(String::from),
            source_ip: None,
            client_info: Some(format!("Tamandua GUI v{}", env!("CARGO_PKG_VERSION"))),
        }
    }
}

/// Audit log manager
pub struct AuditLog {
    /// In-memory event buffer (ring buffer)
    events: VecDeque<AuditEvent>,
    /// Path to the audit log file
    log_path: PathBuf,
    /// Whether file logging is enabled
    file_logging_enabled: bool,
}

impl AuditLog {
    /// Create a new audit log
    pub async fn new() -> Result<Self, AuthError> {
        // Get log directory
        let log_dir = Self::get_log_directory()?;

        // Create directory if needed
        fs::create_dir_all(&log_dir).map_err(|e| {
            AuthError::Internal(format!("Cannot create audit log directory: {}", e))
        })?;

        let log_path = log_dir.join("auth_audit.log");

        let mut audit_log = Self {
            events: VecDeque::with_capacity(MAX_MEMORY_ENTRIES),
            log_path,
            file_logging_enabled: true,
        };

        // Load recent events from file
        audit_log.load_recent_events();

        info!("Audit log initialized at {:?}", audit_log.log_path);
        Ok(audit_log)
    }

    /// Log an authentication event
    pub fn log(&mut self, event_type: AuditEventType, success: bool, details: Option<&str>) {
        let event = AuditEvent::new(event_type, success, details);

        // Log to tracing
        if event.event_type.is_security_concern() {
            tracing::warn!(
                event_type = ?event.event_type,
                success = event.success,
                details = ?event.details,
                "Security event"
            );
        } else {
            tracing::info!(
                event_type = ?event.event_type,
                success = event.success,
                "Auth event"
            );
        }

        // Add to memory buffer
        self.events.push_back(event.clone());

        // Maintain max size
        while self.events.len() > MAX_MEMORY_ENTRIES {
            self.events.pop_front();
        }

        // Write to file
        if self.file_logging_enabled {
            self.write_to_file(&event);
        }
    }

    /// Get recent audit entries
    pub fn get_entries(&self, limit: Option<usize>) -> Vec<AuditEvent> {
        let limit = limit.unwrap_or(100).min(self.events.len());
        self.events.iter().rev().take(limit).cloned().collect()
    }

    /// Get entries by event type
    pub fn get_entries_by_type(&self, event_type: AuditEventType) -> Vec<AuditEvent> {
        self.events
            .iter()
            .filter(|e| e.event_type == event_type)
            .cloned()
            .collect()
    }

    /// Get failed authentication attempts in the last N minutes
    pub fn get_recent_failures(&self, minutes: i64) -> Vec<AuditEvent> {
        let cutoff = Utc::now() - chrono::Duration::minutes(minutes);

        self.events
            .iter()
            .filter(|e| !e.success && e.event_type.is_security_concern() && e.timestamp > cutoff)
            .cloned()
            .collect()
    }

    /// Get security events (failures and concerns)
    pub fn get_security_events(&self, limit: Option<usize>) -> Vec<AuditEvent> {
        let limit = limit.unwrap_or(50);

        self.events
            .iter()
            .filter(|e| e.event_type.is_security_concern())
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Export audit log to JSON
    pub fn export_json(&self) -> Result<String, AuthError> {
        let entries: Vec<&AuditEvent> = self.events.iter().collect();
        serde_json::to_string_pretty(&entries)
            .map_err(|e| AuthError::Internal(format!("Cannot serialize audit log: {}", e)))
    }

    /// Export audit log to CSV
    pub fn export_csv(&self) -> String {
        let mut csv = String::from("ID,Timestamp,EventType,Success,Details,SourceIP,ClientInfo\n");

        for event in &self.events {
            csv.push_str(&format!(
                "{},{},{:?},{},{},{},{}\n",
                event.id,
                event.timestamp.to_rfc3339(),
                event.event_type,
                event.success,
                event.details.as_deref().unwrap_or("").replace(',', ";"),
                event.source_ip.as_deref().unwrap_or(""),
                event.client_info.as_deref().unwrap_or("").replace(',', ";"),
            ));
        }

        csv
    }

    /// Clear in-memory audit log (file log is preserved)
    pub fn clear_memory(&mut self) {
        self.events.clear();
        debug!("In-memory audit log cleared");
    }

    // Private methods

    fn get_log_directory() -> Result<PathBuf, AuthError> {
        let base = if cfg!(target_os = "windows") {
            dirs::data_local_dir()
        } else if cfg!(target_os = "macos") {
            dirs::data_dir()
        } else {
            dirs::data_dir()
        };

        base.map(|p| p.join("Tamandua").join("logs"))
            .ok_or_else(|| AuthError::Internal("Cannot determine log directory".to_string()))
    }

    fn write_to_file(&self, event: &AuditEvent) {
        // Check file size and rotate if needed
        if let Ok(metadata) = fs::metadata(&self.log_path) {
            if metadata.len() > MAX_LOG_SIZE {
                self.rotate_log();
            }
        }

        // Write event as JSON line
        let json = match serde_json::to_string(event) {
            Ok(j) => j,
            Err(e) => {
                error!("Cannot serialize audit event: {}", e);
                return;
            }
        };

        match OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
        {
            Ok(mut file) => {
                if let Err(e) = writeln!(file, "{}", json) {
                    error!("Cannot write to audit log: {}", e);
                }
            }
            Err(e) => {
                error!("Cannot open audit log file: {}", e);
            }
        }
    }

    fn rotate_log(&self) {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let rotated_path = self.log_path.with_extension(format!("{}.log", timestamp));

        if let Err(e) = fs::rename(&self.log_path, &rotated_path) {
            error!("Cannot rotate audit log: {}", e);
        } else {
            info!("Rotated audit log to {:?}", rotated_path);
        }
    }

    fn load_recent_events(&mut self) {
        if !self.log_path.exists() {
            return;
        }

        let file = match fs::File::open(&self.log_path) {
            Ok(f) => f,
            Err(e) => {
                debug!("Cannot open audit log file: {}", e);
                return;
            }
        };

        let reader = BufReader::new(file);
        let mut events: Vec<AuditEvent> = Vec::new();

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(event) = serde_json::from_str::<AuditEvent>(&line) {
                    events.push(event);
                }
            }
        }

        // Keep only the most recent events
        let start = events.len().saturating_sub(MAX_MEMORY_ENTRIES);
        for event in events.into_iter().skip(start) {
            self.events.push_back(event);
        }

        debug!("Loaded {} events from audit log", self.events.len());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_audit_log_creation() {
        let audit = AuditLog::new().await;
        assert!(audit.is_ok());
    }

    #[tokio::test]
    async fn test_log_event() {
        let mut audit = AuditLog::new().await.unwrap();

        // Log some events
        audit.log(AuditEventType::LoginSuccess, true, None);
        audit.log(AuditEventType::LoginFailed, false, Some("Invalid password"));

        // Get entries
        let entries = audit.get_entries(Some(10));
        assert_eq!(entries.len(), 2);

        // Most recent should be first
        assert_eq!(entries[0].event_type, AuditEventType::LoginFailed);
        assert!(!entries[0].success);
    }

    #[tokio::test]
    async fn test_get_by_type() {
        let mut audit = AuditLog::new().await.unwrap();

        audit.log(AuditEventType::LoginSuccess, true, None);
        audit.log(AuditEventType::LoginFailed, false, None);
        audit.log(AuditEventType::LoginFailed, false, None);
        audit.log(AuditEventType::Logout, true, None);

        let failures = audit.get_entries_by_type(AuditEventType::LoginFailed);
        assert_eq!(failures.len(), 2);
    }

    #[tokio::test]
    async fn test_security_events() {
        let mut audit = AuditLog::new().await.unwrap();

        audit.log(AuditEventType::LoginSuccess, true, None);
        audit.log(AuditEventType::LoginFailed, false, None);
        audit.log(AuditEventType::AccountLocked, false, None);
        audit.log(AuditEventType::Logout, true, None);

        let security_events = audit.get_security_events(None);
        assert_eq!(security_events.len(), 2);
    }

    #[tokio::test]
    async fn test_recent_failures() {
        let mut audit = AuditLog::new().await.unwrap();

        audit.log(AuditEventType::LoginFailed, false, None);
        audit.log(AuditEventType::BiometricFailed, false, None);
        audit.log(AuditEventType::LoginSuccess, true, None);

        let failures = audit.get_recent_failures(5); // Last 5 minutes
        assert_eq!(failures.len(), 2);
    }

    #[tokio::test]
    async fn test_export_json() {
        let mut audit = AuditLog::new().await.unwrap();

        audit.log(AuditEventType::LoginSuccess, true, Some("Test login"));

        let json = audit.export_json().unwrap();
        assert!(json.contains("LoginSuccess"));
        assert!(json.contains("Test login"));
    }

    #[tokio::test]
    async fn test_export_csv() {
        let mut audit = AuditLog::new().await.unwrap();

        audit.log(AuditEventType::LoginSuccess, true, Some("Test"));

        let csv = audit.export_csv();
        assert!(csv.contains("ID,Timestamp"));
        assert!(csv.contains("LoginSuccess"));
    }

    #[test]
    fn test_event_type_descriptions() {
        assert!(!AuditEventType::LoginSuccess.description().is_empty());
        assert!(!AuditEventType::LoginFailed.description().is_empty());
    }

    #[test]
    fn test_security_concern_flags() {
        assert!(!AuditEventType::LoginSuccess.is_security_concern());
        assert!(AuditEventType::LoginFailed.is_security_concern());
        assert!(AuditEventType::AccountLocked.is_security_concern());
        assert!(!AuditEventType::Logout.is_security_concern());
    }

    #[tokio::test]
    async fn test_memory_limit() {
        let mut audit = AuditLog::new().await.unwrap();
        audit.file_logging_enabled = false; // Disable file logging for this test

        // Log more than MAX_MEMORY_ENTRIES
        for i in 0..(MAX_MEMORY_ENTRIES + 100) {
            audit.log(
                AuditEventType::LoginSuccess,
                true,
                Some(&format!("Test {}", i)),
            );
        }

        // Should be capped at MAX_MEMORY_ENTRIES
        assert!(audit.events.len() <= MAX_MEMORY_ENTRIES);
    }
}
