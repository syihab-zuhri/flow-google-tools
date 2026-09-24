use flow_studio_lib::logging::{LogSanitizer, SizeRollingFileWriter};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_test_root() -> PathBuf {
    let nanoseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock must be after the Unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "flow-studio-logging-{}/{}",
        process::id(),
        nanoseconds
    ))
}

#[test]
fn log_sanitizer_redacts_synthetic_authorization_and_cookie_values() {
    let sanitizer = LogSanitizer::new().expect("sanitizer patterns must compile");
    let raw = "Authorization: Bearer synthetic-access-token; SID=synthetic-cookie-value";

    let sanitized = sanitizer.sanitize(raw);

    assert!(!sanitized.contains("synthetic-access-token"));
    assert!(!sanitized.contains("synthetic-cookie-value"));
    assert!(sanitized.contains("[REDACTED_SECRET]"));
}

#[test]
fn rolling_writer_retains_only_configured_archive_count() {
    let root = unique_test_root();
    let mut writer =
        SizeRollingFileWriter::with_rotation_limits(root.clone(), 4, 2).expect("writer must open");

    writer
        .write_all(b"1234")
        .expect("first log payload must write");
    writer
        .write_all(b"5678")
        .expect("second log payload must rotate");
    writer
        .write_all(b"9012")
        .expect("third log payload must rotate");
    writer
        .write_all(b"3456")
        .expect("fourth log payload must rotate");

    assert!(root.join("flow-studio.log").is_file());
    assert!(root.join("flow-studio.1.log").is_file());
    assert!(root.join("flow-studio.2.log").is_file());
    assert!(!root.join("flow-studio.3.log").exists());

    fs::remove_dir_all(root).expect("test log directory must be removed");
}
