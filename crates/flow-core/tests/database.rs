use flow_core::app_paths::ApplicationPaths;
use flow_core::database::LocalDatabase;
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
fn local_database_applies_initial_schema_once_across_reopens() {
    let root = unique_test_root();
    let paths = ApplicationPaths::from_root(root.clone());

    let database = LocalDatabase::open(&paths).expect("database must initialize");
    assert_eq!(
        database.schema_version().expect("schema version must load"),
        1
    );
    drop(database);

    let reopened = LocalDatabase::open(&paths).expect("database must reopen");
    assert_eq!(
        reopened
            .applied_migration_count()
            .expect("migration count must load"),
        1
    );

    drop(reopened);
    fs::remove_dir_all(root).expect("test application directory must be removed");
}
