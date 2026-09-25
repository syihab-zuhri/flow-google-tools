use flow_core::continuity::{
    compose_prompt_context, extract_last_frame_command_args, ExtractFrameRequest,
    PromptContextRequest,
};
use std::path::PathBuf;

#[test]
fn test_compose_prompt_context_with_style_lock_and_sliding_window() {
    let request = PromptContextRequest {
        current_prompt: "The cyber detective enters the abandoned neon warehouse.".to_string(),
        previous_prompts: vec![
            "Scene 1: Detective walks in rain.".to_string(),
            "Scene 2: Detective arrives at warehouse.".to_string(),
            "Scene 3: Detective draws weapon.".to_string(),
            "Scene 0: Unused older scene.".to_string(), // Should be sliced to last 3
        ],
        style_lock_text: Some("35mm anamorphic, blade runner aesthetic, 8k".to_string()),
    };

    let composed = compose_prompt_context(&request);

    // Style lock applied
    assert_eq!(
        composed.style_lock_applied,
        Some("35mm anamorphic, blade runner aesthetic, 8k".to_string())
    );

    // Window must take at most last 3 items
    assert!(composed.context_carry_over_applied.is_some());
    let carry_over = composed.context_carry_over_applied.unwrap();
    assert!(carry_over.contains("Scene 1: Detective walks in rain."));
    assert!(carry_over.contains("Scene 2: Detective arrives at warehouse."));
    assert!(carry_over.contains("Scene 3: Detective draws weapon."));
    assert!(!carry_over.contains("Scene 0: Unused older scene."));

    // Final string structure
    assert!(composed
        .final_composed_prompt
        .starts_with("[Style Lock: 35mm anamorphic, blade runner aesthetic, 8k]"));
    assert!(composed.final_composed_prompt.contains("Continuing from: "));
    assert!(composed
        .final_composed_prompt
        .contains("Next scene: The cyber detective enters the abandoned neon warehouse."));
}

#[test]
fn test_compose_prompt_without_history_or_style_lock() {
    let request = PromptContextRequest {
        current_prompt: "A peaceful sunrise over the mountains.".to_string(),
        previous_prompts: vec![],
        style_lock_text: None,
    };

    let composed = compose_prompt_context(&request);
    assert_eq!(
        composed.final_composed_prompt,
        "A peaceful sunrise over the mountains."
    );
    assert_eq!(composed.style_lock_applied, None);
    assert_eq!(composed.context_carry_over_applied, None);
    assert_eq!(composed.is_truncated, false);
}

#[test]
fn test_extract_last_frame_args_generation() {
    let request = ExtractFrameRequest {
        video_path: "/projects/clip_01.mp4".to_string(),
        output_directory: "/projects/assets".to_string(),
        method: "sseof".to_string(),
    };

    let (binary, args, output_png) =
        extract_last_frame_command_args(&request).expect("Must generate safe args");
    assert_eq!(binary, "ffmpeg");
    assert!(args.contains(&"-sseof".to_string()));
    assert!(args.contains(&"-1".to_string()));
    assert!(args.contains(&"-i".to_string()));
    assert!(args.contains(&"/projects/clip_01.mp4".to_string()));
    assert_eq!(
        output_png,
        PathBuf::from("/projects/assets/clip_01_last_frame.png")
    );
}
