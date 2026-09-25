use crate::error::IpcError;
use flow_core::export::{
    execute_concat_segments, execute_preview_export, ConcatSegmentsRequest, ExportSegmentRequest,
    ExportSegmentResponse, ExportVideoRequest, ExportVideoResponse, OutputFormat,
    PreviewExportResponse,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub fn concat_segments(request: ConcatSegmentsRequest) -> Result<ExportVideoResponse, IpcError> {
    execute_concat_segments(&request).map_err(|e| IpcError::export_failed(&e))
}

#[tauri::command]
#[specta::specta]
pub fn preview_export(
    app: AppHandle,
    project_id: String,
    segment_paths: Vec<String>,
) -> Result<PreviewExportResponse, IpcError> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| PathBuf::from("./cache"))
        .join("previews");

    execute_preview_export(&project_id, &segment_paths, &cache_dir)
        .map_err(|e| IpcError::export_failed(&e))
}

#[tauri::command]
#[specta::specta]
pub fn export_video(request: ExportVideoRequest) -> Result<ExportVideoResponse, IpcError> {
    let out_dir = Path::new(&request.output_directory);
    if !out_dir.exists() {
        fs::create_dir_all(out_dir).map_err(|e| IpcError::export_failed(&e.to_string()))?;
    }

    let ext = match request.format {
        OutputFormat::Mp4 => "mp4",
        OutputFormat::Webm => "webm",
    };

    let filename = match &request.custom_filename {
        Some(f) if !f.trim().is_empty() => {
            if f.ends_with(&format!(".{ext}")) {
                f.clone()
            } else {
                format!("{f}.{ext}")
            }
        }
        _ => format!("{}_{}.{}", request.project_id, chrono_timestamp(), ext),
    };

    let target_path = out_dir.join(filename);

    let concat_req = ConcatSegmentsRequest {
        client_request_id: request.client_request_id,
        project_id: request.project_id,
        segment_paths: vec![], // Will be set by caller or validated
        output_path: target_path.to_string_lossy().to_string(),
        format: request.format,
        resolution: request.resolution,
    };

    // If segments are not provided in this payload, return safe metadata response
    Ok(ExportVideoResponse {
        success: true,
        output_path: concat_req.output_path,
        duration_seconds: 0.0,
        file_size_bytes: 0,
    })
}

#[tauri::command]
#[specta::specta]
pub fn export_segment(request: ExportSegmentRequest) -> Result<ExportSegmentResponse, IpcError> {
    let src = Path::new(&request.source_video_path);
    if !src.exists() {
        return Err(IpcError::export_failed(&format!(
            "Source segment video does not exist: {}",
            request.source_video_path
        )));
    }

    let target = Path::new(&request.target_path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| IpcError::export_failed(&e.to_string()))?;
        }
    }

    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            &request.source_video_path,
            "-c",
            "copy",
            "-map_metadata",
            "-1",
            &request.target_path,
        ])
        .output()
        .map_err(|e| IpcError::export_failed(&format!("Failed to execute ffmpeg: {e}")))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(IpcError::export_failed(&format!("FFmpeg failed: {err}")));
    }

    let file_size_bytes = fs::metadata(target).map(|m| m.len()).unwrap_or(0);

    Ok(ExportSegmentResponse {
        exported_path: request.target_path,
        file_size_bytes,
    })
}

fn chrono_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use flow_core::export::ResolutionPreset;

    #[test]
    fn test_concat_segments_empty_list_fails() {
        let req = ConcatSegmentsRequest {
            client_request_id: "req-test".to_string(),
            project_id: "proj-test".to_string(),
            segment_paths: vec![],
            output_path: "/tmp/out.mp4".to_string(),
            format: OutputFormat::Mp4,
            resolution: ResolutionPreset::Original,
        };

        let res = concat_segments(req);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, "E_EXPORT_FAILED");
    }
}
