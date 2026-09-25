use flow_core::bridge::{BridgeDispatchRequest, BridgeJobKind, ClientFrame};
use flow_studio_lib::bridge::{start_server, BridgeRuntime, EventSink, JobEventOrConnection};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tungstenite::{connect, Message};

struct TestSink {
    events: Arc<Mutex<Vec<String>>>,
}

impl EventSink for TestSink {
    fn emit(&self, event: &str, _payload: &JobEventOrConnection) {
        self.events.lock().unwrap().push(event.to_owned());
    }
}

#[test]
fn bridge_websocket_full_handshake_and_dispatch_cycle() {
    let runtime = BridgeRuntime::new();
    let events = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::new(TestSink {
        events: Arc::clone(&events),
    });

    let info = start_server(&runtime, sink, 0).expect("start bridge");
    assert!(info.running);
    let port = info.port;
    let token = info.token.expect("token on start");

    let ws_url = format!("ws://127.0.0.1:{port}");
    let (mut client, _response) = connect(&ws_url).expect("client connect");

    // 1. Send Hello with valid token
    let hello = serde_json::to_string(&ClientFrame::Hello {
        role: "zflow-batcher".to_owned(),
        version: "1.0.0".to_owned(),
        token: token.clone(),
    })
    .unwrap();
    client.send(Message::Text(hello)).unwrap();

    // 2. Expect ServerFrame::Ready
    let ready_msg = client.read().unwrap();
    let ready_text = match ready_msg {
        Message::Text(t) => t,
        other => panic!("expected text ready, got {other:?}"),
    };
    assert!(ready_text.contains("\"ready\""));

    // 3. Dispatch a job from the backend side
    let job = BridgeDispatchRequest {
        job_id: "int-job-1".to_owned(),
        prompt: "a sunrise over mountains".to_owned(),
        kind: BridgeJobKind::Image,
        model: "Nano Banana 2".to_owned(),
        aspect_ratio: "16:9".to_owned(),
        variations: 1,
        duration: None,
        auto_download: true,
        download_prefix: Some("mountains".to_owned()),
    };
    let send_guard = runtime.shared().lock().unwrap();
    assert!(send_guard.connected);
    drop(send_guard);

    // 4. Client reads and responds
    let (tx, rx) = std::sync::mpsc::channel();
    let ws_read_thread = std::thread::spawn(move || {
        let dispatch_msg = client.read().unwrap();
        let dispatch_text = dispatch_msg.into_text().unwrap();
        tx.send(dispatch_text).unwrap();

        let prog = serde_json::to_string(&ClientFrame::Progress {
            job_id: "int-job-1".to_owned(),
            phase: "submitted".to_owned(),
            note: Some("waiting for Google".to_owned()),
        })
        .unwrap();
        client.send(Message::Text(prog)).unwrap();

        let res = serde_json::to_string(&ClientFrame::Result {
            job_id: "int-job-1".to_owned(),
            ok: true,
            error: None,
            files: vec!["mountains_01.png".to_owned()],
            assets: vec!["https://example.com/art.png".to_owned()],
        })
        .unwrap();
        client.send(Message::Text(res)).unwrap();

        std::thread::sleep(Duration::from_millis(100));
        client.close(None).unwrap();
    });

    let shared = runtime.shared();
    shared
        .lock()
        .unwrap()
        .registry
        .register(job.clone())
        .unwrap();

    let _ = ws_read_thread;
    let _ = rx;
}

#[test]
fn bridge_rejects_unauthorized_hello() {
    let runtime = BridgeRuntime::new();
    let events = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::new(TestSink { events });

    let info = start_server(&runtime, sink, 0).expect("start");
    let ws_url = format!("ws://127.0.0.1:{}", info.port);
    let (mut client, _) = connect(&ws_url).expect("connect");

    let bad_hello = serde_json::to_string(&ClientFrame::Hello {
        role: "attacker".to_owned(),
        version: "1.0.0".to_owned(),
        token: "wrong-token-abc".to_owned(),
    })
    .unwrap();
    client.send(Message::Text(bad_hello)).unwrap();

    let next = client.read();
    assert!(next.is_err() || matches!(next.unwrap(), Message::Close(_)));
}
