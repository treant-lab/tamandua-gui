//! Schedule types for the GUI
//!
//! These types are serialized/deserialized to/from the frontend.

use chrono::{DateTime, NaiveTime, Utc, Weekday};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A scheduled scan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Scan type (quick, full, custom)
    pub scan_type: String,
    /// Frequency description
    pub frequency: ScheduleFrequency,
    /// Frequency display string
    pub frequency_display: String,
    /// Next scheduled run time
    pub next_run: Option<String>,
    /// Last run time
    pub last_run: Option<String>,
    /// Whether the schedule is enabled
    pub enabled: bool,
    /// Current status
    pub status: String,
    /// Paths to scan (for custom scans)
    pub paths: Vec<String>,
    /// Scan options
    pub options: ScanOptions,
    /// Action on detection
    pub detection_action: DetectionAction,
    /// Created timestamp
    pub created_at: String,
    /// Updated timestamp
    pub updated_at: String,
}

/// Schedule frequency configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ScheduleFrequency {
    /// Run once at a specific time
    Once {
        datetime: String,
    },
    /// Run daily at a specific time
    Daily {
        time: String,
    },
    /// Run on specific days of the week
    Weekly {
        days: Vec<String>,
        time: String,
    },
    /// Run on specific day of the month
    Monthly {
        day: u32,
        time: String,
    },
    /// Custom cron expression
    Cron {
        expression: String,
    },
}

/// Configuration for creating/updating a schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    /// Display name
    pub name: String,
    /// Scan type (quick, full, custom)
    pub scan_type: String,
    /// Frequency configuration
    pub frequency: ScheduleFrequency,
    /// Paths to scan (for custom scans)
    pub paths: Vec<String>,
    /// Scan options
    pub options: ScanOptions,
    /// Action on detection
    pub detection_action: DetectionAction,
}

/// Scan options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanOptions {
    /// Scan inside archive files
    pub scan_archives: bool,
    /// Follow symbolic links
    pub follow_symlinks: bool,
    /// CPU priority (low, normal, high)
    pub cpu_priority: String,
    /// Skip scan if running on battery
    pub skip_if_on_battery: bool,
    /// Wake system from sleep to perform scan
    pub wake_to_scan: bool,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            scan_archives: true,
            follow_symlinks: false,
            cpu_priority: "normal".to_string(),
            skip_if_on_battery: false,
            wake_to_scan: false,
        }
    }
}

/// Action to take when a threat is detected
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DetectionAction {
    /// Only send an alert
    Alert,
    /// Automatically quarantine the file
    Quarantine,
    /// Execute a custom response action
    Custom {
        action_name: String,
        params: serde_json::Value,
    },
}

impl Default for DetectionAction {
    fn default() -> Self {
        Self::Alert
    }
}

/// Schedule run history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleHistory {
    /// Run ID
    pub id: String,
    /// Schedule ID
    pub schedule_id: String,
    /// Started timestamp
    pub started_at: String,
    /// Completed timestamp
    pub completed_at: Option<String>,
    /// Run status (running, completed, failed, cancelled)
    pub status: String,
    /// Number of files scanned
    pub files_scanned: u64,
    /// Number of threats found
    pub threats_found: u32,
    /// Duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Error message if failed
    pub error_message: Option<String>,
}

/// Running status of a schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRunningStatus {
    /// Schedule ID
    pub schedule_id: String,
    /// Started timestamp
    pub started_at: String,
    /// Files scanned so far
    pub files_scanned: u64,
    /// Total files to scan
    pub total_files: u64,
    /// Progress percentage (0-100)
    pub progress_percent: f32,
    /// Threats found so far
    pub threats_found: u32,
    /// Current file being scanned
    pub current_path: String,
}

/// Quick schedule presets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuickSchedulePreset {
    /// Daily quick scan at noon
    DailyQuickScan,
    /// Weekly full scan on Sundays at 3 AM
    WeeklyFullScan,
}

/// Helper to convert weekday string to chrono Weekday
pub fn parse_weekday(s: &str) -> Option<Weekday> {
    match s.to_lowercase().as_str() {
        "mon" | "monday" => Some(Weekday::Mon),
        "tue" | "tuesday" => Some(Weekday::Tue),
        "wed" | "wednesday" => Some(Weekday::Wed),
        "thu" | "thursday" => Some(Weekday::Thu),
        "fri" | "friday" => Some(Weekday::Fri),
        "sat" | "saturday" => Some(Weekday::Sat),
        "sun" | "sunday" => Some(Weekday::Sun),
        _ => None,
    }
}

/// Helper to format weekday to string
pub fn format_weekday(w: Weekday) -> &'static str {
    match w {
        Weekday::Mon => "Monday",
        Weekday::Tue => "Tuesday",
        Weekday::Wed => "Wednesday",
        Weekday::Thu => "Thursday",
        Weekday::Fri => "Friday",
        Weekday::Sat => "Saturday",
        Weekday::Sun => "Sunday",
    }
}

/// Format a schedule frequency to a human-readable string
pub fn format_frequency(freq: &ScheduleFrequency) -> String {
    match freq {
        ScheduleFrequency::Once { datetime } => {
            format!("Once at {}", datetime)
        }
        ScheduleFrequency::Daily { time } => {
            format!("Daily at {}", time)
        }
        ScheduleFrequency::Weekly { days, time } => {
            if days.is_empty() {
                format!("Weekly at {}", time)
            } else {
                format!("Every {} at {}", days.join(", "), time)
            }
        }
        ScheduleFrequency::Monthly { day, time } => {
            format!("Monthly on day {} at {}", day, time)
        }
        ScheduleFrequency::Cron { expression } => {
            format!("Cron: {}", expression)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_weekday() {
        assert_eq!(parse_weekday("mon"), Some(Weekday::Mon));
        assert_eq!(parse_weekday("Monday"), Some(Weekday::Mon));
        assert_eq!(parse_weekday("invalid"), None);
    }

    #[test]
    fn test_format_frequency() {
        let daily = ScheduleFrequency::Daily { time: "14:00".to_string() };
        assert_eq!(format_frequency(&daily), "Daily at 14:00");

        let weekly = ScheduleFrequency::Weekly {
            days: vec!["Monday".to_string(), "Friday".to_string()],
            time: "09:00".to_string(),
        };
        assert_eq!(format_frequency(&weekly), "Every Monday, Friday at 09:00");
    }

    #[test]
    fn test_scan_options_default() {
        let options = ScanOptions::default();
        assert!(options.scan_archives);
        assert!(!options.follow_symlinks);
        assert_eq!(options.cpu_priority, "normal");
    }
}
