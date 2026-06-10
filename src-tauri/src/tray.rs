use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, SystemTraySubmenu,
};
use tracing::{debug, info};

/// Build the system tray with comprehensive options
pub fn build_system_tray() -> SystemTray {
    // Window management
    let open_dashboard = CustomMenuItem::new("open_dashboard".to_string(), "Open Dashboard");
    let open_alerts = CustomMenuItem::new("open_alerts".to_string(), "Open Alerts");
    let open_settings = CustomMenuItem::new("open_settings".to_string(), "Settings");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide to Tray");

    // Status submenu
    let status_submenu = SystemTraySubmenu::new(
        "Status",
        SystemTrayMenu::new()
            .add_item(
                CustomMenuItem::new("status_protection".to_string(), "Protection: Active")
                    .disabled(),
            )
            .add_item(
                CustomMenuItem::new("status_backend".to_string(), "Backend: Connected").disabled(),
            )
            .add_item(
                CustomMenuItem::new("status_collectors".to_string(), "Collectors: Running")
                    .disabled(),
            )
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new(
                "view_status".to_string(),
                "View Component Status",
            )),
    );

    // Scan options submenu
    let scan_submenu = SystemTraySubmenu::new(
        "Scan",
        SystemTrayMenu::new()
            .add_item(CustomMenuItem::new("quick_scan".to_string(), "Quick Scan"))
            .add_item(CustomMenuItem::new(
                "full_scan".to_string(),
                "Full System Scan",
            ))
            .add_item(CustomMenuItem::new(
                "custom_scan".to_string(),
                "Custom Scan...",
            ))
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new(
                "view_quarantine".to_string(),
                "View Quarantine",
            )),
    );

    // Performance profile submenu
    let profile_submenu = SystemTraySubmenu::new(
        "Performance Profile",
        SystemTrayMenu::new()
            .add_item(CustomMenuItem::new(
                "profile_aggressive".to_string(),
                "Aggressive (Max Protection)",
            ))
            .add_item(CustomMenuItem::new(
                "profile_balanced".to_string(),
                "Balanced (Recommended)",
            ))
            .add_item(CustomMenuItem::new(
                "profile_lightweight".to_string(),
                "Lightweight (Low Impact)",
            )),
    );

    // Response actions submenu
    let response_submenu = SystemTraySubmenu::new(
        "Response Actions",
        SystemTrayMenu::new()
            .add_item(CustomMenuItem::new(
                "isolate_network".to_string(),
                "Isolate Network",
            ))
            .add_item(CustomMenuItem::new(
                "restore_network".to_string(),
                "Restore Network",
            ))
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new(
                "view_processes".to_string(),
                "View Processes",
            )),
    );

    // Quit
    let quit = CustomMenuItem::new("quit".to_string(), "Quit Tamandua");

    let tray_menu = SystemTrayMenu::new()
        // Main actions at top
        .add_item(open_dashboard)
        .add_item(open_alerts)
        .add_native_item(SystemTrayMenuItem::Separator)
        // Status
        .add_submenu(status_submenu)
        .add_native_item(SystemTrayMenuItem::Separator)
        // Scan
        .add_submenu(scan_submenu)
        .add_native_item(SystemTrayMenuItem::Separator)
        // Profile
        .add_submenu(profile_submenu)
        .add_native_item(SystemTrayMenuItem::Separator)
        // Response
        .add_submenu(response_submenu)
        .add_native_item(SystemTrayMenuItem::Separator)
        // Settings and window management
        .add_item(open_settings)
        .add_item(hide)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

/// Handle system tray events
pub fn handle_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            debug!("System tray left click");
            if let Some(window) = app.get_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        SystemTrayEvent::RightClick { .. } => {
            debug!("System tray right click");
        }
        SystemTrayEvent::DoubleClick { .. } => {
            debug!("System tray double click");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            handle_menu_click(app, &id);
        }
        _ => {}
    }
}

fn handle_menu_click(app: &AppHandle, id: &str) {
    match id {
        // Window management
        "open_dashboard" => {
            info!("Opening dashboard from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/dashboard");
            }
        }
        "open_alerts" => {
            info!("Opening alerts from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/alerts");
            }
        }
        "open_settings" => {
            info!("Opening settings from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/settings");
            }
        }
        "hide" => {
            if let Some(window) = app.get_window("main") {
                let _ = window.hide();
            }
        }

        // Status
        "view_status" => {
            info!("Opening component status from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/status");
            }
        }

        // Scan options
        "quick_scan" => {
            info!("Quick scan requested from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "quick_scan"
                    }),
                );
            }
        }
        "full_scan" => {
            info!("Full scan requested from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "full_scan"
                    }),
                );
            }
        }
        "custom_scan" => {
            info!("Custom scan requested from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/scan");
            }
        }
        "view_quarantine" => {
            info!("Opening quarantine from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/quarantine");
            }
        }

        // Performance profiles
        "profile_aggressive" => {
            info!("Setting aggressive profile from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "set_profile",
                        "profile": "aggressive"
                    }),
                );
            }
        }
        "profile_balanced" => {
            info!("Setting balanced profile from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "set_profile",
                        "profile": "balanced"
                    }),
                );
            }
        }
        "profile_lightweight" => {
            info!("Setting lightweight profile from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "set_profile",
                        "profile": "lightweight"
                    }),
                );
            }
        }

        // Response actions
        "isolate_network" => {
            info!("Network isolation requested from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "isolate_network"
                    }),
                );
            }
        }
        "restore_network" => {
            info!("Network restore requested from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.emit(
                    "tray-action",
                    serde_json::json!({
                        "action": "restore_network"
                    }),
                );
            }
        }
        "view_processes" => {
            info!("Opening process viewer from system tray");
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "/processes");
            }
        }

        // Quit
        "quit" => {
            info!("Quit requested from system tray");
            std::process::exit(0);
        }

        _ => {
            debug!("Unknown menu item: {}", id);
        }
    }
}

/// Update tray menu status items dynamically
pub fn update_tray_status(
    app: &AppHandle,
    protection_active: bool,
    backend_connected: bool,
    collectors_running: usize,
) {
    let protection_text = if protection_active {
        "Protection: Active"
    } else {
        "Protection: Disabled"
    };

    let backend_text = if backend_connected {
        "Backend: Connected"
    } else {
        "Backend: Disconnected"
    };

    let collectors_text = format!("Collectors: {} running", collectors_running);

    // Note: Tauri 1.x doesn't support dynamic menu updates easily
    // This would need to rebuild the tray menu or use Tauri 2.x features
    // For now, we emit events that the frontend can use to show notifications
    if let Some(window) = app.get_window("main") {
        let _ = window.emit(
            "tray-status-update",
            serde_json::json!({
                "protection_active": protection_active,
                "backend_connected": backend_connected,
                "collectors_running": collectors_running
            }),
        );
    }
}
