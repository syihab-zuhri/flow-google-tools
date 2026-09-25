use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Mp4,
    Webm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
pub enum ResolutionPreset {
    #[serde(rename = "original")]
    Original,
    #[serde(rename = "1080p")]
    Res1080p,
    #[serde(rename = "720p")]
    Res720p,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConcatSegmentsRequest {
    pub client_request_id: String,
    pub project_id: String,
    pub segment_paths: Vec<String>,
    pub output_path: String,
    pub format: OutputFormat,
    pub resolution: ResolutionPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportVideoResponse {
    pub success: bool,
    pub output_path: String,
    pub duration_seconds: f64,
    pub file_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportVideoRequest {
    pub client_request_id: String,
    pub project_id: String,
    pub format: OutputFormat,
    pub resolution: ResolutionPreset,
    pub video_bitrate_kbps: Option<u32>,
    pub audio_bitrate_kbps: Option<u32>,
    pub output_directory: String,
    pub custom_filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportSegmentRequest {
    pub segment_id: String,
    pub source_video_path: String,
    pub target_path: String,
    pub format: OutputFormat,
    pub resolution: ResolutionPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportSegmentResponse {
    pub exported_path: String,
    pub file_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct PreviewExportResponse {
    pub preview_file_path: String,
    pub segment_markers: Vec<f64>,
    pub total_duration_seconds: f64,
}

pub fn generate_concat_manifest(segment_paths: &[String]) -> String {
    let mut manifest = String::new();
    for path in segment_paths {
        // Escape single quotes for ffmpeg concat demuxer
        let escaped = path.replace('\'', "'\\''");
        manifest.push_str(&format!("file '{escaped}'\n"));
    }
    manifest
}

pub fn build_concat_command_args(
    request: &ConcatSegmentsRequest,
    manifest_path: &Path,
) -> (String, Vec<String>) {
    let mut args = vec![
        "-y".to_string(),
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        manifest_path.to_string_lossy().to_string(),
    ];

    match (request.format, request.resolution) {
        (OutputFormat::Mp4, ResolutionPreset::Original) => {
            args.extend_from_slice(&[
                "-c".to_string(),
                "copy".to_string(),
                "-map_metadata".to_string(),
                "-1".to_string(),
            ]);
        }
        (OutputFormat::Mp4, res) => {
            let filter = match res {
                ResolutionPreset::Res1080p => "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                ResolutionPreset::Res720p => "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
                ResolutionPreset::Original => "",
            };
            if !filter.is_empty() {
                args.extend_from_slice(&["-vf".to_string(), filter.to_string()]);
            }
            args.extend_from_slice(&[
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                "medium".to_string(),
                "-c:a".to_string(),
                "aac".to_string(),
                "-map_metadata".to_string(),
                "-1".to_string(),
            ]);
        }
        (OutputFormat::Webm, res) => {
            let filter = match res {
                ResolutionPreset::Res1080p => "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                ResolutionPreset::Res720p => "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
                ResolutionPreset::Original => "",
            };
            if !filter.is_empty() {
                args.extend_from_slice(&["-vf".to_string(), filter.to_string()]);
            }
            args.extend_from_slice(&[
                "-c:v".to_string(),
                "libvpx-vp9".to_string(),
                "-c:a".to_string(),
                "libopus".to_string(),
                "-map_metadata".to_string(),
                "-1".to_string(),
            ]);
        }
    }

    args.push(request.output_path.clone());
    ("ffmpeg".to_string(), args)
}

pub fn build_transcode_command_args(
    request: &ExportVideoRequest,
    input_path: &str,
    output_path: &Path,
) -> (String, Vec<String>) {
    let mut args = vec!["-y".to_string(), "-i".to_string(), input_path.to_string()];

    let filter = match request.resolution {
        ResolutionPreset::Res1080p => {
            "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
        }
        ResolutionPreset::Res720p => {
            "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2"
        }
        ResolutionPreset::Original => "",
    };

    if !filter.is_empty() {
        args.extend_from_slice(&["-vf".to_string(), filter.to_string()]);
    }

    let v_bitrate = format!("{}k", request.video_bitrate_kbps.unwrap_or(8000));
    let a_bitrate = format!("{}k", request.audio_bitrate_kbps.unwrap_or(192));

    match request.format {
        OutputFormat::Mp4 => {
            args.extend_from_slice(&[
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                "medium".to_string(),
                "-b:v".to_string(),
                v_bitrate,
                "-c:a".to_string(),
                "aac".to_string(),
                "-b:a".to_string(),
                a_bitrate,
                "-map_metadata".to_string(),
                "-1".to_string(),
            ]);
        }
        OutputFormat::Webm => {
            args.extend_from_slice(&[
                "-c:v".to_string(),
                "libvpx-vp9".to_string(),
                "-b:v".to_string(),
                v_bitrate,
                "-c:a".to_string(),
                "libopus".to_string(),
                "-b:a".to_string(),
                a_bitrate,
                "-map_metadata".to_string(),
                "-1".to_string(),
            ]);
        }
    }

    args.push(output_path.to_string_lossy().to_string());
    ("ffmpeg".to_string(), args)
}

pub fn execute_concat_segments(
    request: &ConcatSegmentsRequest,
) -> Result<ExportVideoResponse, String> {
    if request.segment_paths.is_empty() {
        return Err("Cannot concatenate: No segments provided.".to_string());
    }

    let out_path = Path::new(&request.output_path);
    if let Some(parent) = out_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination dir: {e}"))?;
        }
    }

    let manifest_content = generate_concat_manifest(&request.segment_paths);
    let manifest_path = out_path.with_extension("concat_manifest.txt");
    {
        let mut f = File::create(&manifest_path)
            .map_err(|e| format!("Failed to create manifest file: {e}"))?;
        f.write_all(manifest_content.as_bytes())
            .map_err(|e| format!("Failed to write manifest file: {e}"))?;
    }

    let (binary, args) = build_concat_command_args(request, &manifest_path);
    let output = Command::new(&binary)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute {binary}: {e}"))?;

    let _ = fs::remove_file(&manifest_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg concatenation failed: {stderr}"));
    }

    let file_size_bytes = fs::metadata(out_path).map(|m| m.len()).unwrap_or(0);
    let estimated_duration = (request.segment_paths.len() as f64) * 10.0;

    Ok(ExportVideoResponse {
        success: true,
        output_path: request.output_path.clone(),
        duration_seconds: estimated_duration,
        file_size_bytes,
    })
}

pub fn execute_preview_export(
    project_id: &str,
    segment_paths: &[String],
    cache_directory: &Path,
) -> Result<PreviewExportResponse, String> {
    if segment_paths.is_empty() {
        return Err("Cannot generate preview: No segments provided.".to_string());
    }

    if !cache_directory.exists() {
        fs::create_dir_all(cache_directory)
            .map_err(|e| format!("Failed to create cache dir: {e}"))?;
    }

    let preview_file = cache_directory.join(format!("{project_id}_preview.mp4"));
    let req = ConcatSegmentsRequest {
        client_request_id: format!("preview-{project_id}"),
        project_id: project_id.to_string(),
        segment_paths: segment_paths.to_vec(),
        output_path: preview_file.to_string_lossy().to_string(),
        format: OutputFormat::Mp4,
        resolution: ResolutionPreset::Original,
    };

    let concat_res = execute_concat_segments(&req)?;

    let mut segment_markers = Vec::new();
    let mut current_offset = 0.0;
    for _ in segment_paths {
        segment_markers.push(current_offset);
        current_offset += 10.0;
    }

    Ok(PreviewExportResponse {
        preview_file_path: concat_res.output_path,
        segment_markers,
        total_duration_seconds: current_offset,
    })
}
