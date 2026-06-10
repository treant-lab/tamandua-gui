//! Authentication module for Tamandua EDR GUI
//!
//! Provides secure local authentication with:
//! - Password-based authentication (Argon2id)
//! - Platform-native credential storage (DPAPI/Keychain/libsecret)
//! - Biometric authentication (Windows Hello/Touch ID)
//! - Session management with automatic timeout
//! - Comprehensive audit logging

mod audit;
mod biometric;
mod credential_store;
mod password;
mod session;

pub use audit::{AuditEvent, AuditEventType, AuditLog};
pub use biometric::{BiometricAuth, BiometricCapability, BiometricMethod};
pub use credential_store::CredentialStore;
pub use password::{PasswordHasher, PasswordPolicy, PasswordStrength};
pub use session::{Session, SessionManager, SessionStatus};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Authentication errors
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid password")]
    InvalidPassword,

    #[error("Password does not meet policy requirements: {0}")]
    PasswordPolicyViolation(String),

    #[error("Session expired")]
    SessionExpired,

    #[error("Session not found")]
    SessionNotFound,

    #[error("Authentication required")]
    AuthenticationRequired,

    #[error("Biometric authentication failed: {0}")]
    BiometricFailed(String),

    #[error("Biometric not available: {0}")]
    BiometricNotAvailable(String),

    #[error("Credential storage error: {0}")]
    CredentialStoreError(String),

    #[error("First-time setup required")]
    SetupRequired,

    #[error("Already set up")]
    AlreadySetUp,

    #[error("Invalid recovery token")]
    InvalidRecoveryToken,

    #[error("Account locked: too many failed attempts")]
    AccountLocked,

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<AuthError> for String {
    fn from(err: AuthError) -> String {
        err.to_string()
    }
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Session timeout in seconds (default: 15 minutes)
    pub session_timeout_secs: u64,

    /// Maximum failed login attempts before lockout
    pub max_failed_attempts: u32,

    /// Lockout duration in seconds after max failed attempts
    pub lockout_duration_secs: u64,

    /// Whether biometric authentication is enabled
    pub biometric_enabled: bool,

    /// Whether to require re-auth for sensitive actions
    pub require_reauth_for_sensitive: bool,

    /// Sensitive action re-auth timeout in seconds
    pub sensitive_action_timeout_secs: u64,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            session_timeout_secs: 15 * 60, // 15 minutes
            max_failed_attempts: 5,
            lockout_duration_secs: 5 * 60, // 5 minutes
            biometric_enabled: true,
            require_reauth_for_sensitive: true,
            sensitive_action_timeout_secs: 5 * 60, // 5 minutes
        }
    }
}

/// Setup status for the authentication system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SetupStatus {
    /// First run - no password set
    NotConfigured,
    /// Password is set, ready to authenticate
    Configured,
    /// Account is locked due to failed attempts
    Locked { unlock_at: DateTime<Utc> },
}

/// Authentication manager - the main entry point for all auth operations
pub struct AuthManager {
    /// Password hasher
    password_hasher: PasswordHasher,

    /// Credential store for platform-native storage
    credential_store: CredentialStore,

    /// Biometric authentication handler
    biometric: BiometricAuth,

    /// Session manager
    session_manager: Arc<RwLock<SessionManager>>,

    /// Audit log
    audit_log: Arc<RwLock<AuditLog>>,

    /// Configuration
    config: Arc<RwLock<AuthConfig>>,

    /// Failed login attempts counter
    failed_attempts: Arc<RwLock<u32>>,

    /// Lockout end time (if locked)
    lockout_until: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl AuthManager {
    /// Create a new authentication manager
    pub async fn new() -> Result<Self, AuthError> {
        info!("Creating AuthManager...");

        let credential_store = match CredentialStore::new() {
            Ok(store) => {
                debug!("CredentialStore created successfully");
                store
            }
            Err(e) => {
                error!("Failed to create CredentialStore: {:?}", e);
                return Err(e);
            }
        };

        let biometric = BiometricAuth::new();
        debug!("BiometricAuth created");

        let session_manager = SessionManager::new(15 * 60); // 15 minute timeout
        debug!("SessionManager created");

        let audit_log = match AuditLog::new().await {
            Ok(log) => {
                debug!("AuditLog created successfully");
                log
            }
            Err(e) => {
                error!("Failed to create AuditLog: {:?}", e);
                return Err(e);
            }
        };

        info!("AuthManager created successfully");
        Ok(Self {
            password_hasher: PasswordHasher::new(),
            credential_store,
            biometric,
            session_manager: Arc::new(RwLock::new(session_manager)),
            audit_log: Arc::new(RwLock::new(audit_log)),
            config: Arc::new(RwLock::new(AuthConfig::default())),
            failed_attempts: Arc::new(RwLock::new(0)),
            lockout_until: Arc::new(RwLock::new(None)),
        })
    }

    /// Check the setup status
    pub async fn get_setup_status(&self) -> Result<SetupStatus, AuthError> {
        // Check if locked
        {
            let lockout = self.lockout_until.read().await;
            if let Some(unlock_at) = *lockout {
                if Utc::now() < unlock_at {
                    return Ok(SetupStatus::Locked { unlock_at });
                }
            }
        }

        // Check if password hash exists
        if self.credential_store.has_password_hash()? {
            Ok(SetupStatus::Configured)
        } else {
            Ok(SetupStatus::NotConfigured)
        }
    }

    /// First-time setup: set the master password
    pub async fn setup_password(&self, password: &str) -> Result<(), AuthError> {
        info!("Starting password setup...");

        // Verify not already set up
        match self.credential_store.has_password_hash() {
            Ok(true) => {
                warn!("Password already set up");
                return Err(AuthError::AlreadySetUp);
            }
            Ok(false) => {
                debug!("No existing password hash found, proceeding with setup");
            }
            Err(e) => {
                error!("Error checking existing password hash: {:?}", e);
                return Err(e);
            }
        }

        // Validate password policy
        let policy = PasswordPolicy::default();
        if let Err(e) = policy.validate(password) {
            warn!("Password policy validation failed: {:?}", e);
            return Err(e);
        }
        debug!("Password policy validation passed");

        // Hash password with Argon2id
        let hash = match self.password_hasher.hash(password) {
            Ok(h) => {
                debug!("Password hashed successfully");
                h
            }
            Err(e) => {
                error!("Password hashing failed: {:?}", e);
                return Err(e);
            }
        };

        // Store securely
        if let Err(e) = self.credential_store.store_password_hash(&hash) {
            error!("Failed to store password hash: {:?}", e);
            return Err(e);
        }
        debug!("Password hash stored successfully");

        // Log the event
        self.log_event(AuditEventType::PasswordSetup, true, None)
            .await;

        info!("Initial password setup completed");
        Ok(())
    }

    /// Verify the master password and create a session
    pub async fn verify_password(&self, password: &str) -> Result<Session, AuthError> {
        // Check if locked out
        self.check_lockout().await?;

        // Get stored hash
        let stored_hash = self
            .credential_store
            .get_password_hash()?
            .ok_or(AuthError::SetupRequired)?;

        // Verify password
        if !self.password_hasher.verify(password, &stored_hash)? {
            self.handle_failed_attempt().await;
            self.log_event(AuditEventType::LoginFailed, false, Some("Invalid password"))
                .await;
            return Err(AuthError::InvalidPassword);
        }

        // Reset failed attempts on success
        {
            let mut attempts = self.failed_attempts.write().await;
            *attempts = 0;
        }

        // Create session
        let session = {
            let mut session_mgr = self.session_manager.write().await;
            session_mgr.create_session()
        };

        self.log_event(AuditEventType::LoginSuccess, true, None)
            .await;
        info!("User authenticated successfully");

        Ok(session)
    }

    /// Change the master password
    pub async fn change_password(
        &self,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), AuthError> {
        // Verify current password
        let stored_hash = self
            .credential_store
            .get_password_hash()?
            .ok_or(AuthError::SetupRequired)?;

        if !self
            .password_hasher
            .verify(current_password, &stored_hash)?
        {
            self.log_event(
                AuditEventType::PasswordChangeFailed,
                false,
                Some("Invalid current password"),
            )
            .await;
            return Err(AuthError::InvalidPassword);
        }

        // Validate new password policy
        let policy = PasswordPolicy::default();
        policy.validate(new_password)?;

        // Hash new password
        let new_hash = self.password_hasher.hash(new_password)?;

        // Store new hash
        self.credential_store.store_password_hash(&new_hash)?;

        // Invalidate all sessions
        {
            let mut session_mgr = self.session_manager.write().await;
            session_mgr.invalidate_all();
        }

        self.log_event(AuditEventType::PasswordChanged, true, None)
            .await;
        info!("Password changed successfully");

        Ok(())
    }

    /// Check if biometric authentication is available
    pub async fn check_biometric_available(&self) -> Result<BiometricCapability, AuthError> {
        let config = self.config.read().await;
        if !config.biometric_enabled {
            return Ok(BiometricCapability {
                available: false,
                method: None,
                reason: Some("Biometric authentication is disabled".to_string()),
            });
        }

        Ok(self.biometric.check_availability())
    }

    /// Authenticate using biometrics
    pub async fn authenticate_biometric(&self, reason: &str) -> Result<Session, AuthError> {
        // Check if locked out
        self.check_lockout().await?;

        // Check if setup is complete
        if !self.credential_store.has_password_hash()? {
            return Err(AuthError::SetupRequired);
        }

        // Check if biometric is enabled
        let config = self.config.read().await;
        if !config.biometric_enabled {
            return Err(AuthError::BiometricNotAvailable(
                "Biometric authentication is disabled".to_string(),
            ));
        }
        drop(config);

        // Perform biometric authentication
        match self.biometric.authenticate(reason).await {
            Ok(true) => {
                // Create session
                let session = {
                    let mut session_mgr = self.session_manager.write().await;
                    session_mgr.create_session()
                };

                self.log_event(AuditEventType::BiometricSuccess, true, None)
                    .await;
                info!("Biometric authentication successful");

                Ok(session)
            }
            Ok(false) => {
                self.handle_failed_attempt().await;
                self.log_event(
                    AuditEventType::BiometricFailed,
                    false,
                    Some("Authentication failed"),
                )
                .await;
                Err(AuthError::BiometricFailed(
                    "Authentication rejected".to_string(),
                ))
            }
            Err(e) => {
                self.log_event(AuditEventType::BiometricFailed, false, Some(&e.to_string()))
                    .await;
                Err(e)
            }
        }
    }

    /// Get current session status
    pub async fn get_session_status(&self, token: &str) -> Result<SessionStatus, AuthError> {
        let session_mgr = self.session_manager.read().await;
        session_mgr
            .get_session_status(token)
            .ok_or(AuthError::SessionNotFound)
    }

    /// Validate session and optionally touch to extend
    pub async fn validate_session(&self, token: &str, extend: bool) -> Result<bool, AuthError> {
        let mut session_mgr = self.session_manager.write().await;
        Ok(session_mgr.validate_session(token, extend))
    }

    /// Check if authentication is required for an action
    pub async fn require_auth(&self, token: &str, sensitive: bool) -> Result<(), AuthError> {
        let config = self.config.read().await;

        // Validate session exists and is active
        let mut session_mgr = self.session_manager.write().await;

        if !session_mgr.validate_session(token, !sensitive) {
            return Err(AuthError::SessionExpired);
        }

        // For sensitive actions, check the shorter timeout
        if sensitive && config.require_reauth_for_sensitive {
            let status = session_mgr
                .get_session_status(token)
                .ok_or(AuthError::SessionNotFound)?;

            let sensitive_timeout =
                chrono::Duration::seconds(config.sensitive_action_timeout_secs as i64);
            if Utc::now() - status.last_activity > sensitive_timeout {
                return Err(AuthError::AuthenticationRequired);
            }
        }

        Ok(())
    }

    /// Logout and invalidate the session
    pub async fn logout(&self, token: &str) -> Result<(), AuthError> {
        let mut session_mgr = self.session_manager.write().await;
        session_mgr.invalidate_session(token);

        self.log_event(AuditEventType::Logout, true, None).await;
        info!("User logged out");

        Ok(())
    }

    /// Emergency recovery using server admin token
    pub async fn emergency_recovery(&self, recovery_token: &str) -> Result<(), AuthError> {
        // Validate recovery token (in production, this would verify against server)
        if !self.validate_recovery_token(recovery_token).await {
            self.log_event(
                AuditEventType::RecoveryFailed,
                false,
                Some("Invalid recovery token"),
            )
            .await;
            return Err(AuthError::InvalidRecoveryToken);
        }

        // Clear credentials to allow re-setup
        self.credential_store.clear_all()?;

        // Reset lockout
        {
            let mut lockout = self.lockout_until.write().await;
            *lockout = None;
        }

        // Reset failed attempts
        {
            let mut attempts = self.failed_attempts.write().await;
            *attempts = 0;
        }

        // Invalidate all sessions
        {
            let mut session_mgr = self.session_manager.write().await;
            session_mgr.invalidate_all();
        }

        self.log_event(AuditEventType::RecoverySuccess, true, None)
            .await;
        warn!("Emergency recovery completed - password reset required");

        Ok(())
    }

    /// Get audit log entries
    pub async fn get_audit_log(&self, limit: Option<usize>) -> Result<Vec<AuditEvent>, AuthError> {
        let audit = self.audit_log.read().await;
        Ok(audit.get_entries(limit))
    }

    /// Update authentication configuration
    pub async fn update_config(&self, new_config: AuthConfig) {
        let mut config = self.config.write().await;
        *config = new_config.clone();

        // Update session manager timeout
        let mut session_mgr = self.session_manager.write().await;
        session_mgr.set_timeout(new_config.session_timeout_secs);

        debug!("Auth config updated");
    }

    /// Get current configuration
    pub async fn get_config(&self) -> AuthConfig {
        let config = self.config.read().await;
        config.clone()
    }

    /// Check password strength without setting it
    pub fn check_password_strength(&self, password: &str) -> PasswordStrength {
        PasswordPolicy::default().check_strength(password)
    }

    // Private helper methods

    async fn check_lockout(&self) -> Result<(), AuthError> {
        let lockout = self.lockout_until.read().await;
        if let Some(unlock_at) = *lockout {
            if Utc::now() < unlock_at {
                return Err(AuthError::AccountLocked);
            }
        }
        Ok(())
    }

    async fn handle_failed_attempt(&self) {
        let config = self.config.read().await;
        let max_attempts = config.max_failed_attempts;
        let lockout_duration = config.lockout_duration_secs;
        drop(config);

        let mut attempts = self.failed_attempts.write().await;
        *attempts += 1;

        if *attempts >= max_attempts {
            let unlock_at = Utc::now() + chrono::Duration::seconds(lockout_duration as i64);
            let mut lockout = self.lockout_until.write().await;
            *lockout = Some(unlock_at);

            self.log_event(
                AuditEventType::AccountLocked,
                false,
                Some(&format!(
                    "Too many failed attempts, locked until {}",
                    unlock_at
                )),
            )
            .await;

            warn!(
                "Account locked after {} failed attempts, unlock at {}",
                max_attempts, unlock_at
            );
        }
    }

    async fn validate_recovery_token(&self, token: &str) -> bool {
        if token.is_empty() || token.len() < 32 {
            return false;
        }

        if std::env::var("TAMANDUA_ALLOW_LOCAL_RECOVERY_TOKEN").as_deref() == Ok("1") {
            warn!("Using development-only local recovery token validation");
            return token.len() >= 64
                && token
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '=');
        }

        error!("Emergency recovery token rejected: server-side validation is not configured");
        false
    }

    async fn log_event(&self, event_type: AuditEventType, success: bool, details: Option<&str>) {
        let mut audit = self.audit_log.write().await;
        audit.log(event_type, success, details);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_auth_manager_creation() {
        let manager = AuthManager::new().await;
        assert!(manager.is_ok());
    }

    #[tokio::test]
    async fn test_initial_setup_status() {
        let manager = AuthManager::new().await.unwrap();
        let status = manager.get_setup_status().await.unwrap();
        // In test mode, credential store is in-memory, so should be NotConfigured
        assert_eq!(status, SetupStatus::NotConfigured);
    }

    #[tokio::test]
    async fn test_password_setup_and_verify() {
        let manager = AuthManager::new().await.unwrap();

        // Setup password
        let result = manager.setup_password("SecureP@ss123!").await;
        assert!(result.is_ok());

        // Verify correct password
        let session = manager.verify_password("SecureP@ss123!").await;
        assert!(session.is_ok());

        // Verify incorrect password
        let result = manager.verify_password("WrongPassword").await;
        assert!(matches!(result, Err(AuthError::InvalidPassword)));
    }

    #[tokio::test]
    async fn test_weak_password_rejected() {
        let manager = AuthManager::new().await.unwrap();

        // Try to set weak password
        let result = manager.setup_password("weak").await;
        assert!(matches!(result, Err(AuthError::PasswordPolicyViolation(_))));
    }

    #[tokio::test]
    async fn test_session_management() {
        let manager = AuthManager::new().await.unwrap();

        // Setup and login
        manager.setup_password("SecureP@ss123!").await.unwrap();
        let session = manager.verify_password("SecureP@ss123!").await.unwrap();

        // Check session is valid
        let is_valid = manager
            .validate_session(&session.token, false)
            .await
            .unwrap();
        assert!(is_valid);

        // Logout
        manager.logout(&session.token).await.unwrap();

        // Session should be invalid after logout
        let is_valid = manager
            .validate_session(&session.token, false)
            .await
            .unwrap();
        assert!(!is_valid);
    }

    #[tokio::test]
    async fn test_password_change() {
        let manager = AuthManager::new().await.unwrap();

        // Setup initial password
        manager.setup_password("SecureP@ss123!").await.unwrap();

        // Change password
        let result = manager
            .change_password("SecureP@ss123!", "NewSecureP@ss456!")
            .await;
        assert!(result.is_ok());

        // Old password should fail
        let result = manager.verify_password("SecureP@ss123!").await;
        assert!(matches!(result, Err(AuthError::InvalidPassword)));

        // New password should work
        let result = manager.verify_password("NewSecureP@ss456!").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lockout_after_failed_attempts() {
        let manager = AuthManager::new().await.unwrap();

        // Setup password
        manager.setup_password("SecureP@ss123!").await.unwrap();

        // Configure for quick lockout in tests
        manager
            .update_config(AuthConfig {
                max_failed_attempts: 3,
                lockout_duration_secs: 60,
                ..Default::default()
            })
            .await;

        // Fail 3 times
        for _ in 0..3 {
            let _ = manager.verify_password("WrongPassword").await;
        }

        // Should be locked out
        let result = manager.verify_password("SecureP@ss123!").await;
        assert!(matches!(result, Err(AuthError::AccountLocked)));
    }
}
