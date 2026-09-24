use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplicationPaths {
    root: PathBuf,
}

impl ApplicationPaths {
    pub fn from_root(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn database_path(&self) -> PathBuf {
        self.root.join("flow_studio.db")
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.root.join("assets")
    }

    pub fn cache_dir(&self) -> PathBuf {
        self.root.join("cache")
    }

    pub fn exports_dir(&self) -> PathBuf {
        self.root.join("exports")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn backups_dir(&self) -> PathBuf {
        self.root.join("backups")
    }

    pub fn ensure_directories(&self) -> io::Result<()> {
        for directory in self.required_directories() {
            fs::create_dir_all(directory)?;
        }

        Ok(())
    }

    fn required_directories(&self) -> [PathBuf; 5] {
        [
            self.assets_dir(),
            self.cache_dir(),
            self.exports_dir(),
            self.logs_dir(),
            self.backups_dir(),
        ]
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}
