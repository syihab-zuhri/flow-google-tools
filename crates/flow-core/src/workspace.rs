use crate::app_paths::ApplicationPaths;
use crate::database::{DatabaseError, LocalDatabase};
use serde::Serialize;
use specta::Type;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ProviderMode {
    ManualHandoff,
    OfficialApi,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    pub database_path: PathBuf,
    pub migration_count: i64,
    pub provider_mode: ProviderMode,
}

pub fn initialize_workspace(root: PathBuf) -> Result<WorkspaceStatus, DatabaseError> {
    let paths = ApplicationPaths::from_root(root);
    let database = LocalDatabase::open(&paths)?;

    Ok(WorkspaceStatus {
        database_path: paths.database_path(),
        migration_count: database.applied_migration_count()?,
        provider_mode: ProviderMode::ManualHandoff,
    })
}
