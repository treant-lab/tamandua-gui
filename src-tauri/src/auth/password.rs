//! Password hashing and policy enforcement using Argon2id
//!
//! Secure password handling with:
//! - Argon2id hashing (memory-hard, GPU-resistant)
//! - Configurable parameters (m=64MB, t=3, p=4 by default)
//! - Password policy enforcement
//! - Strength checking

use argon2::{
    password_hash::{
        rand_core::OsRng, PasswordHash, PasswordHasher as ArgonHasher, PasswordVerifier, SaltString,
    },
    Algorithm, Argon2, Params, Version,
};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::auth::AuthError;

/// Argon2id parameters for password hashing
#[derive(Debug, Clone)]
pub struct Argon2Params {
    /// Memory cost in KiB (default: 65536 = 64MB)
    pub memory_cost: u32,
    /// Time cost (iterations) (default: 3)
    pub time_cost: u32,
    /// Parallelism (default: 4)
    pub parallelism: u32,
    /// Output length in bytes (default: 32)
    pub output_len: usize,
}

impl Default for Argon2Params {
    fn default() -> Self {
        Self {
            memory_cost: 65536, // 64 MB
            time_cost: 3,
            parallelism: 4,
            output_len: 32,
        }
    }
}

/// Password hasher using Argon2id
pub struct PasswordHasher {
    params: Argon2Params,
}

impl PasswordHasher {
    /// Create a new password hasher with default parameters
    pub fn new() -> Self {
        Self {
            params: Argon2Params::default(),
        }
    }

    /// Create a password hasher with custom parameters
    pub fn with_params(params: Argon2Params) -> Self {
        Self { params }
    }

    /// Hash a password using Argon2id
    pub fn hash(&self, password: &str) -> Result<String, AuthError> {
        // Create Argon2 instance with our parameters
        let argon2 = self.create_argon2()?;

        // Generate a random salt
        let salt = SaltString::generate(&mut OsRng);

        // Hash the password
        // Use Zeroizing to ensure password is zeroed from memory after use
        let password_bytes = Zeroizing::new(password.as_bytes().to_vec());

        let hash = argon2
            .hash_password(&password_bytes, &salt)
            .map_err(|e| AuthError::Internal(format!("Password hashing failed: {}", e)))?;

        Ok(hash.to_string())
    }

    /// Verify a password against a stored hash
    pub fn verify(&self, password: &str, hash: &str) -> Result<bool, AuthError> {
        // Parse the stored hash
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| AuthError::Internal(format!("Invalid hash format: {}", e)))?;

        // Create Argon2 instance
        let argon2 = self.create_argon2()?;

        // Verify
        let password_bytes = Zeroizing::new(password.as_bytes().to_vec());
        Ok(argon2
            .verify_password(&password_bytes, &parsed_hash)
            .is_ok())
    }

    /// Create an Argon2 instance with configured parameters
    fn create_argon2(&self) -> Result<Argon2<'static>, AuthError> {
        let params = Params::new(
            self.params.memory_cost,
            self.params.time_cost,
            self.params.parallelism,
            Some(self.params.output_len),
        )
        .map_err(|e| AuthError::Internal(format!("Invalid Argon2 parameters: {}", e)))?;

        Ok(Argon2::new(Algorithm::Argon2id, Version::V0x13, params))
    }
}

impl Default for PasswordHasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Password strength level
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum PasswordStrength {
    /// Very weak - easily crackable
    VeryWeak,
    /// Weak - vulnerable to dictionary attacks
    Weak,
    /// Fair - somewhat resistant to attacks
    Fair,
    /// Strong - good resistance to attacks
    Strong,
    /// Very strong - excellent security
    VeryStrong,
}

impl PasswordStrength {
    /// Get a human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            Self::VeryWeak => "Very weak - extremely easy to crack",
            Self::Weak => "Weak - vulnerable to common attacks",
            Self::Fair => "Fair - provides basic protection",
            Self::Strong => "Strong - good security for most uses",
            Self::VeryStrong => "Very strong - excellent security",
        }
    }

    /// Get the score as a number (0-100)
    pub fn score(&self) -> u8 {
        match self {
            Self::VeryWeak => 10,
            Self::Weak => 30,
            Self::Fair => 50,
            Self::Strong => 75,
            Self::VeryStrong => 100,
        }
    }
}

/// Password policy for validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordPolicy {
    /// Minimum length requirement
    pub min_length: usize,
    /// Maximum length (to prevent DoS)
    pub max_length: usize,
    /// Require at least one uppercase letter
    pub require_uppercase: bool,
    /// Require at least one lowercase letter
    pub require_lowercase: bool,
    /// Require at least one digit
    pub require_digit: bool,
    /// Require at least one special character
    pub require_special: bool,
    /// Minimum character classes required (uppercase, lowercase, digit, special)
    pub min_char_classes: usize,
    /// List of common/weak passwords to reject
    pub banned_passwords: Vec<String>,
}

impl Default for PasswordPolicy {
    fn default() -> Self {
        Self {
            min_length: 8,
            max_length: 128,
            require_uppercase: true,
            require_lowercase: true,
            require_digit: true,
            require_special: true,
            min_char_classes: 3,
            banned_passwords: vec![
                "password".to_string(),
                "password123".to_string(),
                "123456".to_string(),
                "12345678".to_string(),
                "qwerty".to_string(),
                "admin".to_string(),
                "letmein".to_string(),
                "welcome".to_string(),
                "monkey".to_string(),
                "dragon".to_string(),
                "master".to_string(),
                "login".to_string(),
                "tamandua".to_string(),
            ],
        }
    }
}

impl PasswordPolicy {
    /// Validate a password against the policy
    pub fn validate(&self, password: &str) -> Result<(), AuthError> {
        // Check length
        if password.len() < self.min_length {
            return Err(AuthError::PasswordPolicyViolation(format!(
                "Password must be at least {} characters",
                self.min_length
            )));
        }

        if password.len() > self.max_length {
            return Err(AuthError::PasswordPolicyViolation(format!(
                "Password must be at most {} characters",
                self.max_length
            )));
        }

        // Check banned passwords
        let lower = password.to_lowercase();
        for banned in &self.banned_passwords {
            if lower.contains(banned) {
                return Err(AuthError::PasswordPolicyViolation(
                    "Password contains a common/weak pattern".to_string(),
                ));
            }
        }

        // Count character classes
        let has_upper = password.chars().any(|c| c.is_uppercase());
        let has_lower = password.chars().any(|c| c.is_lowercase());
        let has_digit = password.chars().any(|c| c.is_ascii_digit());
        let has_special = password.chars().any(|c| is_special_char(c));

        let class_count = [has_upper, has_lower, has_digit, has_special]
            .iter()
            .filter(|&&x| x)
            .count();

        if class_count < self.min_char_classes {
            return Err(AuthError::PasswordPolicyViolation(format!(
                "Password must contain at least {} of: uppercase, lowercase, digit, special character",
                self.min_char_classes
            )));
        }

        // Check specific requirements
        if self.require_uppercase && !has_upper {
            return Err(AuthError::PasswordPolicyViolation(
                "Password must contain at least one uppercase letter".to_string(),
            ));
        }

        if self.require_lowercase && !has_lower {
            return Err(AuthError::PasswordPolicyViolation(
                "Password must contain at least one lowercase letter".to_string(),
            ));
        }

        if self.require_digit && !has_digit {
            return Err(AuthError::PasswordPolicyViolation(
                "Password must contain at least one digit".to_string(),
            ));
        }

        if self.require_special && !has_special {
            return Err(AuthError::PasswordPolicyViolation(
                "Password must contain at least one special character".to_string(),
            ));
        }

        Ok(())
    }

    /// Check password strength without enforcing policy
    pub fn check_strength(&self, password: &str) -> PasswordStrength {
        let mut score = 0u32;

        // Length scoring
        let len = password.len();
        if len >= 8 {
            score += 10;
        }
        if len >= 12 {
            score += 10;
        }
        if len >= 16 {
            score += 10;
        }
        if len >= 20 {
            score += 10;
        }

        // Character class scoring
        if password.chars().any(|c| c.is_uppercase()) {
            score += 10;
        }
        if password.chars().any(|c| c.is_lowercase()) {
            score += 10;
        }
        if password.chars().any(|c| c.is_ascii_digit()) {
            score += 10;
        }
        if password.chars().any(|c| is_special_char(c)) {
            score += 15;
        }

        // Variety bonus (more unique characters = better)
        let unique_chars: std::collections::HashSet<char> = password.chars().collect();
        let uniqueness_ratio = unique_chars.len() as f32 / len as f32;
        if uniqueness_ratio > 0.8 {
            score += 10;
        }
        if uniqueness_ratio > 0.6 {
            score += 5;
        }

        // Penalty for common patterns
        let lower = password.to_lowercase();
        if self.banned_passwords.iter().any(|b| lower.contains(b)) {
            score = score.saturating_sub(30);
        }

        // Penalty for sequential characters
        if has_sequential_chars(password, 3) {
            score = score.saturating_sub(10);
        }

        // Penalty for repeated characters
        if has_repeated_chars(password, 3) {
            score = score.saturating_sub(10);
        }

        // Convert score to strength level
        match score {
            0..=20 => PasswordStrength::VeryWeak,
            21..=40 => PasswordStrength::Weak,
            41..=60 => PasswordStrength::Fair,
            61..=80 => PasswordStrength::Strong,
            _ => PasswordStrength::VeryStrong,
        }
    }
}

/// Check if a character is a special character
fn is_special_char(c: char) -> bool {
    matches!(
        c,
        '!' | '@'
            | '#'
            | '$'
            | '%'
            | '^'
            | '&'
            | '*'
            | '('
            | ')'
            | '-'
            | '_'
            | '='
            | '+'
            | '['
            | ']'
            | '{'
            | '}'
            | '|'
            | '\\'
            | ':'
            | ';'
            | '"'
            | '\''
            | '<'
            | '>'
            | ','
            | '.'
            | '?'
            | '/'
            | '`'
            | '~'
    )
}

/// Check for sequential characters (abc, 123, etc.)
fn has_sequential_chars(password: &str, min_seq: usize) -> bool {
    let chars: Vec<char> = password.chars().collect();
    if chars.len() < min_seq {
        return false;
    }

    let mut seq_count = 1;
    for i in 1..chars.len() {
        let prev = chars[i - 1] as i32;
        let curr = chars[i] as i32;

        if curr == prev + 1 || curr == prev - 1 {
            seq_count += 1;
            if seq_count >= min_seq {
                return true;
            }
        } else {
            seq_count = 1;
        }
    }

    false
}

/// Check for repeated characters (aaa, 111, etc.)
fn has_repeated_chars(password: &str, min_repeat: usize) -> bool {
    let chars: Vec<char> = password.chars().collect();
    if chars.len() < min_repeat {
        return false;
    }

    let mut repeat_count = 1;
    for i in 1..chars.len() {
        if chars[i] == chars[i - 1] {
            repeat_count += 1;
            if repeat_count >= min_repeat {
                return true;
            }
        } else {
            repeat_count = 1;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hashing() {
        let hasher = PasswordHasher::new();

        // Hash a password
        let hash = hasher.hash("SecureP@ss123!").unwrap();

        // Verify it's a valid PHC string
        assert!(hash.starts_with("$argon2id$"));

        // Verify correct password
        assert!(hasher.verify("SecureP@ss123!", &hash).unwrap());

        // Verify incorrect password
        assert!(!hasher.verify("WrongPassword", &hash).unwrap());
    }

    #[test]
    fn test_password_uniqueness() {
        let hasher = PasswordHasher::new();

        // Same password should produce different hashes (due to random salt)
        let hash1 = hasher.hash("TestPassword123!").unwrap();
        let hash2 = hasher.hash("TestPassword123!").unwrap();

        assert_ne!(hash1, hash2);

        // But both should verify
        assert!(hasher.verify("TestPassword123!", &hash1).unwrap());
        assert!(hasher.verify("TestPassword123!", &hash2).unwrap());
    }

    #[test]
    fn test_policy_validation() {
        let policy = PasswordPolicy::default();

        // Valid password
        assert!(policy.validate("SecureP@ss123!").is_ok());

        // Too short
        assert!(policy.validate("Sh0rt!").is_err());

        // Missing uppercase
        assert!(policy.validate("securep@ss123!").is_err());

        // Missing lowercase
        assert!(policy.validate("SECUREP@SS123!").is_err());

        // Missing digit
        assert!(policy.validate("SecureP@ss!!!").is_err());

        // Missing special
        assert!(policy.validate("SecurePass123").is_err());

        // Contains banned word
        assert!(policy.validate("MyPassword123!").is_err());
    }

    #[test]
    fn test_strength_check() {
        let policy = PasswordPolicy::default();

        // Very weak password
        assert_eq!(policy.check_strength("pass"), PasswordStrength::VeryWeak);

        // Weak password
        assert_eq!(
            policy.check_strength("password1"),
            PasswordStrength::VeryWeak
        );

        // Fair password
        assert!(matches!(
            policy.check_strength("Pass12!"),
            PasswordStrength::Fair | PasswordStrength::Weak
        ));

        // Strong password
        assert!(matches!(
            policy.check_strength("SecureP@ss123!"),
            PasswordStrength::Strong | PasswordStrength::VeryStrong
        ));

        // Very strong password
        assert_eq!(
            policy.check_strength("V3ry$ecure#P@ssw0rd!Long"),
            PasswordStrength::VeryStrong
        );
    }

    #[test]
    fn test_sequential_detection() {
        assert!(has_sequential_chars("abc", 3));
        assert!(has_sequential_chars("123", 3));
        assert!(has_sequential_chars("test123abc", 3));
        assert!(!has_sequential_chars("test", 3));
        assert!(!has_sequential_chars("a1b2c3", 3));
    }

    #[test]
    fn test_repeated_detection() {
        assert!(has_repeated_chars("aaa", 3));
        assert!(has_repeated_chars("test111", 3));
        assert!(!has_repeated_chars("aa", 3));
        assert!(!has_repeated_chars("ababab", 3));
    }

    #[test]
    fn test_special_chars() {
        assert!(is_special_char('!'));
        assert!(is_special_char('@'));
        assert!(is_special_char('#'));
        assert!(!is_special_char('a'));
        assert!(!is_special_char('1'));
    }
}
