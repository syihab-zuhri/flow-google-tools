#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = flow_studio_lib::run() {
        eprintln!("Flow Studio could not start: {error}");
        std::process::exit(1);
    }
}
