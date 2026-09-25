use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

pub const MAX_CONTEXT_PROMPTS: usize = 3;
pub const MAX_PROMPT_CHARS_LIMIT: usize = 2000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct PromptContextRequest {
    pub current_prompt: String,
    pub previous_prompts: Vec<String>,
    pub style_lock_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ComposedPromptResponse {
    pub final_composed_prompt: String,
    pub style_lock_applied: Option<String>,
    pub context_carry_over_applied: Option<String>,
    pub total_characters: usize,
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct FrameResolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtractFrameRequest {
    pub video_path: String,
    pub output_directory: String,
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtractFrameResponse {
    pub frame_path: String,
    pub resolution: FrameResolution,
    pub extraction_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub struct StyleLockResponse {
    pub project_id: String,
    pub style_lock_text: Option<String>,
    pub updated_at: u64,
}

pub fn compose_prompt_context(request: &PromptContextRequest) -> ComposedPromptResponse {
    let style_lock_cleaned = request
        .style_lock_text
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let relevant_prompts: Vec<String> = request
        .previous_prompts
        .iter()
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .take(MAX_CONTEXT_PROMPTS)
        .collect();

    let carry_over = if relevant_prompts.is_empty() {
        None
    } else {
        Some(relevant_prompts.join(" -> "))
    };

    let mut parts: Vec<String> = Vec::new();

    if let Some(ref style) = style_lock_cleaned {
        parts.push(format!("[Style Lock: {style}]"));
    }

    if let Some(ref context) = carry_over {
        parts.push(format!("Continuing from: {context}."));
    }

    let current = request.current_prompt.trim();
    if parts.is_empty() {
        let is_truncated = current.len() > MAX_PROMPT_CHARS_LIMIT;
        let final_prompt = if is_truncated {
            current.chars().take(MAX_PROMPT_CHARS_LIMIT).collect()
        } else {
            current.to_string()
        };

        return ComposedPromptResponse {
            total_characters: final_prompt.len(),
            final_composed_prompt: final_prompt,
            style_lock_applied: None,
            context_carry_over_applied: None,
            is_truncated,
        };
    }

    parts.push(format!("Next scene: {current}"));
    let raw_combined = parts.join(" ");

    let is_truncated = raw_combined.len() > MAX_PROMPT_CHARS_LIMIT;
    let final_composed_prompt = if is_truncated {
        raw_combined.chars().take(MAX_PROMPT_CHARS_LIMIT).collect()
    } else {
        raw_combined
    };

    let total_characters = final_composed_prompt.len();

    ComposedPromptResponse {
        final_composed_prompt,
        style_lock_applied: style_lock_cleaned,
        context_carry_over_applied: carry_over,
        total_characters,
        is_truncated,
    }
}

pub fn extract_last_frame_command_args(
    request: &ExtractFrameRequest,
) -> Result<(String, Vec<String>, PathBuf), String> {
    let video_path = Path::new(&request.video_path);
    let stem = video_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("segment");

    let out_dir = Path::new(&request.output_directory);
    let output_file_name = format!("{stem}_last_frame.png");
    let output_path = out_dir.join(output_file_name);

    let args = vec![
        "-y".to_string(),
        "-sseof".to_string(),
        "-1".to_string(),
        "-i".to_string(),
        request.video_path.clone(),
        "-update".to_string(),
        "1".to_string(),
        "-q:v".to_string(),
        "1".to_string(),
        output_path.to_string_lossy().to_string(),
    ];

    Ok(("ffmpeg".to_string(), args, output_path))
}

pub fn execute_extract_last_frame(
    request: &ExtractFrameRequest,
) -> Result<ExtractFrameResponse, String> {
    let start_time = Instant::now();
    let (binary, args, output_path) = extract_last_frame_command_args(request)?;

    if let Some(parent) = output_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {e}"))?;
        }
    }

    let status = Command::new(&binary)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute {binary}: {e}"))?;

    if !status.status.success() {
        let stderr = String::from_utf8_lossy(&status.stderr);
        return Err(format!("FFmpeg extraction failed: {stderr}"));
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    Ok(ExtractFrameResponse {
        frame_path: output_path.to_string_lossy().to_string(),
        resolution: FrameResolution {
            width: 1920,
            height: 1080,
        },
        extraction_duration_ms: duration_ms,
    })
}
