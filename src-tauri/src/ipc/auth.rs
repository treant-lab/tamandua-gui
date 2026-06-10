//! IPC authentication for GUI client
//!
//! Reads the shared token from the protected location and provides
//! authentication support for both legacy (hash-based) and modern
//! (challenge-response) authentication protocols.
//!
//! ## Security Model
//!
//! The token file is protected with restrictive ACLs:
//! - Windows: SYSTEM + Administrators only
//! - Unix: 0600 permissions (owner only)
//!
//! **Important**: Windows still supports an elevated GUI recovery path. On macOS,
//! the GUI should remain unprivileged and privileged setup/start actions are
//! delegated through the macOS administrator authorization prompt.
//!
//! ## Authentication Protocol
//!
//! The modern challenge-response protocol prevents replay attacks:
//! 1. Client sends `RequestChallenge`
//! 2. Server returns `Challenge { nonce, timestamp }`
//! 3. Client computes HMAC-SHA256(nonce || timestamp, token_secret)
//! 4. Client sends `AuthenticateChallenge { response }`
//! 5. Server verifies and responds with `Authenticated` or `Error`

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tokio::fs;
use tracing::{debug, error, warn};

/// Authentication token structure (matches Agent's format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcToken {
    pub secret: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl IpcToken {
    /// Compute SHA256 hash of the token for legacy authentication
    pub fn hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.secret.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Get the raw secret for challenge-response authentication
    pub fn secret(&self) -> &str {
        &self.secret
    }
}

/// Token reader for GUI client
///
/// Handles loading and caching the IPC authentication token.
/// The token is stored in a protected location that requires
/// elevated privileges to read.
pub struct TokenReader {
    token: Option<IpcToken>,
}

impl TokenReader {
    /// Create a new token reader
    pub fn new() -> Self {
        Self { token: None }
    }

    /// Load token from the default path
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Token file does not exist
    /// - Insufficient permissions to read the file (GUI not running as admin)
    /// - Token file is malformed
    pub async fn load(&mut self) -> Result<()> {
        let path = Self::default_token_path();
        self.load_from(&path).await
    }

    /// Load token from a specific path
    ///
    /// # Errors
    ///
    /// Returns a detailed error if the token cannot be read. On Windows,
    /// access denied errors indicate the GUI needs to "Run as Administrator".
    pub async fn load_from(&mut self, path: &PathBuf) -> Result<()> {
        match fs::read_to_string(path).await {
            Ok(data) => {
                let token: IpcToken =
                    serde_json::from_str(&data).context("Failed to parse token file")?;

                debug!("Loaded IPC token from {}", path.display());
                self.token = Some(token);
                Ok(())
            }
            Err(e) => {
                // Provide helpful error messages for common issues
                let err_msg = if e.kind() == std::io::ErrorKind::NotFound {
                    format!(
                        "Token file not found at {}. Is the Tamandua Agent service installed and running?",
                        path.display()
                    )
                } else if e.kind() == std::io::ErrorKind::PermissionDenied {
                    #[cfg(windows)]
                    let hint = "The GUI must 'Run as Administrator' to authenticate with the Agent service.";
                    #[cfg(target_os = "macos")]
                    let hint = "Install or start the LaunchDaemon from Agent Setup so macOS can authorize the privileged agent without running the GUI as root.";
                    #[cfg(all(unix, not(target_os = "macos")))]
                    let hint = "The GUI must run with elevated privileges (sudo) to authenticate with the Agent service.";

                    format!(
                        "Permission denied reading token file: {}. {}",
                        path.display(),
                        hint
                    )
                } else {
                    format!("Failed to read token file {}: {}", path.display(), e)
                };

                error!("{}", err_msg);
                bail!("{}", err_msg)
            }
        }
    }

    /// Try to load token, returning None if not available
    pub async fn try_load(&mut self) -> Option<()> {
        match self.load().await {
            Ok(()) => Some(()),
            Err(e) => {
                warn!("Failed to load IPC token: {}", e);
                None
            }
        }
    }

    /// Get the token hash for legacy authentication
    ///
    /// **Deprecated**: Use `token_secret()` with challenge-response auth instead.
    pub fn token_hash(&self) -> Option<String> {
        self.token.as_ref().map(|t| t.hash())
    }

    /// Get the raw token secret for challenge-response authentication
    ///
    /// The secret is used to compute HMAC-SHA256(challenge, secret) for
    /// the challenge-response protocol.
    pub fn token_secret(&self) -> Option<&str> {
        self.token.as_ref().map(|t| t.secret())
    }

    /// Check if token is loaded
    pub fn is_loaded(&self) -> bool {
        self.token.is_some()
    }

    /// Get default token file path
    pub fn default_token_path() -> PathBuf {
        #[cfg(windows)]
        {
            std::env::var_os("ProgramData")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(r"\ProgramData"))
                .join("Tamandua")
                .join("ipc_token.json")
        }

        #[cfg(target_os = "macos")]
        {
            PathBuf::from("/Library/Application Support/Tamandua/ipc_token.json")
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            PathBuf::from("/var/lib/tamandua/ipc_token.json")
        }
    }

    /// Clear the loaded token
    pub fn clear(&mut self) {
        self.token = None;
    }
}

impl Default for TokenReader {
    fn default() -> Self {
        Self::new()
    }
}

/// Utility function to check if agent token file exists
pub async fn token_exists() -> bool {
    let path = TokenReader::default_token_path();
    fs::metadata(&path).await.is_ok()
}

/// Utility function to check if the token file is readable
///
/// This checks both existence and read permission. Returns false
/// if the GUI lacks sufficient privileges to read the token.
pub async fn can_read_token() -> bool {
    let path = TokenReader::default_token_path();
    fs::read_to_string(&path).await.is_ok()
}

/// Utility function to get token hash directly (legacy)
///
/// **Deprecated**: Use challenge-response auth instead.
pub async fn get_token_hash() -> Result<String> {
    let mut reader = TokenReader::new();
    reader.load().await?;
    reader
        .token_hash()
        .ok_or_else(|| anyhow::anyhow!("Token not loaded"))
}

/// Utility function to get token secret directly
pub async fn get_token_secret() -> Result<String> {
    let mut reader = TokenReader::new();
    reader.load().await?;
    reader
        .token_secret()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Token not loaded"))
}
