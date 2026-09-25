use crate::error::IpcError;
use flow_core::continuity::{
    compose_prompt_context, execute_extract_last_frame, ComposedPromptResponse,
    ExtractFrameRequest, ExtractFrameResponse, PromptContextRequest, StyleLockResponse,
};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
#[specta::specta]
pub fn extract_frame(request: ExtractFrameRequest) -> Result<ExtractFrameResponse, IpcError> {
    execute_extract_last_frame(&request)
        .map_err(|e| IpcError::continuity_failed("E_CONTINUITY_EXTRACTION_FAILED", &e))
}

#[tauri::command]
#[specta::specta]
pub fn get_prompt_context(
    request: PromptContextRequest,
) -> Result<ComposedPromptResponse, IpcError> {
    Ok(compose_prompt_context(&request))
}

#[tauri::command]
#[specta::specta]
pub fn set_style_lock(
    project_id: String,
    style_lock_text: Option<String>,
) -> Result<StyleLockResponse, IpcError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    Ok(StyleLockResponse {
        project_id,
        style_lock_text,
        updated_at: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_get_prompt_context_composition() {
        let req = PromptContextRequest {
            current_prompt: "Cyberpunk vehicle race through highway.".to_string(),
            previous_prompts: vec!["Scene A: Pilot starts engine.".to_string()],
            style_lock_text: Some("Neo-noir photorealistic".to_string()),
        };

        let result = get_prompt_context(req).expect("Prompt composition should succeed");
        assert!(result
            .final_composed_prompt
            .starts_with("[Style Lock: Neo-noir photorealistic]"));
        assert!(result.final_composed_prompt.contains("Continuing from: "));
    }

    #[test]
    fn test_ipc_set_style_lock() {
        let resp = set_style_lock(
            "proj-123".to_string(),
            Some("Cinematic 35mm film".to_string()),
        )
        .expect("Set style lock should succeed");

        assert_eq!(resp.project_id, "proj-123");
        assert_eq!(
            resp.style_lock_text,
            Some("Cinematic 35mm film".to_string())
        );
        assert!(resp.updated_at > 0);
    }
}
