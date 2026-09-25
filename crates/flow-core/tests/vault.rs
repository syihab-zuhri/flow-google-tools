use flow_core::vault::{derive_key_from_password, VaultEngine, VaultState};

#[test]
fn test_vault_initial_state_is_uninitialized() {
    let vault = VaultEngine::new();
    assert_eq!(vault.get_state(), VaultState::Uninitialized);
}

#[test]
fn test_vault_setup_and_unlock_lifecycle() {
    let mut vault = VaultEngine::new();

    // Setup master password
    let setup_res = vault.setup("MySecretMasterPassword123!", 15);
    assert!(setup_res.is_ok());
    assert_eq!(vault.get_state(), VaultState::Unlocked);

    // Lock vault
    vault.lock();
    assert_eq!(vault.get_state(), VaultState::Locked);

    // Bad password fails
    let bad_unlock = vault.unlock("WrongPassword");
    assert!(bad_unlock.is_err());
    assert_eq!(vault.get_state(), VaultState::Locked);

    // Correct password succeeds
    let good_unlock = vault.unlock("MySecretMasterPassword123!");
    assert!(good_unlock.is_ok());
    assert_eq!(vault.get_state(), VaultState::Unlocked);
}

#[test]
fn test_vault_anti_brute_force_lockout_after_3_attempts() {
    let mut vault = VaultEngine::new();
    vault.setup("SecurePassword123!", 15).unwrap();
    vault.lock();

    // 3 failed attempts
    assert!(vault.unlock("bad_1").is_err());
    assert!(vault.unlock("bad_2").is_err());
    assert!(vault.unlock("bad_3").is_err());

    // 4th attempt should be blocked by cooldown
    let blocked_attempt = vault.unlock("SecurePassword123!");
    assert!(blocked_attempt.is_err());
    let err_str = blocked_attempt.unwrap_err();
    assert!(err_str.contains("Cooldown"));
}

#[test]
fn test_vault_reset_clears_credentials() {
    let mut vault = VaultEngine::new();
    vault.setup("Password123!", 15).unwrap();

    let reset_res = vault.reset("I_UNDERSTAND_DATA_LOSS_IS_PERMANENT");
    assert!(reset_res.is_ok());
    assert_eq!(vault.get_state(), VaultState::Uninitialized);
}

#[test]
fn test_key_derivation_deterministic() {
    let salt = [0x42u8; 16];
    let key1 = derive_key_from_password("test_pass", &salt);
    let key2 = derive_key_from_password("test_pass", &salt);
    assert_eq!(key1, key2);

    let key3 = derive_key_from_password("other_pass", &salt);
    assert_ne!(key1, key3);
}
