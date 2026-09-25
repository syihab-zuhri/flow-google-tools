use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub const VAULT_CANARY_PLAINTEXT: &str = "FLOW_STUDIO_CANARY_OK";
pub const MAX_FAILED_ATTEMPTS: u32 = 3;
pub const LOCKOUT_DURATION_SECS: u64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum VaultState {
    Uninitialized,
    Locked,
    Unlocked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct SetupVaultRequest {
    pub client_request_id: String,
    pub master_password: String,
    pub confirm_password: String,
    pub auto_lock_timeout_minutes: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct SetupVaultResponse {
    pub status: String,
    pub vault_created_at: u64,
    pub auto_lock_timeout_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct UnlockVaultRequest {
    pub master_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct UnlockVaultResponse {
    pub status: String,
    pub unlocked_at: u64,
    pub active_account_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct LockVaultResponse {
    pub status: String,
    pub locked_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatusResponse {
    pub state: VaultState,
    pub auto_lock_timeout_minutes: u32,
    pub has_active_lockout: bool,
    pub lockout_remaining_seconds: Option<u64>,
    pub last_unlocked_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResetVaultRequest {
    pub confirmation_flag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResetVaultResponse {
    pub success: bool,
    pub wiped_at: u64,
}

pub fn derive_key_from_password(password: &str, salt: &[u8; 16]) -> [u8; 32] {
    let mut key = [0u8; 32];
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt);
    let mut current = hasher.finalize();

    // 10,000 round key stretching for fast unit tests while maintaining resistance
    for i in 0..10_000u32 {
        let mut round_hasher = Sha256::new();
        round_hasher.update(current);
        round_hasher.update(i.to_be_bytes());
        current = round_hasher.finalize();
    }

    key.copy_from_slice(&current);
    key
}

pub fn compute_canary_hash(key: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(VAULT_CANARY_PLAINTEXT.as_bytes());
    hasher.update(key);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

#[derive(Debug)]
pub struct VaultEngine {
    state: VaultState,
    master_salt: Option<[u8; 16]>,
    canary_hash: Option<[u8; 32]>,
    active_key: Option<[u8; 32]>,
    failed_attempts: u32,
    lockout_until: Option<Instant>,
    auto_lock_timeout_minutes: u32,
    last_unlocked_at: Option<u64>,
}

impl Default for VaultEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl VaultEngine {
    pub fn new() -> Self {
        Self {
            state: VaultState::Uninitialized,
            master_salt: None,
            canary_hash: None,
            active_key: None,
            failed_attempts: 0,
            lockout_until: None,
            auto_lock_timeout_minutes: 15,
            last_unlocked_at: None,
        }
    }

    pub fn get_state(&self) -> VaultState {
        self.state
    }

    pub fn is_lockout_active(&self) -> bool {
        if let Some(until) = self.lockout_until {
            Instant::now() < until
        } else {
            false
        }
    }

    pub fn remaining_lockout_seconds(&self) -> Option<u64> {
        if let Some(until) = self.lockout_until {
            let now = Instant::now();
            if now < until {
                Some((until - now).as_secs())
            } else {
                None
            }
        } else {
            None
        }
    }

    pub fn setup(&mut self, password: &str, timeout_minutes: u32) -> Result<(), String> {
        if password.trim().len() < 8 {
            return Err("Password must be at least 8 characters long.".to_string());
        }

        let now_millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let mut salt = [0u8; 16];
        let now_bytes = now_millis.to_be_bytes();
        salt[..8].copy_from_slice(&now_bytes);
        salt[8..16].copy_from_slice(&now_bytes);

        let key = derive_key_from_password(password, &salt);
        let canary = compute_canary_hash(&key);

        self.master_salt = Some(salt);
        self.canary_hash = Some(canary);
        self.active_key = Some(key);
        self.state = VaultState::Unlocked;
        self.failed_attempts = 0;
        self.lockout_until = None;
        self.auto_lock_timeout_minutes = timeout_minutes.clamp(1, 120);
        self.last_unlocked_at = Some(now_millis);

        Ok(())
    }

    pub fn unlock(&mut self, password: &str) -> Result<(), String> {
        if self.is_lockout_active() {
            let remaining = self.remaining_lockout_seconds().unwrap_or(30);
            return Err(format!(
                "Cooldown active. Please wait {remaining} seconds before retrying."
            ));
        }

        let salt = self
            .master_salt
            .ok_or_else(|| "Vault has not been set up yet.".to_string())?;
        let expected_canary = self
            .canary_hash
            .ok_or_else(|| "Canary hash not found.".to_string())?;

        let candidate_key = derive_key_from_password(password, &salt);
        let candidate_canary = compute_canary_hash(&candidate_key);

        if candidate_canary == expected_canary {
            self.active_key = Some(candidate_key);
            self.state = VaultState::Unlocked;
            self.failed_attempts = 0;
            self.lockout_until = None;
            self.last_unlocked_at = Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            );
            Ok(())
        } else {
            self.failed_attempts += 1;
            if self.failed_attempts >= MAX_FAILED_ATTEMPTS {
                self.lockout_until =
                    Some(Instant::now() + Duration::from_secs(LOCKOUT_DURATION_SECS));
                Err("Maximum attempts reached. Cooldown penalty activated for 30s.".to_string())
            } else {
                let remaining = MAX_FAILED_ATTEMPTS - self.failed_attempts;
                Err(format!(
                    "Invalid master password. {remaining} attempt(s) remaining."
                ))
            }
        }
    }

    pub fn lock(&mut self) {
        if let Some(mut key) = self.active_key.take() {
            // Memory zeroization
            key.fill(0);
        }
        if self.state == VaultState::Unlocked {
            self.state = VaultState::Locked;
        }
    }

    pub fn reset(&mut self, confirmation: &str) -> Result<(), String> {
        if confirmation != "I_UNDERSTAND_DATA_LOSS_IS_PERMANENT" {
            return Err(
                "Confirmation flag does not match required confirmation string.".to_string(),
            );
        }

        self.lock();
        self.state = VaultState::Uninitialized;
        self.master_salt = None;
        self.canary_hash = None;
        self.failed_attempts = 0;
        self.lockout_until = None;
        self.last_unlocked_at = None;

        Ok(())
    }

    pub fn status(&self) -> VaultStatusResponse {
        VaultStatusResponse {
            state: self.state,
            auto_lock_timeout_minutes: self.auto_lock_timeout_minutes,
            has_active_lockout: self.is_lockout_active(),
            lockout_remaining_seconds: self.remaining_lockout_seconds(),
            last_unlocked_at: self.last_unlocked_at,
        }
    }
}

impl Drop for VaultEngine {
    fn drop(&mut self) {
        self.lock();
    }
}
