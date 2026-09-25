use flow_core::vault::VaultState;
use flow_studio_lib::error::ErrorDomain;

// Test vault commands via the public commands or flow_core vault
#[test]
fn test_vault_flow_core_engine_state_transitions() {
    let mut engine = flow_core::vault::VaultEngine::new();
    assert_eq!(engine.get_state(), VaultState::Uninitialized);

    let setup_result = engine.setup("SamplePass123!", 15);
    assert!(setup_result.is_ok());
    assert_eq!(engine.get_state(), VaultState::Unlocked);

    engine.lock();
    assert_eq!(engine.get_state(), VaultState::Locked);
}

#[test]
fn test_ipc_error_vault_domain_mapping() {
    let err = flow_studio_lib::error::IpcError::vault_failed("E_TEST_CODE", "Test message");
    assert_eq!(err.code, "E_TEST_CODE");
    assert_eq!(err.domain, ErrorDomain::Vault);
}
