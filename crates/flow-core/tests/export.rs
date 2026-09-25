use flow_core::export::{
    build_concat_command_args, build_transcode_command_args, generate_concat_manifest,
    ConcatSegmentsRequest, ExportVideoRequest, OutputFormat, ResolutionPreset,
};
use std::path::PathBuf;

#[test]
fn test_generate_concat_manifest_content() {
    let segment_paths = vec![
        "/path/to/segment_001.mp4".to_string(),
        "/path/to/segment_002.mp4".to_string(),
    ];

    let manifest = generate_concat_manifest(&segment_paths);
    assert_eq!(
        manifest,
        "file '/path/to/segment_001.mp4'\nfile '/path/to/segment_002.mp4'\n"
    );
}

#[test]
fn test_build_concat_command_args_stream_copy() {
    let req = ConcatSegmentsRequest {
        client_request_id: "req-1".to_string(),
        project_id: "proj-1".to_string(),
        segment_paths: vec!["/tmp/seg_1.mp4".to_string(), "/tmp/seg_2.mp4".to_string()],
        output_path: "/tmp/output.mp4".to_string(),
        format: OutputFormat::Mp4,
        resolution: ResolutionPreset::Original,
    };

    let manifest_path = PathBuf::from("/tmp/manifest.txt");
    let (binary, args) = build_concat_command_args(&req, &manifest_path);

    assert_eq!(binary, "ffmpeg");
    assert!(args.contains(&"-f".to_string()));
    assert!(args.contains(&"concat".to_string()));
    assert!(args.contains(&"-safe".to_string()));
    assert!(args.contains(&"0".to_string()));
    assert!(args.contains(&"-c".to_string()));
    assert!(args.contains(&"copy".to_string()));
    assert!(args.contains(&"-map_metadata".to_string()));
    assert!(args.contains(&"-1".to_string()));
}

#[test]
fn test_build_transcode_command_args_webm_720p() {
    let req = ExportVideoRequest {
        client_request_id: "req-2".to_string(),
        project_id: "proj-1".to_string(),
        format: OutputFormat::Webm,
        resolution: ResolutionPreset::Res720p,
        video_bitrate_kbps: Some(4000),
        audio_bitrate_kbps: Some(128),
        output_directory: "/tmp/exports".to_string(),
        custom_filename: Some("my_final_video".to_string()),
    };

    let input_path = "/tmp/composed_raw.mp4";
    let output_file = PathBuf::from("/tmp/exports/my_final_video.webm");
    let (binary, args) = build_transcode_command_args(&req, input_path, &output_file);

    assert_eq!(binary, "ffmpeg");
    assert!(args.contains(&"libvpx-vp9".to_string()));
    assert!(args.contains(&"libopus".to_string()));
    assert!(args.iter().any(|arg| arg.contains("1280:720")));
}
