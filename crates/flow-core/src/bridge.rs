//! Browser Bridge domain core (ADR-009).
//!
//! Flow Studio never talks to Google's private endpoints directly. Instead it
//! hands generation work to the ZFlow Batcher browser extension over a
//! token-authenticated WebSocket bound to the loopback interface. This module
//! holds the protocol types and the job state machine; the transport lives in
//! `src-tauri` so this crate stays framework-free and deterministic.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

/// Default TCP port for the loopback WebSocket bridge.
pub const DEFAULT_BRIDGE_PORT: u16 = 48210;

/// Loopback address the bridge is allowed to bind to. Exposed so the transport
/// layer cannot accidentally widen the surface to a routable interface.
pub const BRIDGE_BIND_ADDRESS: &str = "127.0.0.1";

/// Upper bound on retained job records so a long-running session cannot grow
/// memory without limit.
pub const MAX_RETAINED_JOBS: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum BridgeJobKind {
    Image,
    Video,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum BridgeJobState {
    Awaiting,
    Running,
    Succeeded,
    Failed,
    Cancelled,
    Lost,
}

impl BridgeJobState {
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Succeeded | Self::Failed | Self::Cancelled | Self::Lost
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeDispatchRequest {
    pub job_id: String,
    pub prompt: String,
    pub kind: BridgeJobKind,
    pub model: String,
    pub aspect_ratio: String,
    #[serde(default = "default_variations")]
    pub variations: u32,
    #[serde(default)]
    pub duration: Option<String>,
    #[serde(default = "default_auto_download")]
    pub auto_download: bool,
    #[serde(default)]
    pub download_prefix: Option<String>,
}

pub fn default_variations() -> u32 {
    1
}

fn default_auto_download() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeDispatchResponse {
    pub job_id: String,
    pub state: BridgeJobState,
}

/// Frames sent by the ZFlow Batcher extension.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientFrame {
    #[serde(rename_all = "camelCase")]
    Hello {
        role: String,
        version: String,
        token: String,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        job_id: String,
        phase: String,
        #[serde(default)]
        note: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Result {
        job_id: String,
        ok: bool,
        #[serde(default)]
        error: Option<String>,
        #[serde(default)]
        files: Vec<String>,
        #[serde(default)]
        assets: Vec<String>,
    },
}

/// Frames sent from Flow Studio to the extension.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerFrame {
    Ready,
    #[serde(rename_all = "camelCase")]
    Dispatch(BridgeDispatchRequest),
    #[serde(rename_all = "camelCase")]
    Cancel {
        job_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BridgeJobRecord {
    pub job_id: String,
    pub prompt: String,
    pub kind: BridgeJobKind,
    pub state: BridgeJobState,
    pub phase: Option<String>,
    pub error: Option<String>,
    pub files: Vec<String>,
    pub assets: Vec<String>,
}

/// Rejected when a dispatch reuses a job id that is still tracked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeJobConflict(String);

impl BridgeJobConflict {
    pub fn job_id(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for BridgeJobConflict {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "bridge job '{}' already exists", self.0)
    }
}

impl std::error::Error for BridgeJobConflict {}

/// Ordered job bookkeeping for the bridge. Pure state: the transport layer
/// drives it and republishes snapshots as Tauri events.
#[derive(Debug, Default, Clone)]
pub struct BridgeRegistry {
    records: HashMap<String, BridgeJobRecord>,
    order: Vec<String>,
}

impl BridgeRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, request: BridgeDispatchRequest) -> Result<(), BridgeJobConflict> {
        if self.records.contains_key(&request.job_id) {
            return Err(BridgeJobConflict(request.job_id));
        }

        let record = BridgeJobRecord {
            job_id: request.job_id.clone(),
            prompt: request.prompt,
            kind: request.kind,
            state: BridgeJobState::Awaiting,
            phase: None,
            error: None,
            files: Vec::new(),
            assets: Vec::new(),
        };

        self.order.push(record.job_id.clone());
        self.records.insert(record.job_id.clone(), record);
        self.trim();
        Ok(())
    }

    pub fn state(&self, job_id: &str) -> Option<BridgeJobState> {
        self.records.get(job_id).map(|record| record.state)
    }

    pub fn record(&self, job_id: &str) -> Option<&BridgeJobRecord> {
        self.records.get(job_id)
    }

    /// `accepted` keeps a job awaiting (nothing generated yet); any later phase
    /// proves work has started. Unknown jobs and terminal jobs are ignored.
    pub fn apply_progress(&mut self, job_id: &str, phase: &str, note: Option<String>) -> bool {
        let Some(record) = self.records.get_mut(job_id) else {
            return false;
        };
        if record.state.is_terminal() {
            return false;
        }

        record.phase = Some(phase.to_owned());
        if phase != "accepted" {
            record.state = BridgeJobState::Running;
        }
        if let Some(detail) = note {
            record.error = None;
            record.phase = Some(format!("{phase}: {detail}"));
        }
        true
    }

    pub fn apply_result(
        &mut self,
        job_id: &str,
        ok: bool,
        error: Option<String>,
        files: Vec<String>,
        assets: Vec<String>,
    ) -> bool {
        let Some(record) = self.records.get_mut(job_id) else {
            return false;
        };

        record.state = if ok {
            BridgeJobState::Succeeded
        } else {
            BridgeJobState::Failed
        };
        record.error = if ok {
            None
        } else {
            Some(error.unwrap_or_else(|| "generation failed".to_owned()))
        };
        record.files = files;
        record.assets = assets;
        true
    }

    pub fn cancel(&mut self, job_id: &str) -> bool {
        let Some(record) = self.records.get_mut(job_id) else {
            return false;
        };
        if record.state.is_terminal() {
            return false;
        }
        record.state = BridgeJobState::Cancelled;
        true
    }

    /// Called when the extension disconnects: anything unfinished can never be
    /// trusted again, so it becomes `lost` rather than silently pending.
    pub fn finalize_unfinished_as_lost(&mut self) -> Vec<String> {
        let mut affected = Vec::new();
        for job_id in self.order.clone() {
            let Some(record) = self.records.get_mut(&job_id) else {
                continue;
            };
            if !record.state.is_terminal() {
                record.state = BridgeJobState::Lost;
                record.error = Some("browser bridge disconnected".to_owned());
                affected.push(job_id);
            }
        }
        affected
    }

    pub fn snapshot(&self) -> Vec<BridgeJobRecord> {
        self.order
            .iter()
            .filter_map(|job_id| self.records.get(job_id))
            .cloned()
            .collect()
    }

    pub fn pending_count(&self) -> usize {
        self.records
            .values()
            .filter(|record| !record.state.is_terminal())
            .count()
    }

    fn trim(&mut self) {
        while self.order.len() > MAX_RETAINED_JOBS {
            let oldest = self.order.remove(0);
            self.records.remove(&oldest);
        }
    }
}

/// Hex-encodes 16 cryptographically random bytes supplied by the caller. The
/// core stays entropy-free so tests remain deterministic.
pub fn generate_token(seed: &[u8; 16]) -> String {
    let mut token = String::with_capacity(32);
    for byte in seed {
        token.push_str(&format!("{byte:02x}"));
    }
    token
}

/// Constant-time comparison that refuses empty tokens on either side, so a
/// missing `token` field can never match a missing server token.
pub fn token_matches(expected: &str, presented: &str) -> bool {
    if expected.is_empty() || presented.is_empty() {
        return false;
    }
    if expected.len() != presented.len() {
        return false;
    }

    let expected_bytes = expected.as_bytes();
    let presented_bytes = presented.as_bytes();
    let mut diff = 0u8;
    for index in 0..expected_bytes.len() {
        diff |= expected_bytes[index] ^ presented_bytes[index];
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepted_phase_keeps_job_awaiting() {
        let mut registry = BridgeRegistry::new();
        registry
            .register(BridgeDispatchRequest {
                job_id: "j".to_owned(),
                prompt: "p".to_owned(),
                kind: BridgeJobKind::Image,
                model: "m".to_owned(),
                aspect_ratio: "1:1".to_owned(),
                variations: 1,
                duration: None,
                auto_download: true,
                download_prefix: None,
            })
            .expect("register");

        assert!(registry.apply_progress("j", "accepted", None));
        assert_eq!(registry.state("j"), Some(BridgeJobState::Awaiting));
        assert_eq!(registry.pending_count(), 1);
    }

    #[test]
    fn terminal_jobs_reject_late_progress() {
        let mut registry = BridgeRegistry::new();
        registry
            .register(BridgeDispatchRequest {
                job_id: "j".to_owned(),
                prompt: "p".to_owned(),
                kind: BridgeJobKind::Image,
                model: "m".to_owned(),
                aspect_ratio: "1:1".to_owned(),
                variations: 1,
                duration: None,
                auto_download: true,
                download_prefix: None,
            })
            .expect("register");
        registry.apply_result("j", true, None, Vec::new(), Vec::new());
        assert!(!registry.apply_progress("j", "submitted", None));
        assert!(!registry.cancel("j"));
    }

    #[test]
    fn trim_drops_oldest_records() {
        let mut registry = BridgeRegistry::new();
        for index in 0..(MAX_RETAINED_JOBS + 25) {
            registry
                .register(BridgeDispatchRequest {
                    job_id: format!("job-{index}"),
                    prompt: "p".to_owned(),
                    kind: BridgeJobKind::Image,
                    model: "m".to_owned(),
                    aspect_ratio: "1:1".to_owned(),
                    variations: 1,
                    duration: None,
                    auto_download: true,
                    download_prefix: None,
                })
                .expect("register");
        }
        assert_eq!(registry.snapshot().len(), MAX_RETAINED_JOBS);
        assert_eq!(registry.state("job-0"), None);
        assert_eq!(registry.state("job-24"), None);
        assert_eq!(registry.state("job-25"), Some(BridgeJobState::Awaiting));
    }

    #[test]
    fn token_rejects_length_mismatch_and_empty() {
        assert!(!token_matches("abcdef", "abc"));
        assert!(!token_matches("", ""));
    }
}
