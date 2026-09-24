use crate::error::IpcError;
use flow_core::workspace::{initialize_workspace, ProviderMode, WorkspaceStatus};
use serde::Serialize;
use specta::Type;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatusResponse {
    pub database_path: String,
    pub migration_count: u32,
    pub provider_mode: ProviderMode,
}

#[tauri::command]
#[specta::specta]
pub fn workspace_status(app: AppHandle) -> Result<WorkspaceStatusResponse, IpcError> {
    let data_directory = app
        .path()
        .data_dir()
        .map_err(|_| IpcError::workspace_initialization_failed())?;

    initialize_for_root(workspace_root(data_directory))
}

pub fn workspace_root(data_directory: PathBuf) -> PathBuf {
    data_directory.join("FlowStudio")
}

pub fn initialize_for_root(root: PathBuf) -> Result<WorkspaceStatusResponse, IpcError> {
    initialize_workspace(root)
        .map(to_response)
        .map_err(|_| IpcError::workspace_initialization_failed())
}

fn to_response(status: WorkspaceStatus) -> WorkspaceStatusResponse {
    WorkspaceStatusResponse {
        database_path: status.database_path.display().to_string(),
        migration_count: u32::try_from(status.migration_count).unwrap_or(u32::MAX),
        provider_mode: status.provider_mode,
    }
}

#[cfg(test)]
mod tests {
    use super::{initialize_for_root, workspace_root};
    use crate::error::ErrorDomain;
    use std::fs::{self, File};
    use std::path::PathBuf;
    use std::process;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_file() -> PathBuf {
        let nanoseconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after the Unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "flow-studio-workspace-file-{}-{nanoseconds}",
            process::id()
        ))
    }

    #[test]
    fn workspace_root_uses_flow_studio_directory_name() {
        let app_data_directory = PathBuf::from("C:/Users/Owner/AppData/Roaming");

        assert_eq!(
            workspace_root(app_data_directory),
            PathBuf::from("C:/Users/Owner/AppData/Roaming/FlowStudio")
        );
    }

    #[test]
    fn workspace_initialization_failure_returns_safe_storage_error() {
        let root = unique_test_file();
        File::create(&root).expect("test file must be created");

        let error = initialize_for_root(root.clone()).expect_err("file cannot be a workspace root");

        assert_eq!(error.code, "E_STORAGE_WORKSPACE_INITIALIZATION_FAILED");
        assert_eq!(error.domain, ErrorDomain::Storage);
        assert!(error.retryable);
        assert_eq!(
            error.message,
            "The local workspace could not be initialized."
        );
        assert!(error.details.is_empty());

        fs::remove_file(root).expect("test file must be removed");
    }
}
