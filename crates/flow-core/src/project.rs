use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::time::SystemTime;

pub const PROJECT_FILE_VERSION: &str = "1.0.0";
pub const MAX_PROJECT_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10MB limit

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ViewportData {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectNode {
    pub id: String,
    pub r#type: String,
    pub position: NodePosition,
    #[specta(type = serde_json::Value)]
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGraphData {
    pub nodes: Vec<ProjectNode>,
    pub edges: Vec<ProjectEdge>,
    pub viewport: ViewportData,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub default_model: String,
    pub auto_save_interval_seconds: u32,
    pub style_lock_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectRequest {
    pub file_path: String,
    pub project_name: String,
    pub settings: ProjectSettings,
    pub graph: ProjectGraphData,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectResponse {
    pub saved_path: String,
    pub saved_at: String,
    pub file_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct LoadProjectResponse {
    pub project_name: String,
    pub version: String,
    pub settings: ProjectSettings,
    pub graph: ProjectGraphData,
    pub assets: Vec<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummaryResponse {
    pub project_name: String,
    pub file_path: String,
    pub last_modified: String,
    pub segment_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProjectPayload {
    version: String,
    project_name: String,
    settings: ProjectSettings,
    graph: ProjectGraphData,
    assets: Vec<String>,
    updated_at: String,
}

fn current_iso_timestamp() -> String {
    let now = SystemTime::now();
    let duration = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}Z", duration.as_secs(), duration.subsec_millis())
}

pub fn save_project_file(request: &SaveProjectRequest) -> Result<SaveProjectResponse, String> {
    let target_path = Path::new(&request.file_path);
    if let Some(parent) = target_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {e}"))?;
        }
    }

    let payload = StoredProjectPayload {
        version: PROJECT_FILE_VERSION.to_string(),
        project_name: request.project_name.clone(),
        settings: request.settings.clone(),
        graph: request.graph.clone(),
        assets: Vec::new(),
        updated_at: current_iso_timestamp(),
    };

    let serialized =
        serde_json::to_vec_pretty(&payload).map_err(|e| format!("Serialization error: {e}"))?;

    let byte_len = serialized.len() as u64;
    if byte_len > MAX_PROJECT_FILE_SIZE_BYTES {
        return Err(format!(
            "Project file exceeds 10MB limit ({byte_len} bytes)"
        ));
    }

    let tmp_path = format!("{}.tmp", request.file_path);
    {
        let mut tmp_file =
            File::create(&tmp_path).map_err(|e| format!("Failed to create temp file: {e}"))?;
        tmp_file
            .write_all(&serialized)
            .map_err(|e| format!("Failed to write temp file: {e}"))?;
        tmp_file
            .sync_all()
            .map_err(|e| format!("Failed to sync temp file: {e}"))?;
    }

    fs::rename(&tmp_path, target_path).map_err(|e| format!("Atomic rename failed: {e}"))?;

    Ok(SaveProjectResponse {
        saved_path: request.file_path.clone(),
        saved_at: payload.updated_at,
        file_size_bytes: byte_len,
    })
}

pub fn load_project_file(file_path: &str) -> Result<LoadProjectResponse, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("Project file not found at: {file_path}"));
    }

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;
    let payload: StoredProjectPayload =
        serde_json::from_str(&content).map_err(|e| format!("Invalid .flowproj JSON: {e}"))?;

    Ok(LoadProjectResponse {
        project_name: payload.project_name,
        version: payload.version,
        settings: payload.settings,
        graph: payload.graph,
        assets: payload.assets,
        updated_at: payload.updated_at,
    })
}

pub fn delete_project_file(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete project: {e}"))?;
    }
    let tmp_path = format!("{file_path}.tmp");
    let tmp = Path::new(&tmp_path);
    if tmp.exists() {
        let _ = fs::remove_file(tmp);
    }
    Ok(())
}
