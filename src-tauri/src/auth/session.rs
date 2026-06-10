//! Session management with automatic timeout
//!
//! Provides secure session handling with:
//! - HMAC-SHA256 session tokens
//! - Configurable timeout (default: 15 minutes)
//! - Activity-based session extension
//! - Secure token generation

use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

/// Session token length in bytes (before base64 encoding)
const TOKEN_LENGTH: usize = 32;

/// Session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Unique session identifier
    pub id: Uuid,
    /// Session token (HMAC-SHA256 based)
    pub token: String,
    /// Session creation time
    pub created_at: DateTime<Utc>,
    /// Last activity time
    pub last_activity: DateTime<Utc>,
    /// Session expiration time
    pub expires_at: DateTime<Utc>,
}

/// Session status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStatus {
    /// Whether the session is valid
    pub valid: bool,
    /// Session creation time
    pub created_at: DateTime<Utc>,
    /// Last activity time
    pub last_activity: DateTime<Utc>,
    /// Session expiration time
    pub expires_at: DateTime<Utc>,
    /// Time remaining in seconds
    pub time_remaining_secs: i64,
    /// Whether the session is about to expire (< 2 minutes)
    pub expiring_soon: bool,
}

/// Session manager for handling session lifecycle
pub struct SessionManager {
    /// Active sessions indexed by token
    sessions: HashMap<String, SessionData>,
    /// HMAC secret key for token generation
    secret_key: [u8; 32],
    /// Session timeout in seconds
    timeout_secs: u64,
}

/// Internal session data
struct SessionData {
    id: Uuid,
    created_at: DateTime<Utc>,
    last_activity: DateTime<Utc>,
}

impl SessionManager {
    /// Create a new session manager with the specified timeout
    pub fn new(timeout_secs: u64) -> Self {
        // Generate a secure random secret key
        let mut secret_key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret_key);

        Self {
            sessions: HashMap::new(),
            secret_key,
            timeout_secs,
        }
    }

    /// Set the session timeout
    pub fn set_timeout(&mut self, timeout_secs: u64) {
        self.timeout_secs = timeout_secs;
    }

    /// Create a new session
    pub fn create_session(&mut self) -> Session {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let expires_at = now + Duration::seconds(self.timeout_secs as i64);

        // Generate token using HMAC-SHA256
        let token = self.generate_token(&id);

        // Store session data
        self.sessions.insert(
            token.clone(),
            SessionData {
                id,
                created_at: now,
                last_activity: now,
            },
        );

        // Clean up expired sessions periodically
        self.cleanup_expired();

        Session {
            id,
            token,
            created_at: now,
            last_activity: now,
            expires_at,
        }
    }

    /// Validate a session token
    ///
    /// Returns true if the session is valid and not expired.
    /// If `extend` is true, the session activity time is updated.
    pub fn validate_session(&mut self, token: &str, extend: bool) -> bool {
        let now = Utc::now();

        if let Some(session) = self.sessions.get_mut(token) {
            let timeout = Duration::seconds(self.timeout_secs as i64);
            let expires_at = session.last_activity + timeout;

            if now < expires_at {
                // Session is valid
                if extend {
                    session.last_activity = now;
                }
                return true;
            } else {
                // Session expired, remove it
                self.sessions.remove(token);
            }
        }

        false
    }

    /// Get session status
    pub fn get_session_status(&self, token: &str) -> Option<SessionStatus> {
        let now = Utc::now();

        self.sessions.get(token).map(|session| {
            let timeout = Duration::seconds(self.timeout_secs as i64);
            let expires_at = session.last_activity + timeout;
            let time_remaining = (expires_at - now).num_seconds().max(0);
            let valid = now < expires_at;

            SessionStatus {
                valid,
                created_at: session.created_at,
                last_activity: session.last_activity,
                expires_at,
                time_remaining_secs: time_remaining,
                expiring_soon: time_remaining < 120, // Less than 2 minutes
            }
        })
    }

    /// Invalidate a specific session
    pub fn invalidate_session(&mut self, token: &str) {
        self.sessions.remove(token);
    }

    /// Invalidate all sessions
    pub fn invalidate_all(&mut self) {
        self.sessions.clear();
    }

    /// Get the number of active sessions
    pub fn active_session_count(&self) -> usize {
        let now = Utc::now();
        let timeout = Duration::seconds(self.timeout_secs as i64);

        self.sessions
            .values()
            .filter(|s| now < s.last_activity + timeout)
            .count()
    }

    /// Generate a secure token using HMAC-SHA256
    fn generate_token(&self, session_id: &Uuid) -> String {
        // Generate random bytes
        let mut random_bytes = [0u8; TOKEN_LENGTH];
        rand::thread_rng().fill_bytes(&mut random_bytes);

        // Create HMAC
        let mut mac =
            HmacSha256::new_from_slice(&self.secret_key).expect("HMAC can take key of any size");

        // Include session ID and random bytes in the HMAC
        mac.update(session_id.as_bytes());
        mac.update(&random_bytes);
        mac.update(&Utc::now().timestamp().to_le_bytes());

        // Finalize and encode
        let result = mac.finalize();
        let code_bytes = result.into_bytes();

        // Combine random bytes and HMAC for the token
        let mut token_bytes = Vec::with_capacity(TOKEN_LENGTH + 32);
        token_bytes.extend_from_slice(&random_bytes);
        token_bytes.extend_from_slice(&code_bytes);

        // Base64 URL-safe encoding
        base64_url_encode(&token_bytes)
    }

    /// Remove expired sessions
    fn cleanup_expired(&mut self) {
        let now = Utc::now();
        let timeout = Duration::seconds(self.timeout_secs as i64);

        self.sessions
            .retain(|_, session| now < session.last_activity + timeout);
    }
}

/// Base64 URL-safe encoding (no padding)
fn base64_url_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    URL_SAFE_NO_PAD.encode(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration as StdDuration;

    #[test]
    fn test_session_creation() {
        let mut manager = SessionManager::new(900); // 15 minutes
        let session = manager.create_session();

        assert!(!session.token.is_empty());
        assert!(session.expires_at > session.created_at);
        assert!(session.last_activity == session.created_at);
    }

    #[test]
    fn test_session_validation() {
        let mut manager = SessionManager::new(900);
        let session = manager.create_session();

        // Session should be valid
        assert!(manager.validate_session(&session.token, false));

        // Invalid token should not be valid
        assert!(!manager.validate_session("invalid_token", false));
    }

    #[test]
    fn test_session_extension() {
        let mut manager = SessionManager::new(900);
        let session = manager.create_session();

        // Get initial last_activity
        let initial_status = manager.get_session_status(&session.token).unwrap();
        let initial_activity = initial_status.last_activity;

        // Wait a bit
        thread::sleep(StdDuration::from_millis(10));

        // Validate with extension
        manager.validate_session(&session.token, true);

        // Last activity should be updated
        let updated_status = manager.get_session_status(&session.token).unwrap();
        assert!(updated_status.last_activity >= initial_activity);
    }

    #[test]
    fn test_session_expiration() {
        // Very short timeout for testing
        let mut manager = SessionManager::new(1);
        let session = manager.create_session();

        // Session should be valid initially
        assert!(manager.validate_session(&session.token, false));

        // Wait for expiration
        thread::sleep(StdDuration::from_millis(1100));

        // Session should be expired
        assert!(!manager.validate_session(&session.token, false));
    }

    #[test]
    fn test_session_invalidation() {
        let mut manager = SessionManager::new(900);
        let session = manager.create_session();

        // Session should be valid
        assert!(manager.validate_session(&session.token, false));

        // Invalidate
        manager.invalidate_session(&session.token);

        // Session should no longer be valid
        assert!(!manager.validate_session(&session.token, false));
    }

    #[test]
    fn test_invalidate_all() {
        let mut manager = SessionManager::new(900);

        // Create multiple sessions
        let session1 = manager.create_session();
        let session2 = manager.create_session();
        let session3 = manager.create_session();

        // All should be valid
        assert!(manager.validate_session(&session1.token, false));
        assert!(manager.validate_session(&session2.token, false));
        assert!(manager.validate_session(&session3.token, false));
        assert_eq!(manager.active_session_count(), 3);

        // Invalidate all
        manager.invalidate_all();

        // None should be valid
        assert!(!manager.validate_session(&session1.token, false));
        assert!(!manager.validate_session(&session2.token, false));
        assert!(!manager.validate_session(&session3.token, false));
        assert_eq!(manager.active_session_count(), 0);
    }

    #[test]
    fn test_session_status() {
        let mut manager = SessionManager::new(900);
        let session = manager.create_session();

        let status = manager.get_session_status(&session.token).unwrap();

        assert!(status.valid);
        assert!(status.time_remaining_secs > 0);
        assert!(status.time_remaining_secs <= 900);
        assert!(!status.expiring_soon); // Should not be expiring soon
    }

    #[test]
    fn test_token_uniqueness() {
        let mut manager = SessionManager::new(900);

        let session1 = manager.create_session();
        let session2 = manager.create_session();
        let session3 = manager.create_session();

        // All tokens should be unique
        assert_ne!(session1.token, session2.token);
        assert_ne!(session2.token, session3.token);
        assert_ne!(session1.token, session3.token);
    }

    #[test]
    fn test_timeout_update() {
        let mut manager = SessionManager::new(900);

        // Create session with 15 min timeout
        let session = manager.create_session();
        let initial_status = manager.get_session_status(&session.token).unwrap();
        assert!(initial_status.time_remaining_secs > 800);

        // Update timeout to 1 second
        manager.set_timeout(1);

        // Create new session
        let new_session = manager.create_session();
        let new_status = manager.get_session_status(&new_session.token).unwrap();
        assert!(new_status.time_remaining_secs <= 1);
    }

    #[test]
    fn test_cleanup_expired() {
        let mut manager = SessionManager::new(1);

        // Create sessions
        let _session1 = manager.create_session();
        let _session2 = manager.create_session();

        assert_eq!(manager.active_session_count(), 2);

        // Wait for expiration
        thread::sleep(StdDuration::from_millis(1100));

        // Creating a new session triggers cleanup
        let _session3 = manager.create_session();

        // Only the new session should be active
        assert_eq!(manager.active_session_count(), 1);
    }
}
