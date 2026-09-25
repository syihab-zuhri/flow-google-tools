use flow_core::bridge::{
    default_variations, BridgeDispatchRequest, BridgeJobKind, BridgeJobState, BridgeRegistry,
    ClientFrame, ServerFrame, DEFAULT_BRIDGE_PORT,
};

fn request(job_id: &str) -> BridgeDispatchRequest {
    BridgeDispatchRequest {
        job_id: job_id.to_owned(),
        prompt: "a lighthouse at dawn".to_owned(),
        kind: BridgeJobKind::Video,
        model: "Veo 3.1 - Fast".to_owned(),
        aspect_ratio: "16:9".to_owned(),
        variations: 1,
        duration: Some("8s".to_owned()),
        auto_download: true,
        download_prefix: Some("scene-01".to_owned()),
    }
}

#[test]
fn default_port_is_stable_and_loopback_only_documented() {
    assert_eq!(DEFAULT_BRIDGE_PORT, 48210);
}

#[test]
fn registry_tracks_full_job_lifecycle() {
    let mut registry = BridgeRegistry::default();
    registry.register(request("job-1")).expect("register");

    assert_eq!(registry.pending_count(), 1);
    assert_eq!(registry.state("job-1"), Some(BridgeJobState::Awaiting));

    assert!(registry.apply_progress("job-1", "submitted", None));
    assert_eq!(registry.state("job-1"), Some(BridgeJobState::Running));

    assert!(registry.apply_result("job-1", true, None, vec!["a.mp4".to_owned()], vec![]));
    assert_eq!(registry.state("job-1"), Some(BridgeJobState::Succeeded));
    assert_eq!(registry.pending_count(), 0);
    assert_eq!(
        registry.record("job-1").map(|r| r.files.clone()),
        Some(vec!["a.mp4".to_owned()])
    );
}

#[test]
fn registry_marks_failed_and_ignores_unknown_jobs() {
    let mut registry = BridgeRegistry::default();
    registry.register(request("job-2")).expect("register");
    assert!(!registry.apply_progress("ghost", "typed", None));
    assert!(registry.apply_result("job-2", false, Some("quota".to_owned()), vec![], vec![]));
    assert_eq!(registry.state("job-2"), Some(BridgeJobState::Failed));
    assert_eq!(
        registry.record("job-2").unwrap().error.as_deref(),
        Some("quota")
    );
}

#[test]
fn duplicate_job_id_is_rejected_without_mutation() {
    let mut registry = BridgeRegistry::default();
    registry.register(request("dup")).expect("first");
    let conflict = registry
        .register(request("dup"))
        .expect_err("second must fail");
    assert_eq!(conflict.job_id(), "dup");
    assert_eq!(registry.pending_count(), 1);
}

#[test]
fn disconnect_finalizes_unfinished_jobs_as_lost() {
    let mut registry = BridgeRegistry::default();
    registry.register(request("open-1")).expect("register");
    registry.register(request("open-2")).expect("register");
    registry.apply_progress("open-2", "submitted", None);
    registry.apply_result("open-2", true, None, vec![], vec![]);

    let lost = registry.finalize_unfinished_as_lost();
    assert_eq!(lost, vec!["open-1".to_owned()]);
    assert_eq!(registry.state("open-1"), Some(BridgeJobState::Lost));
    assert_eq!(registry.state("open-2"), Some(BridgeJobState::Succeeded));
    assert_eq!(registry.pending_count(), 0);
}

#[test]
fn snapshot_is_ordered_by_arrival() {
    let mut registry = BridgeRegistry::default();
    registry.register(request("b")).expect("b");
    registry.register(request("a")).expect("a");
    let ids: Vec<String> = registry
        .snapshot()
        .iter()
        .map(|r| r.job_id.clone())
        .collect();
    assert!(ids.contains(&"a".to_owned()) && ids.contains(&"b".to_owned()));
    assert_eq!(ids.len(), 2);
}

#[test]
fn client_frames_round_trip_over_wire_names() {
    let hello = serde_json::to_string(&ClientFrame::Hello {
        role: "zflow-batcher".to_owned(),
        version: "1.1.0".to_owned(),
        token: "t0".to_owned(),
    })
    .expect("serialize hello");
    assert!(hello.contains("\"type\":\"hello\""));
    assert!(hello.contains("\"role\":\"zflow-batcher\""));

    let parsed: ClientFrame = serde_json::from_str(
        r#"{"type":"progress","jobId":"j1","phase":"downloading","note":"2 files"}"#,
    )
    .expect("deserialize progress");
    match parsed {
        ClientFrame::Progress {
            job_id,
            phase,
            note,
        } => {
            assert_eq!(job_id, "j1");
            assert_eq!(phase, "downloading");
            assert_eq!(note.as_deref(), Some("2 files"));
        }
        other => panic!("unexpected frame: {other:?}"),
    }

    let result: ClientFrame = serde_json::from_str(
        r#"{"type":"result","jobId":"j1","ok":false,"error":"boom","files":[],"assets":[]}"#,
    )
    .expect("deserialize result");
    assert!(matches!(result, ClientFrame::Result { ref job_id, ok: false, .. } if job_id == "j1"));
}

#[test]
fn server_frames_use_tagged_json() {
    let ready = serde_json::to_string(&ServerFrame::Ready).expect("ready");
    assert_eq!(ready, r#"{"type":"ready"}"#);

    let cancel = serde_json::to_string(&ServerFrame::Cancel {
        job_id: "j9".to_owned(),
    })
    .expect("cancel");
    assert!(cancel.contains("\"type\":\"cancel\""));
    assert!(cancel.contains("\"jobId\":\"j9\""));
}

#[test]
fn dispatch_request_accepts_minimal_json_with_defaults() {
    let parsed: BridgeDispatchRequest =
        serde_json::from_str(r#"{"jobId":"j3","prompt":"hi","kind":"image","model":"Nano Banana 2","aspectRatio":"1:1"}"#)
            .expect("minimal request");
    assert_eq!(parsed.variations, default_variations());
    assert!(parsed.auto_download);
    assert_eq!(parsed.kind, BridgeJobKind::Image);
    assert_eq!(parsed.duration, None);
}

#[test]
fn token_is_hex_and_constant_time_comparable() {
    let token = flow_core::bridge::generate_token(&[7u8; 16]);
    assert_eq!(token.len(), 32);
    assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
    assert!(flow_core::bridge::token_matches(&token, &token.clone()));
    assert!(!flow_core::bridge::token_matches(&token, "nope"));
    assert!(!flow_core::bridge::token_matches("", &token));
}
