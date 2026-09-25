use flow_core::project::{
    load_project_file, save_project_file, ProjectGraphData, ProjectSettings, SaveProjectRequest,
};
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_test_dir() -> PathBuf {
    let nanoseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock must be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("flow-proj-{}-{}", process::id(), nanoseconds));
    fs::create_dir_all(&dir).expect("failed to create temp test dir");
    dir
}

#[test]
fn test_save_and_load_project_roundtrip() {
    let temp_dir = unique_test_dir();
    let file_path = temp_dir.join("my_animation.flowproj");

    let request = SaveProjectRequest {
        file_path: file_path.to_string_lossy().to_string(),
        project_name: "My Animation".to_string(),
        settings: ProjectSettings {
            default_model: "veo-3.1".to_string(),
            auto_save_interval_seconds: 30,
            style_lock_text: Some("cinematic 35mm".to_string()),
        },
        graph: ProjectGraphData {
            nodes: vec![],
            edges: vec![],
            viewport: flow_core::project::ViewportData {
                x: 0.0,
                y: 0.0,
                zoom: 1.0,
            },
        },
    };

    let save_res = save_project_file(&request).expect("Save should succeed");
    assert!(save_res.file_size_bytes > 0);
    assert_eq!(save_res.saved_path, file_path.to_string_lossy().to_string());

    let loaded = load_project_file(&file_path.to_string_lossy()).expect("Load should succeed");
    assert_eq!(loaded.project_name, "My Animation");
    assert_eq!(loaded.version, "1.0.0");
    assert_eq!(loaded.settings.default_model, "veo-3.1");
    assert_eq!(
        loaded.settings.style_lock_text,
        Some("cinematic 35mm".to_string())
    );

    let _ = fs::remove_dir_all(temp_dir);
}

#[test]
fn test_atomic_save_leaves_no_tmp_file() {
    let temp_dir = unique_test_dir();
    let file_path = temp_dir.join("test_atomic.flowproj");

    let request = SaveProjectRequest {
        file_path: file_path.to_string_lossy().to_string(),
        project_name: "Test Atomic".to_string(),
        settings: ProjectSettings {
            default_model: "gemini-omni".to_string(),
            auto_save_interval_seconds: 60,
            style_lock_text: None,
        },
        graph: ProjectGraphData {
            nodes: vec![],
            edges: vec![],
            viewport: flow_core::project::ViewportData {
                x: 10.0,
                y: 20.0,
                zoom: 1.5,
            },
        },
    };

    save_project_file(&request).expect("Save should succeed");

    let tmp_path = format!("{}.tmp", file_path.to_string_lossy());
    assert!(!std::path::Path::new(&tmp_path).exists());
    assert!(file_path.exists());

    let _ = fs::remove_dir_all(temp_dir);
}
