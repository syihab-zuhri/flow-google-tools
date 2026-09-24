use serde::Serialize;
use specta::Type;
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorDomain {
    Storage,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
    pub domain: ErrorDomain,
    pub details: BTreeMap<String, String>,
    pub timestamp: Option<f64>,
    pub retryable: bool,
}

impl IpcError {
    pub fn workspace_initialization_failed() -> Self {
        Self {
            code: "E_STORAGE_WORKSPACE_INITIALIZATION_FAILED".to_owned(),
            message: "The local workspace could not be initialized.".to_owned(),
            domain: ErrorDomain::Storage,
            details: BTreeMap::new(),
            timestamp: unix_timestamp_millis(),
            retryable: true,
        }
    }
}

impl Display for IpcError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl Error for IpcError {}

fn unix_timestamp_millis() -> Option<f64> {
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as f64)
}
