use crate::app_paths::ApplicationPaths;
use rusqlite::{Connection, OptionalExtension, TransactionBehavior};
use sha2::{Digest, Sha256};
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::io;

const MIGRATION_TABLE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS _schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL CHECK (version > 0),
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
) STRICT;
"#;

const MIGRATIONS: [MigrationDefinition; 1] = [MigrationDefinition {
    version: 1,
    name: "initial_local_schema",
    sql: include_str!("../migrations/V001__initial_local_schema.sql"),
}];

#[derive(Debug, Clone, Copy)]
struct MigrationDefinition {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

#[derive(Debug)]
pub enum DatabaseError {
    Directory(io::Error),
    IntegrityCheckFailed(String),
    MigrationChecksumMismatch { version: i64 },
    Sql(rusqlite::Error),
}

impl Display for DatabaseError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Directory(error) => {
                write!(formatter, "cannot create application directory: {error}")
            }
            Self::IntegrityCheckFailed(status) => {
                write!(formatter, "database integrity check failed: {status}")
            }
            Self::MigrationChecksumMismatch { version } => {
                write!(
                    formatter,
                    "migration checksum mismatch for version {version}"
                )
            }
            Self::Sql(error) => write!(formatter, "sqlite operation failed: {error}"),
        }
    }
}

impl Error for DatabaseError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Directory(error) => Some(error),
            Self::Sql(error) => Some(error),
            Self::IntegrityCheckFailed(_) | Self::MigrationChecksumMismatch { .. } => None,
        }
    }
}

impl From<rusqlite::Error> for DatabaseError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sql(error)
    }
}

pub struct LocalDatabase {
    connection: Connection,
}

impl LocalDatabase {
    pub fn open(paths: &ApplicationPaths) -> Result<Self, DatabaseError> {
        paths
            .ensure_directories()
            .map_err(DatabaseError::Directory)?;

        let mut connection = Connection::open(paths.database_path())?;
        configure_connection(&connection)?;
        apply_migrations(&mut connection)?;
        verify_integrity(&connection)?;

        Ok(Self { connection })
    }

    pub fn schema_version(&self) -> Result<i64, DatabaseError> {
        self.connection
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM _schema_migrations",
                [],
                |row| row.get(0),
            )
            .map_err(DatabaseError::from)
    }

    pub fn applied_migration_count(&self) -> Result<i64, DatabaseError> {
        self.connection
            .query_row("SELECT COUNT(*) FROM _schema_migrations", [], |row| {
                row.get(0)
            })
            .map_err(DatabaseError::from)
    }
}

fn configure_connection(connection: &Connection) -> Result<(), DatabaseError> {
    connection.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA trusted_schema = OFF;
        ",
    )?;

    Ok(())
}

fn apply_migrations(connection: &mut Connection) -> Result<(), DatabaseError> {
    connection.execute_batch(MIGRATION_TABLE_SQL)?;

    for migration in MIGRATIONS {
        let checksum = migration_checksum(migration.sql);
        let applied_checksum: Option<String> = connection
            .query_row(
                "SELECT checksum FROM _schema_migrations WHERE version = ?1",
                [migration.version],
                |row| row.get(0),
            )
            .optional()?;

        match applied_checksum {
            Some(existing_checksum) if existing_checksum != checksum => {
                return Err(DatabaseError::MigrationChecksumMismatch {
                    version: migration.version,
                });
            }
            Some(_) => continue,
            None => apply_migration(connection, migration, &checksum)?,
        }
    }

    Ok(())
}

fn apply_migration(
    connection: &mut Connection,
    migration: MigrationDefinition,
    checksum: &str,
) -> Result<(), DatabaseError> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    transaction.execute_batch(migration.sql)?;
    transaction.execute(
        "
        INSERT INTO _schema_migrations (version, name, checksum, applied_at)
        VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ",
        (migration.version, migration.name, checksum),
    )?;
    transaction.commit()?;

    Ok(())
}

fn verify_integrity(connection: &Connection) -> Result<(), DatabaseError> {
    let integrity_status: String =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;

    if integrity_status != "ok" {
        return Err(DatabaseError::IntegrityCheckFailed(integrity_status));
    }

    let mut statement = connection.prepare("PRAGMA foreign_key_check")?;
    let mut rows = statement.query([])?;

    if rows.next()?.is_some() {
        return Err(DatabaseError::IntegrityCheckFailed(
            "foreign key check reported a violation".to_owned(),
        ));
    }

    Ok(())
}

fn migration_checksum(sql: &str) -> String {
    format!("{:x}", Sha256::digest(sql.as_bytes()))
}
