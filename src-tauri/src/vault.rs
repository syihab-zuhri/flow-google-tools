use crate::error::IpcError;
use flow_core::vault::{
    LockVaultResponse, ResetVaultRequest, ResetVaultResponse, SetupVaultRequest,
    SetupVaultResponse, UnlockVaultRequest, UnlockVaultResponse, VaultEngine, VaultState,
    VaultStatusResponse,
};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

static VAULT_INSTANCE: Mutex<Option<VaultEngine>> = Mutex::new(None);

fn with_vault<F, R>(f: F) -> Result<R, IpcError>
where
    F: FnOnce(&mut VaultEngine) -> Result<R, IpcError>,
{
    let mut guard = VAULT_INSTANCE
        .lock()
        .map_err(|_| IpcError::vault_failed("E_VAULT_MUTEX_POISONED", "Vault mutex was poisoned"))?;

    if guard.is_none() {
        *guard = Some(VaultEngine::new());
    }

    match guard.as_mut() {
        Some(vault) => f(vault),
        None => Err(IpcError::vault_failed(
            "E_VAULT_UNAVAILABLE",
            "Vault instance unavailable",
        )),
    }
}

#[tauri::command]
#[specta::specta]
pub fn setup_vault(request: SetupVaultRequest) -> Result<SetupVaultResponse, IpcError> {
    if request.master_password != request.confirm_password {
        return Err(IpcError::vault_failed(
            "E_VAULT_INVALID_PASSWORD",
            "Passwords do not match.",
        ));
    }

    with_vault(|vault| {
        if vault.get_state() != VaultState::Uninitialized {
            return Err(IpcError::vault_failed(
                "E_VAULT_ALREADY_INITIALIZED",
                "Vault has already been set up.",
            ));
        }

        let timeout = request.auto_lock_timeout_minutes.unwrap_or(15);
        vault
            .setup(&request.master_password, timeout)
            .map_err(|e| IpcError::vault_failed("E_VAULT_INVALID_PASSWORD", &e))?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(SetupVaultResponse {
            status: "unlocked".to_string(),
            vault_created_at: now,
            auto_lock_timeout_minutes: timeout,
        })
    })
}

#[tauri::command]
#[specta::specta]
pub fn unlock_vault(request: UnlockVaultRequest) -> Result<UnlockVaultResponse, IpcError> {
    with_vault(|vault| {
        if vault.get_state() == VaultState::Uninitialized {
            return Err(IpcError::vault_failed(
                "E_VAULT_UNINITIALIZED",
                "Vault must be set up before it can be unlocked.",
            ));
        }

        if vault.is_lockout_active() {
            let remaining = vault.remaining_lockout_seconds().unwrap_or(30);
            return Err(IpcError::vault_failed(
                "E_VAULT_RATE_LIMITED",
                &format!("Cooldown active. Wait {remaining}s before retrying."),
            ));
        }

        vault.unlock(&request.master_password).map_err(|e| {
            if e.contains("Cooldown") {
                IpcError::vault_failed("E_VAULT_RATE_LIMITED", &e)
            } else {
                IpcError::vault_failed("E_VAULT_INVALID_PASSWORD", &e)
            }
        })?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(UnlockVaultResponse {
            status: "unlocked".to_string(),
            unlocked_at: now,
            active_account_count: 0,
        })
    })
}

#[tauri::command]
#[specta::specta]
pub fn lock_vault() -> Result<LockVaultResponse, IpcError> {
    with_vault(|vault| {
        vault.lock();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(LockVaultResponse {
            status: "locked".to_string(),
            locked_at: now,
        })
    })
}

#[tauri::command]
#[specta::specta]
pub fn check_vault_status() -> Result<VaultStatusResponse, IpcError> {
    with_vault(|vault| Ok(vault.status()))
}

#[tauri::command]
#[specta::specta]
pub fn reset_vault(request: ResetVaultRequest) -> Result<ResetVaultResponse, IpcError> {
    with_vault(|vault| {
        vault
            .reset(&request.confirmation_flag)
            .map_err(|e| IpcError::vault_failed("E_VAULT_INVALID_PASSWORD", &e))?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(ResetVaultResponse {
            success: true,
            wiped_at: now,
        })
    })
}
