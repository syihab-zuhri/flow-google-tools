pub mod bridge;
mod continuity;
pub mod error;
mod export;
pub mod logging;
mod project;
mod vault;
mod workspace;

use specta_typescript::Typescript;
use std::io;
use std::path::PathBuf;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

const TYPED_ERROR_IMPL: &str = r#"async function typedError<T, E>(result: Promise<T>): Promise<{ status: "ok"; data: T } | { status: "error"; error: E }> {
    try {
        return { status: "ok", data: await result };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        return { status: "error", error: error as unknown as E };
    }
}"#;

fn command_builder() -> Builder<tauri::Wry> {
    let semantic_types = specta_typescript::semantic::Configuration::default()
        .define::<serde_json::Value>(|_| specta_typescript::define("any").into(), None, None);

    Builder::new()
        .typed_error_impl(TYPED_ERROR_IMPL)
        .dangerously_cast_bigints_to_number()
        .semantic_types(semantic_types)
        .commands(collect_commands![
            workspace::workspace_status,
            project::save_project,
            project::load_project,
            continuity::extract_frame,
            continuity::get_prompt_context,
            continuity::set_style_lock,
            export::concat_segments,
            export::preview_export,
            export::export_video,
            export::export_segment,
            vault::setup_vault,
            vault::unlock_vault,
            vault::lock_vault,
            vault::check_vault_status,
            vault::reset_vault,
            bridge::bridge_start,
            bridge::bridge_stop,
            bridge::bridge_dispatch,
            bridge::bridge_status,
        ])
}

pub fn export_bindings() -> io::Result<()> {
    command_builder()
        .export(Typescript::default(), bindings_path())
        .map_err(|error| io::Error::other(error.to_string()))
}

fn bindings_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    #[cfg(debug_assertions)]
    export_bindings()?;

    let command_builder = command_builder();

    tauri::Builder::default()
        .setup(move |app| {
            let data_directory = app.path().data_dir()?;
            let root = workspace::workspace_root(data_directory);
            let logging_guard = logging::initialize_logging(root.join("logs"))?;
            app.manage(logging_guard);
            workspace::initialize_for_root(root)?;
            bridge::manage(app.handle());
            tracing::info!(event = "application_started", "Flow Studio started");
            Ok(())
        })
        .invoke_handler(command_builder.invoke_handler())
        .run(tauri::generate_context!())
}
