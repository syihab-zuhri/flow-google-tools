use regex::Regex;
use std::fs::{self, File, OpenOptions};
use std::io::{self, ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const LOG_FILE_NAME: &str = "flow-studio.log";
const LOG_FILE_PREFIX: &str = "flow-studio";
const MAX_LOG_FILE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_LOG_ARCHIVES: u8 = 5;

#[derive(Clone)]
pub struct LogSanitizer {
    bearer_pattern: Regex,
    cookie_pattern: Regex,
    json_secret_pattern: Regex,
    email_pattern: Regex,
}

impl LogSanitizer {
    pub fn new() -> Result<Self, regex::Error> {
        Ok(Self {
            bearer_pattern: Regex::new(r#"(?i)(authorization\s*[:=]\s*"?bearer\s+)[^\s";\\]+"#)?,
            cookie_pattern: Regex::new(
                r#"(?i)(\b(?:__secure-[a-z0-9_-]+|sapisid|apisid|hsid|ssid|sid)\s*=\s*)[^;\s"\\]+"#,
            )?,
            json_secret_pattern: Regex::new(
                r#"(?i)("(?:authorization|token|secret|password|cookie|sid|hsid|ssid|sapisid|apisid)[a-z0-9_-]*"\s*:\s*")[^"]*"#,
            )?,
            email_pattern: Regex::new(
                r#"(?i)\b([a-z0-9])[a-z0-9._%+-]*(@[a-z0-9.-]+\.[a-z]{2,})\b"#,
            )?,
        })
    }

    pub fn sanitize(&self, value: &str) -> String {
        let value = self
            .bearer_pattern
            .replace_all(value, "${1}[REDACTED_SECRET]");
        let value = self
            .cookie_pattern
            .replace_all(&value, "${1}[REDACTED_SECRET]");
        let value = self
            .json_secret_pattern
            .replace_all(&value, "${1}[REDACTED_SECRET]");
        self.email_pattern
            .replace_all(&value, "${1}***${2}")
            .into_owned()
    }
}

#[derive(Clone)]
pub struct SizeRollingFileWriter {
    state: Arc<Mutex<RollingFileState>>,
}

struct RollingFileState {
    directory: PathBuf,
    maximum_bytes: u64,
    maximum_archives: u8,
    current_bytes: u64,
    file: File,
}

impl SizeRollingFileWriter {
    pub fn with_rotation_limits(
        directory: PathBuf,
        maximum_bytes: u64,
        maximum_archives: u8,
    ) -> io::Result<Self> {
        if maximum_bytes == 0 {
            return Err(io::Error::new(
                ErrorKind::InvalidInput,
                "maximum log size must be greater than zero",
            ));
        }

        fs::create_dir_all(&directory)?;
        let current_path = current_log_path(&directory);
        let file = open_log_file(&current_path)?;
        let current_bytes = file.metadata()?.len();

        Ok(Self {
            state: Arc::new(Mutex::new(RollingFileState {
                directory,
                maximum_bytes,
                maximum_archives,
                current_bytes,
                file,
            })),
        })
    }
}

impl Write for SizeRollingFileWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| io::Error::other("log writer state is unavailable"))?;

        if state.current_bytes > 0
            && state.current_bytes.saturating_add(bytes.len() as u64) > state.maximum_bytes
        {
            rotate_files(&mut state)?;
        }

        state.file.write_all(bytes)?;
        state.current_bytes = state.current_bytes.saturating_add(bytes.len() as u64);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| io::Error::other("log writer state is unavailable"))?;
        state.file.flush()
    }
}

pub struct SanitizingWriter {
    inner: SizeRollingFileWriter,
    sanitizer: LogSanitizer,
    pending: Vec<u8>,
}

impl SanitizingWriter {
    fn new(inner: SizeRollingFileWriter, sanitizer: LogSanitizer) -> Self {
        Self {
            inner,
            sanitizer,
            pending: Vec::new(),
        }
    }

    fn write_complete_lines(&mut self) -> io::Result<()> {
        while let Some(position) = self.pending.iter().position(|byte| *byte == b'\n') {
            let line: Vec<u8> = self.pending.drain(..=position).collect();
            let value = String::from_utf8_lossy(&line);
            let sanitized = self.sanitizer.sanitize(&value);
            self.inner.write_all(sanitized.as_bytes())?;
        }
        Ok(())
    }

    fn flush_pending(&mut self) -> io::Result<()> {
        if !self.pending.is_empty() {
            let pending = std::mem::take(&mut self.pending);
            let value = String::from_utf8_lossy(&pending);
            let sanitized = self.sanitizer.sanitize(&value);
            self.inner.write_all(sanitized.as_bytes())?;
        }
        self.inner.flush()
    }
}

impl Write for SanitizingWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.pending.extend_from_slice(bytes);
        self.write_complete_lines()?;
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        self.flush_pending()
    }
}

pub struct LoggingGuard {
    _worker_guard: tracing_appender::non_blocking::WorkerGuard,
}

pub fn initialize_logging(log_directory: PathBuf) -> io::Result<LoggingGuard> {
    let writer = SizeRollingFileWriter::with_rotation_limits(
        log_directory,
        MAX_LOG_FILE_BYTES,
        MAX_LOG_ARCHIVES,
    )?;
    let sanitizer = LogSanitizer::new().map_err(io::Error::other)?;
    let sanitizing_writer = SanitizingWriter::new(writer, sanitizer);

    let (non_blocking, worker_guard) = tracing_appender::non_blocking(sanitizing_writer);

    let subscriber = tracing_subscriber::fmt()
        .json()
        .with_ansi(false)
        .with_max_level(tracing::Level::INFO)
        .with_writer(non_blocking)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .map_err(|_| io::Error::other("tracing subscriber is already initialized"))?;

    Ok(LoggingGuard {
        _worker_guard: worker_guard,
    })
}

fn rotate_files(state: &mut RollingFileState) -> io::Result<()> {
    state.file.flush()?;
    let previous_file = std::mem::replace(
        &mut state.file,
        open_log_file(&current_log_path(&state.directory))?,
    );
    drop(previous_file);

    if state.maximum_archives == 0 {
        remove_file_if_exists(&current_log_path(&state.directory))?;
    } else {
        remove_file_if_exists(&archive_log_path(&state.directory, state.maximum_archives))?;

        for index in (1..state.maximum_archives).rev() {
            let source = archive_log_path(&state.directory, index);
            let destination = archive_log_path(&state.directory, index + 1);
            rename_if_exists(&source, &destination)?;
        }

        rename_if_exists(
            &current_log_path(&state.directory),
            &archive_log_path(&state.directory, 1),
        )?;
    }

    state.file = open_log_file(&current_log_path(&state.directory))?;
    state.current_bytes = 0;
    Ok(())
}

fn current_log_path(directory: &Path) -> PathBuf {
    directory.join(LOG_FILE_NAME)
}

fn archive_log_path(directory: &Path, index: u8) -> PathBuf {
    directory.join(format!("{LOG_FILE_PREFIX}.{index}.log"))
}

fn open_log_file(path: &Path) -> io::Result<File> {
    OpenOptions::new().create(true).append(true).open(path)
}

fn remove_file_if_exists(path: &Path) -> io::Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn rename_if_exists(source: &Path, destination: &Path) -> io::Result<()> {
    match fs::rename(source, destination) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::{LogSanitizer, SanitizingWriter, SizeRollingFileWriter};
    use std::fs;
    use std::io::Write;
    use std::path::PathBuf;
    use std::process;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root() -> PathBuf {
        let nanoseconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after the Unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "flow-studio-sanitizing-writer-{}/{}",
            process::id(),
            nanoseconds
        ))
    }

    #[test]
    fn sanitizing_writer_redacts_secret_split_across_writes() {
        let root = unique_test_root();
        let rolling_writer = SizeRollingFileWriter::with_rotation_limits(root.clone(), 1024, 1)
            .expect("rolling writer must initialize");
        let sanitizer = LogSanitizer::new().expect("sanitizer patterns must compile");
        let mut writer = SanitizingWriter::new(rolling_writer, sanitizer);

        writer
            .write_all(b"Authorization: Bearer synthetic-")
            .expect("first chunk must write");
        writer
            .write_all(b"access-token\n")
            .expect("second chunk must write");
        writer.flush().expect("writer must flush");

        let contents = fs::read_to_string(root.join("flow-studio.log"))
            .expect("sanitized log must be readable");
        assert!(!contents.contains("synthetic-access-token"));
        assert!(!contents.contains("access-token"));
        assert!(contents.contains("[REDACTED_SECRET]"));

        fs::remove_dir_all(root).expect("test log directory must be removed");
    }
}
