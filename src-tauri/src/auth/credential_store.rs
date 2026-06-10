//! Platform-native credential storage
//!
//! Secure credential storage using:
//! - Windows: DPAPI (Data Protection API)
//! - macOS: Keychain Services
//! - Linux: libsecret (Secret Service API)

use crate::auth::AuthError;
use parking_lot::RwLock;
use std::sync::Arc;

/// Service name for credential storage
const SERVICE_NAME: &str = "com.tamandua.edr.gui";

/// Account name for the master password hash
const ACCOUNT_PASSWORD_HASH: &str = "master_password_hash";

/// Account name for biometric enrollment status
const ACCOUNT_BIOMETRIC_ENROLLED: &str = "biometric_enrolled";

/// Platform-native credential store
pub struct CredentialStore {
    inner: Arc<RwLock<CredentialStoreInner>>,
}

impl CredentialStore {
    /// Create a new credential store
    pub fn new() -> Result<Self, AuthError> {
        let inner = CredentialStoreInner::new()?;
        Ok(Self {
            inner: Arc::new(RwLock::new(inner)),
        })
    }

    /// Check if a password hash is stored
    pub fn has_password_hash(&self) -> Result<bool, AuthError> {
        let store = self.inner.read();
        store.has_credential(ACCOUNT_PASSWORD_HASH)
    }

    /// Store the password hash
    pub fn store_password_hash(&self, hash: &str) -> Result<(), AuthError> {
        let store = self.inner.write();
        store.store_credential(ACCOUNT_PASSWORD_HASH, hash)
    }

    /// Get the stored password hash
    pub fn get_password_hash(&self) -> Result<Option<String>, AuthError> {
        let store = self.inner.read();
        store.get_credential(ACCOUNT_PASSWORD_HASH)
    }

    /// Delete the password hash
    pub fn delete_password_hash(&self) -> Result<(), AuthError> {
        let store = self.inner.write();
        store.delete_credential(ACCOUNT_PASSWORD_HASH)
    }

    /// Check if biometric is enrolled
    pub fn is_biometric_enrolled(&self) -> Result<bool, AuthError> {
        let store = self.inner.read();
        match store.get_credential(ACCOUNT_BIOMETRIC_ENROLLED)? {
            Some(val) => Ok(val == "true"),
            None => Ok(false),
        }
    }

    /// Set biometric enrollment status
    pub fn set_biometric_enrolled(&self, enrolled: bool) -> Result<(), AuthError> {
        let store = self.inner.write();
        if enrolled {
            store.store_credential(ACCOUNT_BIOMETRIC_ENROLLED, "true")
        } else {
            store.delete_credential(ACCOUNT_BIOMETRIC_ENROLLED)
        }
    }

    /// Clear all stored credentials
    pub fn clear_all(&self) -> Result<(), AuthError> {
        let store = self.inner.write();
        let _ = store.delete_credential(ACCOUNT_PASSWORD_HASH);
        let _ = store.delete_credential(ACCOUNT_BIOMETRIC_ENROLLED);
        Ok(())
    }
}

impl Clone for CredentialStore {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

// ============================================================================
// Platform-specific implementations
// ============================================================================

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_LOCAL_MACHINE,
        CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    pub struct CredentialStoreInner {
        storage_path: PathBuf,
        cache: HashMap<String, String>,
    }

    impl CredentialStoreInner {
        pub fn new() -> Result<Self, AuthError> {
            // Get app data directory
            let storage_path = dirs::data_local_dir()
                .ok_or_else(|| {
                    AuthError::CredentialStoreError("Cannot find app data directory".to_string())
                })?
                .join("Tamandua")
                .join("credentials");

            // Create directory if it doesn't exist
            fs::create_dir_all(&storage_path).map_err(|e| {
                AuthError::CredentialStoreError(format!(
                    "Cannot create credential directory: {}",
                    e
                ))
            })?;

            Ok(Self {
                storage_path,
                cache: HashMap::new(),
            })
        }

        pub fn has_credential(&self, account: &str) -> Result<bool, AuthError> {
            let path = self.storage_path.join(format!("{}.dpapi", account));
            Ok(path.exists())
        }

        pub fn store_credential(&self, account: &str, value: &str) -> Result<(), AuthError> {
            let encrypted = self.encrypt_dpapi(value.as_bytes())?;
            let path = self.storage_path.join(format!("{}.dpapi", account));

            fs::write(&path, &encrypted).map_err(|e| {
                AuthError::CredentialStoreError(format!("Cannot write credential: {}", e))
            })?;

            Ok(())
        }

        pub fn get_credential(&self, account: &str) -> Result<Option<String>, AuthError> {
            let path = self.storage_path.join(format!("{}.dpapi", account));

            if !path.exists() {
                return Ok(None);
            }

            let encrypted = fs::read(&path).map_err(|e| {
                AuthError::CredentialStoreError(format!("Cannot read credential: {}", e))
            })?;

            let decrypted = self.decrypt_dpapi(&encrypted)?;
            let value = String::from_utf8(decrypted).map_err(|e| {
                AuthError::CredentialStoreError(format!("Invalid credential data: {}", e))
            })?;

            Ok(Some(value))
        }

        pub fn delete_credential(&self, account: &str) -> Result<(), AuthError> {
            let path = self.storage_path.join(format!("{}.dpapi", account));

            if path.exists() {
                fs::remove_file(&path).map_err(|e| {
                    AuthError::CredentialStoreError(format!("Cannot delete credential: {}", e))
                })?;
            }

            Ok(())
        }

        fn encrypt_dpapi(&self, data: &[u8]) -> Result<Vec<u8>, AuthError> {
            unsafe {
                let mut input = CRYPT_INTEGER_BLOB {
                    cbData: data.len() as u32,
                    pbData: data.as_ptr() as *mut u8,
                };

                let mut output = CRYPT_INTEGER_BLOB {
                    cbData: 0,
                    pbData: std::ptr::null_mut(),
                };

                let result = CryptProtectData(
                    &mut input,
                    None,
                    None,
                    None,
                    None,
                    CRYPTPROTECT_UI_FORBIDDEN,
                    &mut output,
                );

                if result.is_err() {
                    return Err(AuthError::CredentialStoreError(
                        "DPAPI encryption failed".to_string(),
                    ));
                }

                let encrypted =
                    std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
                let _ = LocalFree(HLOCAL(output.pbData as *mut std::ffi::c_void));

                Ok(encrypted)
            }
        }

        fn decrypt_dpapi(&self, data: &[u8]) -> Result<Vec<u8>, AuthError> {
            unsafe {
                let mut input = CRYPT_INTEGER_BLOB {
                    cbData: data.len() as u32,
                    pbData: data.as_ptr() as *mut u8,
                };

                let mut output = CRYPT_INTEGER_BLOB {
                    cbData: 0,
                    pbData: std::ptr::null_mut(),
                };

                let result = CryptUnprotectData(
                    &mut input,
                    None,
                    None,
                    None,
                    None,
                    CRYPTPROTECT_UI_FORBIDDEN,
                    &mut output,
                );

                if result.is_err() {
                    return Err(AuthError::CredentialStoreError(
                        "DPAPI decryption failed".to_string(),
                    ));
                }

                let decrypted =
                    std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
                let _ = LocalFree(HLOCAL(output.pbData as *mut std::ffi::c_void));

                Ok(decrypted)
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use security_framework::passwords::{
        delete_generic_password, get_generic_password, set_generic_password,
    };

    pub struct CredentialStoreInner;

    impl CredentialStoreInner {
        pub fn new() -> Result<Self, AuthError> {
            Ok(Self)
        }

        pub fn has_credential(&self, account: &str) -> Result<bool, AuthError> {
            match get_generic_password(SERVICE_NAME, account) {
                Ok(_) => Ok(true),
                Err(e) if e.code() == -25300 => Ok(false), // errSecItemNotFound
                Err(e) => Err(AuthError::CredentialStoreError(format!(
                    "Keychain error: {}",
                    e
                ))),
            }
        }

        pub fn store_credential(&self, account: &str, value: &str) -> Result<(), AuthError> {
            // Delete existing entry first (if any)
            let _ = delete_generic_password(SERVICE_NAME, account);

            set_generic_password(SERVICE_NAME, account, value.as_bytes()).map_err(|e| {
                AuthError::CredentialStoreError(format!("Keychain store error: {}", e))
            })
        }

        pub fn get_credential(&self, account: &str) -> Result<Option<String>, AuthError> {
            match get_generic_password(SERVICE_NAME, account) {
                Ok(password) => {
                    let value = String::from_utf8(password).map_err(|e| {
                        AuthError::CredentialStoreError(format!("Invalid credential data: {}", e))
                    })?;
                    Ok(Some(value))
                }
                Err(e) if e.code() == -25300 => Ok(None), // errSecItemNotFound
                Err(e) => Err(AuthError::CredentialStoreError(format!(
                    "Keychain retrieve error: {}",
                    e
                ))),
            }
        }

        pub fn delete_credential(&self, account: &str) -> Result<(), AuthError> {
            match delete_generic_password(SERVICE_NAME, account) {
                Ok(()) => Ok(()),
                Err(e) if e.code() == -25300 => Ok(()), // Already deleted
                Err(e) => Err(AuthError::CredentialStoreError(format!(
                    "Keychain delete error: {}",
                    e
                ))),
            }
        }
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::*;
    use secret_service::{EncryptionType, SecretService};
    use std::collections::HashMap;

    pub struct CredentialStoreInner {
        service: SecretService<'static>,
    }

    impl CredentialStoreInner {
        pub fn new() -> Result<Self, AuthError> {
            let service = SecretService::connect(EncryptionType::Dh).map_err(|e| {
                AuthError::CredentialStoreError(format!("Cannot connect to Secret Service: {}", e))
            })?;

            Ok(Self { service })
        }

        pub fn has_credential(&self, account: &str) -> Result<bool, AuthError> {
            let collection = self.get_collection()?;
            let attributes = self.make_attributes(account);

            let items = collection.search_items(attributes).map_err(|e| {
                AuthError::CredentialStoreError(format!("Secret Service search error: {}", e))
            })?;

            Ok(!items.is_empty())
        }

        pub fn store_credential(&self, account: &str, value: &str) -> Result<(), AuthError> {
            // Delete existing first
            let _ = self.delete_credential(account);

            let collection = self.get_collection()?;
            let attributes = self.make_attributes(account);

            collection
                .create_item(
                    &format!("Tamandua EDR - {}", account),
                    attributes,
                    value.as_bytes(),
                    true, // replace
                    "text/plain",
                )
                .map_err(|e| {
                    AuthError::CredentialStoreError(format!("Secret Service store error: {}", e))
                })?;

            Ok(())
        }

        pub fn get_credential(&self, account: &str) -> Result<Option<String>, AuthError> {
            let collection = self.get_collection()?;
            let attributes = self.make_attributes(account);

            let items = collection.search_items(attributes).map_err(|e| {
                AuthError::CredentialStoreError(format!("Secret Service search error: {}", e))
            })?;

            if items.is_empty() {
                return Ok(None);
            }

            let item = &items[0];
            item.unlock().map_err(|e| {
                AuthError::CredentialStoreError(format!("Secret Service unlock error: {}", e))
            })?;

            let secret = item.get_secret().map_err(|e| {
                AuthError::CredentialStoreError(format!("Secret Service get error: {}", e))
            })?;

            let value = String::from_utf8(secret).map_err(|e| {
                AuthError::CredentialStoreError(format!("Invalid credential data: {}", e))
            })?;

            Ok(Some(value))
        }

        pub fn delete_credential(&self, account: &str) -> Result<(), AuthError> {
            let collection = self.get_collection()?;
            let attributes = self.make_attributes(account);

            let items = collection.search_items(attributes).map_err(|e| {
                AuthError::CredentialStoreError(format!("Secret Service search error: {}", e))
            })?;

            for item in items {
                item.delete().map_err(|e| {
                    AuthError::CredentialStoreError(format!("Secret Service delete error: {}", e))
                })?;
            }

            Ok(())
        }

        fn get_collection(&self) -> Result<secret_service::Collection<'_>, AuthError> {
            self.service.get_default_collection().map_err(|e| {
                AuthError::CredentialStoreError(format!("Cannot get default collection: {}", e))
            })
        }

        fn make_attributes(&self, account: &str) -> HashMap<&str, &str> {
            let mut attrs = HashMap::new();
            attrs.insert("service", SERVICE_NAME);
            attrs.insert("account", account);
            attrs
        }
    }
}

// Fallback for unsupported platforms
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
mod platform {
    use super::*;
    use parking_lot::Mutex;
    use std::collections::HashMap;

    // In-memory store for unsupported platforms
    static MEMORY_STORE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

    fn get_store() -> parking_lot::MutexGuard<'static, Option<HashMap<String, String>>> {
        let mut store = MEMORY_STORE.lock();
        if store.is_none() {
            *store = Some(HashMap::new());
        }
        store
    }

    pub struct CredentialStoreInner;

    impl CredentialStoreInner {
        pub fn new() -> Result<Self, AuthError> {
            Ok(Self)
        }

        pub fn has_credential(&self, account: &str) -> Result<bool, AuthError> {
            let store = get_store();
            let key = format!("{}:{}", SERVICE_NAME, account);
            Ok(store.as_ref().unwrap().contains_key(&key))
        }

        pub fn store_credential(&self, account: &str, value: &str) -> Result<(), AuthError> {
            let mut store = get_store();
            let key = format!("{}:{}", SERVICE_NAME, account);
            store.as_mut().unwrap().insert(key, value.to_string());
            Ok(())
        }

        pub fn get_credential(&self, account: &str) -> Result<Option<String>, AuthError> {
            let store = get_store();
            let key = format!("{}:{}", SERVICE_NAME, account);
            Ok(store.as_ref().unwrap().get(&key).cloned())
        }

        pub fn delete_credential(&self, account: &str) -> Result<(), AuthError> {
            let mut store = get_store();
            let key = format!("{}:{}", SERVICE_NAME, account);
            store.as_mut().unwrap().remove(&key);
            Ok(())
        }
    }
}

// Re-export platform-specific implementation
use platform::CredentialStoreInner;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_store_creation() {
        let store = CredentialStore::new();
        assert!(store.is_ok());
    }

    #[test]
    fn test_store_and_retrieve() {
        let store = CredentialStore::new().unwrap();

        // Store a value
        store.store_password_hash("test_hash_value").unwrap();

        // Check it exists
        assert!(store.has_password_hash().unwrap());

        // Retrieve it
        let retrieved = store.get_password_hash().unwrap();
        assert_eq!(retrieved, Some("test_hash_value".to_string()));

        // Delete it
        store.delete_password_hash().unwrap();

        // Verify deleted
        assert!(!store.has_password_hash().unwrap());
    }

    #[test]
    fn test_biometric_enrollment() {
        let store = CredentialStore::new().unwrap();

        // Initially not enrolled
        assert!(!store.is_biometric_enrolled().unwrap());

        // Enroll
        store.set_biometric_enrolled(true).unwrap();
        assert!(store.is_biometric_enrolled().unwrap());

        // Unenroll
        store.set_biometric_enrolled(false).unwrap();
        assert!(!store.is_biometric_enrolled().unwrap());
    }

    #[test]
    fn test_clear_all() {
        let store = CredentialStore::new().unwrap();

        // Store some values
        store.store_password_hash("test_hash").unwrap();
        store.set_biometric_enrolled(true).unwrap();

        // Clear all
        store.clear_all().unwrap();

        // Verify cleared
        assert!(!store.has_password_hash().unwrap());
        assert!(!store.is_biometric_enrolled().unwrap());
    }
}
