#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(feature = "visual-fixture", feature = "production"))]
compile_error!("visual-fixture and production features are mutually exclusive");

#[cfg(not(feature = "visual-fixture"))]
compile_error!("this crate may only be compiled with the visual-fixture feature");

use std::process::ExitCode;
use tauri::{Manager, WindowBuilder, WindowUrl};

const ALLOWED_SCENARIOS: [&str; 2] = ["dashboard-offline", "dashboard-error"];

fn selected_scenario() -> Result<String, &'static str> {
    let mut arguments = std::env::args().skip(1);
    let mut selected: Option<String> = None;

    while let Some(argument) = arguments.next() {
        if argument != "--visual-scenario" {
            return Err("fixture_denied: only --visual-scenario is accepted");
        }
        if selected.is_some() {
            return Err("fixture_denied: visual scenario may be selected only once");
        }
        let value = arguments
            .next()
            .ok_or("fixture_denied: --visual-scenario requires an allowlisted value")?;
        if !ALLOWED_SCENARIOS.contains(&value.as_str()) {
            return Err("fixture_denied: unknown visual scenario");
        }
        selected = Some(value);
    }

    Ok(selected.unwrap_or_else(|| ALLOWED_SCENARIOS[0].to_owned()))
}

fn run_fixture(scenario: String) -> tauri::Result<()> {
    let fixture_url = WindowUrl::App(format!("index.html?scenario={scenario}").into());

    tauri::Builder::default()
        .setup(move |app| {
            WindowBuilder::new(app, "visual-fixture", fixture_url)
                .title("Tamandua · VISUAL FIXTURE · NO ENDPOINT ACTIONS")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .decorations(true)
                .build()?;

            debug_assert_eq!(app.windows().len(), 1);
            Ok(())
        })
        .run(tauri::generate_context!())
}

fn main() -> ExitCode {
    let scenario = match selected_scenario() {
        Ok(value) => value,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::from(64);
        }
    };

    match run_fixture(scenario) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("fixture_denied: visual host failed: {error}");
            ExitCode::FAILURE
        }
    }
}
