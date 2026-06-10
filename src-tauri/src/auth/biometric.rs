//! Biometric authentication support
//!
//! Platform-specific biometric authentication:
//! - Windows: Windows Hello (via WebAuthn or WinRT)
//! - macOS: Touch ID (via LocalAuthentication framework)
//! - Linux: Not supported (no standard API)

use crate::auth::AuthError;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

/// Biometric authentication method
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BiometricMethod {
    /// Windows Hello (face, fingerprint, or PIN)
    WindowsHello,
    /// macOS Touch ID
    TouchId,
    /// macOS Face ID (not available on Mac, but included for completeness)
    FaceId,
    /// Generic fingerprint
    Fingerprint,
}

impl std::fmt::Display for BiometricMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::WindowsHello => write!(f, "Windows Hello"),
            Self::TouchId => write!(f, "Touch ID"),
            Self::FaceId => write!(f, "Face ID"),
            Self::Fingerprint => write!(f, "Fingerprint"),
        }
    }
}

/// Biometric capability information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiometricCapability {
    /// Whether biometric authentication is available
    pub available: bool,
    /// The specific method available (if any)
    pub method: Option<BiometricMethod>,
    /// Reason if not available
    pub reason: Option<String>,
}

/// Biometric authentication handler
pub struct BiometricAuth {
    #[cfg(target_os = "windows")]
    inner: windows_impl::WindowsHelloAuth,
    #[cfg(target_os = "macos")]
    inner: macos_impl::TouchIdAuth,
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    inner: fallback_impl::FallbackAuth,
}

impl BiometricAuth {
    /// Create a new biometric authentication handler
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "windows")]
            inner: windows_impl::WindowsHelloAuth::new(),
            #[cfg(target_os = "macos")]
            inner: macos_impl::TouchIdAuth::new(),
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            inner: fallback_impl::FallbackAuth::new(),
        }
    }

    /// Check if biometric authentication is available
    pub fn check_availability(&self) -> BiometricCapability {
        self.inner.check_availability()
    }

    /// Perform biometric authentication
    pub async fn authenticate(&self, reason: &str) -> Result<bool, AuthError> {
        self.inner.authenticate(reason).await
    }

    /// Enroll biometric authentication (if supported)
    pub async fn enroll(&self) -> Result<(), AuthError> {
        self.inner.enroll().await
    }
}

impl Default for BiometricAuth {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Windows Hello implementation
// ============================================================================

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::*;
    use windows::Foundation::IAsyncOperation;
    use windows::Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    };

    pub struct WindowsHelloAuth;

    impl WindowsHelloAuth {
        pub fn new() -> Self {
            Self
        }

        pub fn check_availability(&self) -> BiometricCapability {
            match Self::check_hello_availability_sync() {
                Ok(available) => {
                    if available {
                        BiometricCapability {
                            available: true,
                            method: Some(BiometricMethod::WindowsHello),
                            reason: None,
                        }
                    } else {
                        BiometricCapability {
                            available: false,
                            method: None,
                            reason: Some(
                                "Windows Hello is not configured on this device".to_string(),
                            ),
                        }
                    }
                }
                Err(e) => BiometricCapability {
                    available: false,
                    method: None,
                    reason: Some(format!("Cannot check Windows Hello availability: {}", e)),
                },
            }
        }

        pub async fn authenticate(&self, reason: &str) -> Result<bool, AuthError> {
            info!("Starting Windows Hello authentication");

            // Check availability first
            if !Self::check_hello_availability_sync()
                .map_err(|e| AuthError::BiometricFailed(e.to_string()))?
            {
                return Err(AuthError::BiometricNotAvailable(
                    "Windows Hello is not configured".to_string(),
                ));
            }

            // Perform authentication
            let result = Self::verify_user_consent_sync(reason)
                .map_err(|e| AuthError::BiometricFailed(format!("Authentication failed: {}", e)))?;

            match result {
                UserConsentVerificationResult::Verified => {
                    info!("Windows Hello authentication successful");
                    Ok(true)
                }
                UserConsentVerificationResult::DeviceNotPresent => {
                    warn!("Windows Hello device not present");
                    Err(AuthError::BiometricNotAvailable(
                        "Biometric device not present".to_string(),
                    ))
                }
                UserConsentVerificationResult::NotConfiguredForUser => {
                    warn!("Windows Hello not configured for user");
                    Err(AuthError::BiometricNotAvailable(
                        "Windows Hello not configured".to_string(),
                    ))
                }
                UserConsentVerificationResult::DisabledByPolicy => {
                    warn!("Windows Hello disabled by policy");
                    Err(AuthError::BiometricNotAvailable(
                        "Disabled by system policy".to_string(),
                    ))
                }
                UserConsentVerificationResult::Canceled => {
                    debug!("Windows Hello authentication canceled");
                    Ok(false)
                }
                UserConsentVerificationResult::RetriesExhausted => {
                    warn!("Windows Hello retries exhausted");
                    Ok(false)
                }
                _ => {
                    warn!("Windows Hello authentication failed with unknown result");
                    Ok(false)
                }
            }
        }

        pub async fn enroll(&self) -> Result<(), AuthError> {
            // Windows Hello enrollment is managed by the OS
            // We just need to verify it's available
            if Self::check_hello_availability_sync()
                .map_err(|e| AuthError::BiometricFailed(e.to_string()))?
            {
                Ok(())
            } else {
                Err(AuthError::BiometricNotAvailable(
                    "Please configure Windows Hello in Windows Settings".to_string(),
                ))
            }
        }

        fn check_hello_availability_sync() -> windows::core::Result<bool> {
            let op: IAsyncOperation<UserConsentVerifierAvailability> =
                UserConsentVerifier::CheckAvailabilityAsync()?;

            // Block on the async operation
            let availability = op.get()?;

            Ok(availability == UserConsentVerifierAvailability::Available)
        }

        fn verify_user_consent_sync(
            message: &str,
        ) -> windows::core::Result<UserConsentVerificationResult> {
            let message = windows::core::HSTRING::from(message);
            let op: IAsyncOperation<UserConsentVerificationResult> =
                UserConsentVerifier::RequestVerificationAsync(&message)?;

            // Block on the async operation
            op.get()
        }
    }
}

// ============================================================================
// macOS Touch ID implementation
// ============================================================================

#[cfg(target_os = "macos")]
mod macos_impl {
    use super::*;
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use std::ffi::CStr;

    pub struct TouchIdAuth;

    impl TouchIdAuth {
        pub fn new() -> Self {
            Self
        }

        pub fn check_availability(&self) -> BiometricCapability {
            if std::env::var_os("TAMANDUA_ENABLE_UNSAFE_MACOS_BIOMETRIC").is_none() {
                return BiometricCapability {
                    available: false,
                    method: None,
                    reason: Some(
                        "macOS biometric authentication is disabled until the LocalAuthentication bridge is hardened."
                            .to_string(),
                    ),
                };
            }

            unsafe {
                // Create LAContext
                let la_context_class = class!(LAContext);
                let context: *mut Object = msg_send![la_context_class, alloc];
                let context: *mut Object = msg_send![context, init];

                if context.is_null() {
                    return BiometricCapability {
                        available: false,
                        method: None,
                        reason: Some("Cannot initialize LocalAuthentication".to_string()),
                    };
                }

                // Check if biometry is available
                let mut error: *mut Object = std::ptr::null_mut();
                let policy = 1i64; // LAPolicyDeviceOwnerAuthenticationWithBiometrics
                let can_evaluate: bool =
                    msg_send![context, canEvaluatePolicy:policy error:&mut error];

                if can_evaluate {
                    // Check biometry type
                    let biometry_type: i64 = msg_send![context, biometryType];
                    let _: () = msg_send![context, release];
                    let method = match biometry_type {
                        1 => Some(BiometricMethod::TouchId),
                        2 => Some(BiometricMethod::FaceId),
                        _ => Some(BiometricMethod::Fingerprint),
                    };

                    BiometricCapability {
                        available: true,
                        method,
                        reason: None,
                    }
                } else {
                    let reason = if !error.is_null() {
                        let description: *mut Object = msg_send![error, localizedDescription];
                        let cstr: *const i8 = msg_send![description, UTF8String];
                        if !cstr.is_null() {
                            CStr::from_ptr(cstr).to_string_lossy().to_string()
                        } else {
                            "Unknown error".to_string()
                        }
                    } else {
                        "Biometric authentication not available".to_string()
                    };
                    let _: () = msg_send![context, release];

                    BiometricCapability {
                        available: false,
                        method: None,
                        reason: Some(reason),
                    }
                }
            }
        }

        pub async fn authenticate(&self, reason: &str) -> Result<bool, AuthError> {
            info!("Starting Touch ID authentication");

            // Check availability first
            let capability = self.check_availability();
            if !capability.available {
                return Err(AuthError::BiometricNotAvailable(
                    capability
                        .reason
                        .unwrap_or_else(|| "Not available".to_string()),
                ));
            }

            // Perform authentication using LocalAuthentication framework
            let result = Self::evaluate_policy(reason)?;

            if result {
                info!("Touch ID authentication successful");
            } else {
                debug!("Touch ID authentication failed or canceled");
            }

            Ok(result)
        }

        pub async fn enroll(&self) -> Result<(), AuthError> {
            // Touch ID enrollment is managed by the OS
            let capability = self.check_availability();
            if capability.available {
                Ok(())
            } else {
                Err(AuthError::BiometricNotAvailable(
                    "Please configure Touch ID in System Preferences".to_string(),
                ))
            }
        }

        fn evaluate_policy(reason: &str) -> Result<bool, AuthError> {
            use std::sync::mpsc;

            unsafe {
                let la_context_class = class!(LAContext);
                let context: *mut Object = msg_send![la_context_class, alloc];
                let context: *mut Object = msg_send![context, init];

                if context.is_null() {
                    return Err(AuthError::BiometricFailed(
                        "Cannot initialize LocalAuthentication".to_string(),
                    ));
                }

                // Create the reason string
                let reason_nsstring: *mut Object = msg_send![class!(NSString), alloc];
                let reason_nsstring: *mut Object =
                    msg_send![reason_nsstring, initWithUTF8String:reason.as_ptr()];

                // Use a channel to get the result from the callback
                let (tx, rx) = mpsc::channel::<(bool, Option<String>)>();

                let policy = 1i64; // LAPolicyDeviceOwnerAuthenticationWithBiometrics

                // Create a block for the callback
                // Note: This is simplified; in production, use block2 crate
                let tx_clone = tx.clone();
                let callback = move |success: bool, error: *mut Object| {
                    let error_msg = if !error.is_null() && !success {
                        let description: *mut Object = msg_send![error, localizedDescription];
                        let cstr: *const i8 = msg_send![description, UTF8String];
                        if !cstr.is_null() {
                            Some(CStr::from_ptr(cstr).to_string_lossy().to_string())
                        } else {
                            None
                        }
                    } else {
                        None
                    };
                    let _ = tx_clone.send((success, error_msg));
                };

                // Evaluate the policy
                let _: () = msg_send![context, evaluatePolicy:policy
                    localizedReason:reason_nsstring
                    reply:callback];

                // Wait for result
                match rx.recv_timeout(std::time::Duration::from_secs(60)) {
                    Ok((success, error_msg)) => {
                        let _: () = msg_send![context, release];
                        let _: () = msg_send![reason_nsstring, release];

                        if let Some(error) = error_msg {
                            if !success {
                                debug!("Touch ID error: {}", error);
                            }
                        }

                        Ok(success)
                    }
                    Err(_) => {
                        let _: () = msg_send![context, release];
                        let _: () = msg_send![reason_nsstring, release];
                        Err(AuthError::BiometricFailed(
                            "Authentication timed out".to_string(),
                        ))
                    }
                }
            }
        }
    }
}

// ============================================================================
// Fallback implementation for unsupported platforms
// ============================================================================

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod fallback_impl {
    use super::*;

    pub struct FallbackAuth;

    impl FallbackAuth {
        pub fn new() -> Self {
            Self
        }

        pub fn check_availability(&self) -> BiometricCapability {
            BiometricCapability {
                available: false,
                method: None,
                reason: Some(
                    "Biometric authentication is not supported on this platform".to_string(),
                ),
            }
        }

        pub async fn authenticate(&self, _reason: &str) -> Result<bool, AuthError> {
            Err(AuthError::BiometricNotAvailable(
                "Biometric authentication is not supported on this platform".to_string(),
            ))
        }

        pub async fn enroll(&self) -> Result<(), AuthError> {
            Err(AuthError::BiometricNotAvailable(
                "Biometric authentication is not supported on this platform".to_string(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_biometric_auth_creation() {
        let auth = BiometricAuth::new();
        let _capability = auth.check_availability();
        // Just verify it doesn't panic
    }

    #[test]
    fn test_biometric_method_display() {
        assert_eq!(
            format!("{}", BiometricMethod::WindowsHello),
            "Windows Hello"
        );
        assert_eq!(format!("{}", BiometricMethod::TouchId), "Touch ID");
        assert_eq!(format!("{}", BiometricMethod::FaceId), "Face ID");
        assert_eq!(format!("{}", BiometricMethod::Fingerprint), "Fingerprint");
    }

    #[tokio::test]
    async fn test_unavailable_platform_auth() {
        // On platforms without biometric support, authentication should fail gracefully
        let auth = BiometricAuth::new();
        let capability = auth.check_availability();

        if !capability.available {
            let result = auth.authenticate("Test authentication").await;
            assert!(matches!(result, Err(AuthError::BiometricNotAvailable(_))));
        }
    }
}
