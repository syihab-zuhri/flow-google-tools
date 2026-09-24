fn main() {
    if let Err(error) = flow_studio_lib::export_bindings() {
        eprintln!("Flow Studio binding export failed: {error}");
        std::process::exit(1);
    }
}
