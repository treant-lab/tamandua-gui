#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod commands;
mod ipc;
mod state;
mod tray;

use state::AppState;
use tauri::Manager;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tamandua_gui=debug,info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Tamandua EDR GUI v{}", env!("CARGO_PKG_VERSION"));

    // Build system tray
    let tray = tray::build_system_tray();

    // Create app state
    let app_state = AppState::new();

    tauri::Builder::default()
        .system_tray(tray)
        .on_system_tray_event(tray::handle_tray_event)
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Agent status commands
            commands::get_status,
            commands::get_metrics,
            commands::get_system_metrics,
            commands::get_component_status,
            commands::is_connected,
            commands::is_agent_authenticated,
            commands::get_gui_capabilities,
            commands::get_linux_capabilities,
            commands::get_platform_capabilities,
            commands::get_privilege_status,
            commands::relaunch_as_administrator,
            commands::get_agent_setup_status,
            commands::install_agent_service,
            commands::repair_agent_service,
            commands::get_update_center_status,
            // Performance profile commands
            commands::get_performance_profile,
            commands::set_performance_profile,
            commands::get_performance_profiles_info,
            // Alert commands
            commands::get_alerts,
            commands::get_alert_count,
            commands::get_incident,
            commands::acknowledge_alert,
            // Scan commands
            commands::start_scan,
            // Configuration commands
            commands::update_config,
            // Response action commands
            commands::kill_process,
            commands::block_ip,
            commands::unblock_ip,
            commands::block_domain,
            commands::unblock_domain,
            commands::list_blocked_ips,
            commands::list_blocked_domains,
            commands::isolate_network,
            commands::restore_network,
            commands::get_response_actions,
            commands::get_response_action_stats,
            commands::undo_response_action,
            commands::get_quarantined_files,
            // Log commands
            commands::get_logs,
            commands::get_log_modules,
            commands::export_logs,
            commands::get_network_connections,
            commands::list_directory,
            commands::get_threat_intel_feed,
            commands::get_ioc_stats,
            // Backend connection commands
            commands::test_backend_connection,
            commands::test_connection,
            commands::reload_rules,
            // Authentication commands
            commands::get_auth_status,
            commands::setup_password,
            commands::verify_password,
            commands::change_password,
            commands::check_password_strength,
            commands::check_biometric_available,
            commands::authenticate_biometric,
            commands::get_session_status,
            commands::validate_session,
            commands::require_auth,
            commands::logout,
            commands::emergency_recovery,
            commands::get_auth_audit_log,
            commands::get_auth_config,
            commands::update_auth_config,
            // Update commands
            commands::check_for_updates,
            commands::download_update,
            commands::install_update,
            commands::get_current_version,
            commands::restart_app,
            // Event commands
            commands::get_events,
            commands::get_event,
            commands::get_related_events,
            commands::get_event_statistics,
            commands::get_event_count,
            commands::export_events,
            commands::get_filter_presets,
            commands::save_filter_preset,
            commands::delete_filter_preset,
            commands::create_detection_rule_from_event,
            // WSL status commands (Windows only)
            commands::get_wsl_status,
            // Process commands
            commands::get_processes,
            commands::get_process_details,
            // Configuration commands
            commands::get_config,
            // Schedule commands
            commands::get_schedules,
            commands::get_schedule,
            commands::create_schedule,
            commands::update_schedule,
            commands::delete_schedule,
            commands::set_schedule_enabled,
            commands::run_schedule_now,
            commands::get_schedule_history,
            commands::get_schedule_running_status,
            commands::cancel_scheduled_scan,
            commands::get_scheduled_exports,
            // Driver control commands
            commands::get_driver_status,
            commands::load_driver,
            commands::unload_driver,
            // Agent control commands
            commands::start_agent,
            commands::stop_agent,
            commands::restart_agent,
        ])
        .setup(|app| {
            let handle = app.handle();
            let state = handle.state::<AppState>();
            let state_clone = state.inner().clone();

            // Start IPC client in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = state_clone.start_ipc_client().await {
                    error!("Failed to start IPC client: {}", e);
                }
            });

            info!("Tamandua GUI initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
