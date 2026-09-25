//! Browser Bridge transport (ADR-009, API-BRIDGE-001..004).
//!
//! A single-client WebSocket server bound strictly to the loopback interface.
//! Domain rules (job FSM, token comparison) live in `flow_core::bridge`; this
//! module owns sockets, the Tauri event sink, and the IPC commands.

use crate::error::{ErrorDomain, IpcError};
use flow_core::bridge::{
    token_matches, BridgeDispatchRequest, BridgeJobKind, BridgeJobRecord, BridgeJobState,
    BridgeRegistry, ClientFrame, ServerFrame, BRIDGE_BIND_ADDRESS, DEFAULT_BRIDGE_PORT,
};
use getrandom::fill;
use serde::Serialize;
use specta::Type;
use std::collections::BTreeMap;
use std::io::ErrorKind;
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tungstenite::{Error as WsError, Message, WebSocket};

const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(20);
const READ_TICK: Duration = Duration::from_millis(120);
pub const EVENT_CONNECTION: &str = "bridge:connection_changed";
pub const EVENT_JOB: &str = "bridge:job_event";

// ─── Event payloads (API-EVT-009 / API-EVT-010) ───────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionChangedEvent {
    pub sequence_id: u64,
    pub timestamp: f64,
    pub connected: bool,
    pub extension_version: Option<String>,
    pub bound_port: u16,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEvent {
    pub sequence_id: u64,
    pub timestamp: f64,
    pub job_id: String,
    pub state: BridgeJobState,
    pub phase: Option<String>,
    pub note: Option<String>,
    pub error: Option<String>,
    pub files: Vec<String>,
    pub assets: Vec<String>,
}

pub trait EventSink: Send + Sync {
    fn emit(&self, event: &str, payload: &JobEventOrConnection);
}

pub enum JobEventOrConnection {
    Connection(ConnectionChangedEvent),
    Job(JobEvent),
}

pub struct TauriEventSink {
    app: AppHandle,
}

impl TauriEventSink {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl EventSink for TauriEventSink {
    fn emit(&self, event: &str, payload: &JobEventOrConnection) {
        let result = match payload {
            JobEventOrConnection::Connection(inner) => self.app.emit(event, inner),
            JobEventOrConnection::Job(inner) => self.app.emit(event, inner),
        };
        if result.is_err() {
            tracing::warn!(event, "bridge event could not reach the webview");
        }
    }
}

// ─── Shared state ──────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct BridgeShared {
    pub running: bool,
    pub bound_address: String,
    pub port: u16,
    pub token: String,
    pub connected: bool,
    pub extension_version: Option<String>,
    pub registry: BridgeRegistry,
    pub sequence: u64,
}

impl Default for BridgeShared {
    fn default() -> Self {
        Self {
            running: false,
            bound_address: BRIDGE_BIND_ADDRESS.to_owned(),
            port: DEFAULT_BRIDGE_PORT,
            token: String::new(),
            connected: false,
            extension_version: None,
            registry: BridgeRegistry::new(),
            sequence: 0,
        }
    }
}

enum BridgeCommand {
    Dispatch(BridgeDispatchRequest),
    Shutdown,
}

pub struct BridgeRuntime {
    shared: Arc<Mutex<BridgeShared>>,
    command_tx: Mutex<Option<Sender<BridgeCommand>>>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl Default for BridgeRuntime {
    fn default() -> Self {
        Self {
            shared: Arc::new(Mutex::new(BridgeShared::default())),
            command_tx: Mutex::new(None),
            worker: Mutex::new(None),
        }
    }
}

impl BridgeRuntime {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn shared(&self) -> &Arc<Mutex<BridgeShared>> {
        &self.shared
    }
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeServerInfo {
    pub running: bool,
    pub bound_address: String,
    pub port: u16,
    pub token: Option<String>,
    pub active_connections: usize,
    pub pending_job_count: usize,
    pub jobs: Vec<BridgeJobRecord>,
}

fn snapshot_info(shared: &BridgeShared, include_token: bool) -> BridgeServerInfo {
    BridgeServerInfo {
        running: shared.running,
        bound_address: shared.bound_address.clone(),
        port: shared.port,
        token: if include_token && shared.running {
            Some(shared.token.clone())
        } else {
            None
        },
        active_connections: usize::from(shared.connected),
        pending_job_count: shared.registry.pending_count(),
        jobs: shared.registry.snapshot(),
    }
}

fn next_sequence(shared: &mut BridgeShared) -> (u64, f64) {
    shared.sequence += 1;
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as f64)
        .unwrap_or_default();
    (shared.sequence, millis)
}

fn connection_event(
    shared: &mut BridgeShared,
    connected: bool,
    reason: &str,
) -> ConnectionChangedEvent {
    let (sequence_id, timestamp) = next_sequence(shared);
    ConnectionChangedEvent {
        sequence_id,
        timestamp,
        connected,
        extension_version: shared.extension_version.clone(),
        bound_port: shared.port,
        reason: reason.to_owned(),
    }
}

fn job_event(shared: &mut BridgeShared, job_id: &str, note: Option<String>) -> Option<JobEvent> {
    let record = shared.registry.record(job_id)?.clone();
    let (sequence_id, timestamp) = next_sequence(shared);
    Some(JobEvent {
        sequence_id,
        timestamp,
        job_id: record.job_id,
        state: record.state,
        phase: record.phase.clone(),
        note,
        error: record.error.clone(),
        files: record.files,
        assets: record.assets,
    })
}

fn bridge_error(code: &str, message: &str, retryable: bool) -> IpcError {
    IpcError {
        code: code.to_owned(),
        message: message.to_owned(),
        domain: ErrorDomain::Bridge,
        details: BTreeMap::new(),
        timestamp: Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|value| value.as_millis() as f64)
                .unwrap_or_default(),
        ),
        retryable,
    }
}

// ─── Server thread ─────────────────────────────────────────────────────────

struct ClientConnection {
    socket: WebSocket<TcpStream>,
    authenticated: bool,
    hello_deadline: Instant,
}

impl ClientConnection {
    fn new(stream: TcpStream) -> Self {
        let _ = stream.set_nodelay(true);
        let _ = stream.set_read_timeout(Some(READ_TICK));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
        let socket = match tungstenite::accept(stream) {
            Ok(socket) => socket,
            Err(error) => {
                tracing::warn!(%error, "bridge websocket handshake failed");
                return Self {
                    socket: unreachable_probe(),
                    authenticated: false,
                    hello_deadline: Instant::now(),
                };
            }
        };
        Self {
            socket,
            authenticated: false,
            hello_deadline: Instant::now() + HANDSHAKE_TIMEOUT,
        }
    }
}

fn unreachable_probe() -> WebSocket<TcpStream> {
    let listener = TcpListener::bind("127.0.0.1:0").expect("probe bind");
    let addr = listener.local_addr().expect("probe addr");
    let client = TcpStream::connect(addr).expect("probe connect");
    let (server, _) = listener.accept().expect("probe accept");
    drop(client);
    tungstenite::accept(server).unwrap_or_else(|_| {
        let (fallback_server, _) = TcpListener::bind("127.0.0.1:0")
            .and_then(|l| {
                let a = l.local_addr()?;
                let _c = TcpStream::connect(a)?;
                l.accept()
            })
            .expect("fallback probe");
        tungstenite::accept(fallback_server).expect("fallback accept")
    })
}

fn serve(
    listener: TcpListener,
    command_rx: Receiver<BridgeCommand>,
    shared: Arc<Mutex<BridgeShared>>,
    sink: Arc<dyn EventSink>,
) {
    let _ = listener.set_nonblocking(true);
    let mut client: Option<ClientConnection> = None;

    loop {
        let mut stop = false;
        loop {
            match command_rx.try_recv() {
                Ok(BridgeCommand::Shutdown) => {
                    stop = true;
                    break;
                }
                Ok(BridgeCommand::Dispatch(request)) => {
                    if let Some(connection) = client.as_mut().filter(|c| c.authenticated) {
                        let frame = ServerFrame::Dispatch(request);
                        match serde_json::to_string(&frame) {
                            Ok(text) => {
                                if write_frame(connection, &text).is_err() {
                                    drop(client.take());
                                    mark_disconnected(&shared, &sink);
                                }
                            }
                            Err(error) => {
                                tracing::error!(%error, "bridge dispatch frame failed to serialize")
                            }
                        }
                    }
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    stop = true;
                    break;
                }
            }
        }
        if stop {
            break;
        }

        if let Ok((stream, _addr)) = listener.accept() {
            // Single-client rule: a newer connection replaces the old one.
            if client.take().is_some() {
                let mut guard = shared.lock().expect("bridge state poisoned");
                let event = connection_event(&mut guard, false, "client_replaced");
                guard.connected = false;
                guard.extension_version = None;
                drop(guard);
                sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
            }
            client = Some(ClientConnection::new(stream));
        }

        let mut client_failed = false;
        if let Some(connection) = client.as_mut() {
            loop {
                match connection.socket.read() {
                    Ok(Message::Text(text)) => {
                        match handle_incoming(&text, connection, &shared, &sink) {
                            IncomingAction::Close => {
                                client_failed = true;
                                break;
                            }
                            IncomingAction::Keep => {}
                        }
                    }
                    Ok(Message::Binary(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        match handle_incoming(&text, connection, &shared, &sink) {
                            IncomingAction::Close => {
                                client_failed = true;
                                break;
                            }
                            IncomingAction::Keep => {}
                        }
                    }
                    Ok(Message::Close(_))
                    | Err(WsError::ConnectionClosed)
                    | Err(WsError::AlreadyClosed) => {
                        client_failed = true;
                        break;
                    }
                    Ok(_) => {}
                    Err(WsError::Io(ref error))
                        if matches!(error.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) =>
                    {
                        break;
                    }
                    Err(error) => {
                        tracing::debug!(%error, "bridge read error");
                        client_failed = true;
                        break;
                    }
                }
            }

            if !client_failed
                && !connection.authenticated
                && Instant::now() > connection.hello_deadline
            {
                let guard = shared.lock().expect("bridge state poisoned");
                drop(guard);
                let mut guard = shared.lock().expect("bridge state poisoned");
                let event = connection_event(&mut guard, false, "auth_rejected");
                drop(guard);
                sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
                client_failed = true;
            }
        }

        if client_failed {
            drop(client.take());
            mark_disconnected(&shared, &sink);
        }

        std::thread::sleep(Duration::from_millis(40));
    }

    drop(client);
    mark_disconnected(&shared, &sink);
}

enum IncomingAction {
    Keep,
    Close,
}

fn handle_incoming(
    raw: &str,
    connection: &mut ClientConnection,
    shared: &Arc<Mutex<BridgeShared>>,
    sink: &Arc<dyn EventSink>,
) -> IncomingAction {
    let frame: ClientFrame = match serde_json::from_str(raw) {
        Ok(frame) => frame,
        Err(error) => {
            tracing::warn!(%error, "bridge sent malformed frame");
            return IncomingAction::Close;
        }
    };

    if !connection.authenticated {
        let ClientFrame::Hello {
            token,
            version,
            role,
            ..
        } = frame
        else {
            tracing::warn!("bridge sent {frame:?} before hello");
            return IncomingAction::Close;
        };
        let expected = {
            let guard = shared.lock().expect("bridge state poisoned");
            guard.token.clone()
        };
        if !token_matches(&expected, &token) {
            let mut guard = shared.lock().expect("bridge state poisoned");
            let event = connection_event(&mut guard, false, "auth_rejected");
            drop(guard);
            sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
            return IncomingAction::Close;
        }

        connection.authenticated = true;
        {
            let mut guard = shared.lock().expect("bridge state poisoned");
            guard.connected = true;
            guard.extension_version = Some(version.clone());
            let event = connection_event(&mut guard, true, "client_ready");
            drop(guard);
            sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
        }
        let _ = write_frame(connection, r#"{"type":"ready"}"#);
        tracing::info!(role, %version, "ZFlow Batcher connected");
        return IncomingAction::Keep;
    }

    match frame {
        ClientFrame::Hello { .. } => IncomingAction::Keep,
        ClientFrame::Progress {
            job_id,
            phase,
            note,
        } => {
            let mut guard = shared.lock().expect("bridge state poisoned");
            guard.registry.apply_progress(&job_id, &phase, note.clone());
            if let Some(event) = job_event(&mut guard, &job_id, note) {
                drop(guard);
                sink.emit(EVENT_JOB, &JobEventOrConnection::Job(event));
            }
            IncomingAction::Keep
        }
        ClientFrame::Result {
            job_id,
            ok,
            error,
            files,
            assets,
        } => {
            let mut guard = shared.lock().expect("bridge state poisoned");
            guard
                .registry
                .apply_result(&job_id, ok, error, files, assets);
            if let Some(event) = job_event(&mut guard, &job_id, None) {
                drop(guard);
                sink.emit(EVENT_JOB, &JobEventOrConnection::Job(event));
            }
            IncomingAction::Keep
        }
    }
}

#[allow(clippy::result_large_err)]
fn write_frame(connection: &mut ClientConnection, text: &str) -> Result<(), WsError> {
    connection.socket.send(Message::Text(text.to_owned()))?;
    connection.socket.flush()?;
    Ok(())
}

fn mark_disconnected(shared: &Arc<Mutex<BridgeShared>>, sink: &Arc<dyn EventSink>) {
    let mut guard = shared.lock().expect("bridge state poisoned");
    if !guard.connected {
        return;
    }
    guard.connected = false;
    guard.extension_version = None;
    let lost = guard.registry.finalize_unfinished_as_lost();
    let event = connection_event(&mut guard, false, "client_disconnected");
    drop(guard);
    sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
    for job_id in lost {
        let mut guard = shared.lock().expect("bridge state poisoned");
        if let Some(job) = job_event(&mut guard, &job_id, None) {
            drop(guard);
            sink.emit(EVENT_JOB, &JobEventOrConnection::Job(job));
        }
    }
}

fn generate_token_bytes() -> [u8; 16] {
    let mut seed = [0u8; 16];
    let mut attempts = 0;
    while fill(&mut seed).is_err() && attempts < 8 {
        attempts += 1;
    }
    seed
}

fn stop_inner(runtime: &BridgeRuntime, sink: &Arc<dyn EventSink>) {
    let worker = runtime.worker.lock().expect("bridge state poisoned").take();
    if let Some(sender) = runtime
        .command_tx
        .lock()
        .expect("bridge state poisoned")
        .take()
    {
        let _ = sender.send(BridgeCommand::Shutdown);
    }
    if let Some(handle) = worker {
        let _ = handle.join();
    }
    let mut guard = runtime.shared.lock().expect("bridge state poisoned");
    let was_running = guard.running;
    guard.running = false;
    guard.token = String::new();
    guard.connected = false;
    let lost = guard.registry.finalize_unfinished_as_lost();
    drop(guard);
    if was_running {
        let mut guard = runtime.shared.lock().expect("bridge state poisoned");
        let event = connection_event(&mut guard, false, "server_stopped");
        drop(guard);
        sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
    }
    for job_id in lost {
        let mut guard = runtime.shared.lock().expect("bridge state poisoned");
        if let Some(job) = job_event(&mut guard, &job_id, None) {
            drop(guard);
            sink.emit(EVENT_JOB, &JobEventOrConnection::Job(job));
        }
    }
}

// ─── IPC commands ──────────────────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub fn bridge_start(
    app: AppHandle,
    runtime: State<'_, BridgeRuntime>,
    port: Option<u16>,
) -> Result<BridgeServerInfo, IpcError> {
    let requested = port.unwrap_or(DEFAULT_BRIDGE_PORT);
    start_server(&runtime, Arc::new(TauriEventSink::new(app)), requested)
}

pub fn start_server(
    runtime: &BridgeRuntime,
    sink: Arc<dyn EventSink>,
    requested_port: u16,
) -> Result<BridgeServerInfo, IpcError> {
    let listener = TcpListener::bind((BRIDGE_BIND_ADDRESS, requested_port)).map_err(|error| {
        bridge_error(
            "E_BRIDGE_PORT_IN_USE",
            &format!("cannot bind {BRIDGE_BIND_ADDRESS}:{requested_port}: {error}"),
            true,
        )
    })?;
    let bound_addr = listener
        .local_addr()
        .map_err(|error| bridge_error("E_BRIDGE_PORT_IN_USE", &error.to_string(), false))?;

    stop_inner(runtime, &sink);

    let token = flow_core::bridge::generate_token(&generate_token_bytes());
    {
        let mut guard = runtime.shared.lock().expect("bridge state poisoned");
        guard.running = true;
        guard.bound_address = bound_addr.ip().to_string();
        guard.port = bound_addr.port();
        guard.token = token.clone();
        guard.connected = false;
        guard.extension_version = None;
    }

    let shared_worker = Arc::clone(&runtime.shared);
    let sink_worker = Arc::clone(&sink);
    let (command_tx, command_rx) = mpsc::channel();
    let worker =
        std::thread::spawn(move || serve(listener, command_rx, shared_worker, sink_worker));

    {
        let mut command_slot = runtime.command_tx.lock().expect("bridge state poisoned");
        *command_slot = Some(command_tx);
        *runtime.worker.lock().expect("bridge state poisoned") = Some(worker);
    }

    let mut guard = runtime.shared.lock().expect("bridge state poisoned");
    let event = connection_event(&mut guard, false, "server_started");
    let info = snapshot_info(&guard, true);
    drop(guard);
    sink.emit(EVENT_CONNECTION, &JobEventOrConnection::Connection(event));
    Ok(info)
}

#[allow(dead_code)]
fn runtime_shared_clone(shared: &Arc<Mutex<BridgeShared>>) -> Arc<Mutex<BridgeShared>> {
    Arc::clone(shared)
}

#[tauri::command]
#[specta::specta]
pub fn bridge_stop(
    app: AppHandle,
    runtime: State<'_, BridgeRuntime>,
) -> Result<BridgeServerInfo, IpcError> {
    let sink: Arc<dyn EventSink> = Arc::new(TauriEventSink::new(app));
    stop_inner(runtime.inner(), &sink);
    let guard = runtime.shared.lock().expect("bridge state poisoned");
    Ok(snapshot_info(&guard, false))
}

#[tauri::command]
#[specta::specta]
pub fn bridge_dispatch(
    request: BridgeDispatchRequest,
    runtime: State<'_, BridgeRuntime>,
) -> Result<BridgeServerInfo, IpcError> {
    let sender_guard = runtime.command_tx.lock().expect("bridge state poisoned");
    let mut guard = runtime.shared.lock().expect("bridge state poisoned");

    if !guard.running {
        return Err(bridge_error(
            "E_BRIDGE_NOT_RUNNING",
            "start the browser bridge first",
            true,
        ));
    }
    if !guard.connected {
        return Err(bridge_error(
            "E_BRIDGE_NO_CLIENT",
            "no authenticated ZFlow Batcher connection is active",
            true,
        ));
    }

    guard
        .registry
        .register(request.clone())
        .map_err(|conflict| {
            bridge_error(
                "E_BRIDGE_JOB_CONFLICT",
                &format!("job '{}' is already tracked", conflict.job_id()),
                false,
            )
        })?;
    let dispatched = match &*sender_guard {
        Some(sender) => sender
            .send(BridgeCommand::Dispatch(request.clone()))
            .map_err(|_| {
                bridge_error(
                    "E_BRIDGE_DISPATCH_FAILED",
                    "bridge worker channel is closed",
                    true,
                )
            }),
        None => Err(bridge_error(
            "E_BRIDGE_NOT_RUNNING",
            "bridge listener is gone",
            true,
        )),
    };
    if dispatched.is_err() {
        guard.registry.apply_result(
            &request.job_id,
            false,
            Some("dispatch channel failed".to_owned()),
            vec![],
            vec![],
        );
    }
    let info = snapshot_info(&guard, false);
    drop(guard);
    dispatched?;
    Ok(info)
}

#[tauri::command]
#[specta::specta]
pub fn bridge_status(runtime: State<'_, BridgeRuntime>) -> Result<BridgeServerInfo, IpcError> {
    let guard = runtime.shared.lock().expect("bridge state poisoned");
    Ok(snapshot_info(&guard, true))
}

pub fn manage(app: &AppHandle) {
    app.manage(BridgeRuntime::new());
}

#[allow(dead_code)]
fn unused_kind_reference(_kind: BridgeJobKind) -> Option<BridgeJobState> {
    Some(BridgeJobState::Awaiting)
}
