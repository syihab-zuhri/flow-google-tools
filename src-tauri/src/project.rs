use crate::error::IpcError;
use flow_core::project::{
    load_project_file, save_project_file, LoadProjectResponse, SaveProjectRequest,
    SaveProjectResponse,
};

#[tauri::command]
#[specta::specta]
pub fn save_project(request: SaveProjectRequest) -> Result<SaveProjectResponse, IpcError> {
    save_project_file(&request).map_err(|e| IpcError::project_save_failed(&e))
}

#[tauri::command]
#[specta::specta]
pub fn load_project(file_path: String) -> Result<LoadProjectResponse, IpcError> {
    load_project_file(&file_path).map_err(|e| IpcError::project_load_failed(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorDomain;
    use flow_core::project::{ProjectGraphData, ProjectSettings, ViewportData};
    use std::fs;
    use std::path::PathBuf;
    use std::process;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_path() -> PathBuf {
        let nanoseconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after the Unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "flow-studio-project-test-{}-{nanoseconds}.flowproj",
            process::id()
        ))
    }

    #[test]
    fn save_and_load_project_roundtrip_via_ipc() {
        let test_path = unique_test_path();
        let path_str = test_path.to_string_lossy().to_string();

        let request = SaveProjectRequest {
            file_path: path_str.clone(),
            project_name: "Test Project".to_string(),
            settings: ProjectSettings {
                default_model: "test-model".to_string(),
                auto_save_interval_seconds: 30,
                style_lock_text: None,
            },
            graph: ProjectGraphData {
                nodes: Vec::new(),
                edges: Vec::new(),
                viewport: ViewportData {
                    x: 0.0,
                    y: 0.0,
                    zoom: 1.0,
                },
            },
        };

        let save_result = save_project(request).expect("save_project must succeed");
        assert_eq!(save_result.saved_path, path_str);
        assert!(save_result.file_size_bytes > 0);

        let load_result = load_project(path_str.clone()).expect("load_project must succeed");
        assert_eq!(load_result.project_name, "Test Project");
        assert_eq!(load_result.settings.default_model, "test-model");

        let _ = fs::remove_file(test_path);
    }

    #[test]
    fn load_nonexistent_project_returns_load_failed_ipc_error() {
        let test_path = unique_test_path();
        let path_str = test_path.to_string_lossy().to_string();

        let error = load_project(path_str).expect_err("load must fail for non-existent file");
        assert_eq!(error.code, "E_PROJECT_LOAD_FAILED");
        assert_eq!(error.domain, ErrorDomain::Project);
        assert!(error.retryable);
    }
}
