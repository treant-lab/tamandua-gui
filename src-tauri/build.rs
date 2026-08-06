fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        cc::Build::new()
            .file("src/macos/system_extension_bridge.m")
            .flag("-fobjc-arc")
            .compile("tamandua_system_extension_lifecycle");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=SystemExtensions");
        println!("cargo:rerun-if-changed=src/macos/system_extension_bridge.m");
    }
    tauri_build::build()
}
