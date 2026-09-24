use flow_core::app_paths::ApplicationPaths;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_test_root() -> PathBuf {
    let nanoseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock must be after the Unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!("flow-studio-{}/{}", process::id(), nanoseconds))
}

#[test]
fn application_paths_create_required_local_directories() {
    let root = unique_test_root();
    let paths = ApplicationPaths::from_root(root.clone());

    paths
        .ensure_directories()
        .expect("application directories must be created");

    assert_eq!(paths.database_path(), root.join("flow_studio.db"));
    assert!(paths.assets_dir().is_dir());
    assert!(paths.cache_dir().is_dir());
    assert!(paths.exports_dir().is_dir());
    assert!(paths.logs_dir().is_dir());
    assert!(paths.backups_dir().is_dir());

    fs::remove_dir_all(root).expect("test application directory must be removed");
}
