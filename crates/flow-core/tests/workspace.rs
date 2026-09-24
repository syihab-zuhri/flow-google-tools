use flow_core::workspace::{initialize_workspace, ProviderMode};
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_test_root() -> PathBuf {
    let nanoseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock must be after the Unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!("flow-studio-app-{}/{}", process::id(), nanoseconds))
}

#[test]
fn workspace_initialization_creates_local_database_with_manual_handoff_mode() {
    let root = unique_test_root();

    let status = initialize_workspace(root.clone()).expect("workspace must initialize");

    assert_eq!(status.database_path, root.join("flow_studio.db"));
    assert_eq!(status.migration_count, 1);
    assert_eq!(status.provider_mode, ProviderMode::ManualHandoff);

    fs::remove_dir_all(root).expect("test workspace directory must be removed");
}
