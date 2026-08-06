use serde::Serialize;

pub const ABI_VERSION: u32 = 1;
pub const SYSTEM_EXTENSION_ID: &str = "com.tamandua.agent.sysext.filemonitor";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[repr(u32)]
pub enum RequestKind {
    None = 0,
    Activation = 1,
    Deactivation = 2,
}

// Mirrors the fixed native ABI: variants are constructed only by the
// macOS-side decode() (plus tests), so non-macOS builds see them as dead.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[repr(u32)]
pub enum LifecycleState {
    Idle = 0,
    Submitted = 1,
    AwaitingUserApproval = 2,
    Completed = 3,
    WillCompleteAfterReboot = 4,
    Failed = 5,
}

// Mirrors the fixed native ABI: most variants are constructed only by the
// macOS-side decode() (plus tests), so non-macOS builds see them as dead.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[repr(u32)]
pub enum LifecycleError {
    None = 0,
    UnsupportedPlatform = 1,
    ConfirmationRequired = 2,
    ExtensionNotEmbedded = 3,
    SourceUnverified = 4,
    RequestInFlight = 5,
    SubmissionFailed = 6,
    RequestFailed = 7,
    NativeUnknown = 8,
    MissingEntitlement = 9,
    UnsupportedParentBundleLocation = 10,
    ExtensionNotFound = 11,
    InvalidExtensionIdentity = 12,
    DuplicateExtensionIdentity = 13,
    UnknownExtensionCategory = 14,
    CodeSignatureInvalid = 15,
    ValidationFailed = 16,
    ForbiddenBySystemPolicy = 17,
    RequestCanceled = 18,
    RequestSuperseded = 19,
    AuthorizationRequired = 20,
    InvalidSnapshot = 255,
}

impl LifecycleError {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::UnsupportedPlatform => "unsupported_platform",
            Self::ConfirmationRequired => "confirmation_required",
            Self::ExtensionNotEmbedded => "extension_not_embedded",
            Self::SourceUnverified => "source_unverified",
            Self::RequestInFlight => "request_in_flight",
            Self::SubmissionFailed => "submission_failed",
            Self::RequestFailed => "request_failed",
            Self::NativeUnknown => "native_unknown",
            Self::MissingEntitlement => "missing_entitlement",
            Self::UnsupportedParentBundleLocation => "unsupported_parent_bundle_location",
            Self::ExtensionNotFound => "extension_not_found",
            Self::InvalidExtensionIdentity => "invalid_extension_identity",
            Self::DuplicateExtensionIdentity => "duplicate_extension_identity",
            Self::UnknownExtensionCategory => "unknown_extension_category",
            Self::CodeSignatureInvalid => "code_signature_invalid",
            Self::ValidationFailed => "validation_failed",
            Self::ForbiddenBySystemPolicy => "forbidden_by_system_policy",
            Self::RequestCanceled => "request_canceled",
            Self::RequestSuperseded => "request_superseded",
            Self::AuthorizationRequired => "authorization_required",
            Self::InvalidSnapshot => "invalid_snapshot",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LifecycleSnapshot {
    pub abi_version: u32,
    pub extension_id: &'static str,
    pub sequence: u64,
    pub request_kind: RequestKind,
    pub state: LifecycleState,
    pub error: LifecycleError,
    pub detail: String,
    pub runtime_proven: bool,
    pub telemetry_proven: bool,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct NativeSnapshot {
    abi_version: u32,
    state: u32,
    request_kind: u32,
    error: u32,
    sequence: u64,
    detail: [u8; 192],
}

const _: () = assert!(std::mem::size_of::<NativeSnapshot>() == 216);
const _: () = assert!(std::mem::align_of::<NativeSnapshot>() == 8);
const _: () = assert!(std::mem::offset_of!(NativeSnapshot, sequence) == 16);
const _: () = assert!(std::mem::offset_of!(NativeSnapshot, detail) == 24);

// Pure state-machine mirror of the native lifecycle transitions; exercised
// by unit tests only (the bin never drives transitions from Rust).
#[cfg_attr(not(test), allow(dead_code))]
pub fn reduce(state: LifecycleState, event: ReducerEvent) -> LifecycleState {
    match event {
        ReducerEvent::Submit
            if !matches!(
                state,
                LifecycleState::Submitted | LifecycleState::AwaitingUserApproval
            ) =>
        {
            LifecycleState::Submitted
        }
        ReducerEvent::NeedsApproval if state == LifecycleState::Submitted => {
            LifecycleState::AwaitingUserApproval
        }
        ReducerEvent::Finish(false)
            if matches!(
                state,
                LifecycleState::Submitted | LifecycleState::AwaitingUserApproval
            ) =>
        {
            LifecycleState::Completed
        }
        ReducerEvent::Finish(true)
            if matches!(
                state,
                LifecycleState::Submitted | LifecycleState::AwaitingUserApproval
            ) =>
        {
            LifecycleState::WillCompleteAfterReboot
        }
        ReducerEvent::Fail
            if matches!(
                state,
                LifecycleState::Submitted | LifecycleState::AwaitingUserApproval
            ) =>
        {
            LifecycleState::Failed
        }
        _ => state,
    }
}

#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone, Copy)]
pub enum ReducerEvent {
    Submit,
    NeedsApproval,
    Finish(bool),
    Fail,
}

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn tmd_sysext_snapshot(out: *mut NativeSnapshot) -> i32;
    fn tmd_sysext_request_activation(out: *mut NativeSnapshot) -> i32;
    fn tmd_sysext_request_deactivation(out: *mut NativeSnapshot) -> i32;
}

#[cfg(target_os = "macos")]
fn native(call: unsafe extern "C" fn(*mut NativeSnapshot) -> i32) -> LifecycleSnapshot {
    let mut raw = NativeSnapshot {
        abi_version: 0,
        state: 5,
        request_kind: 0,
        error: 8,
        sequence: 0,
        detail: [0; 192],
    };
    let return_code = unsafe { call(&mut raw) };
    if return_code != 0 {
        return invalid_snapshot("native_return_code");
    }
    decode(raw).unwrap_or_else(|| invalid_snapshot("invalid_native_snapshot"))
}

#[cfg(target_os = "macos")]
fn decode(raw: NativeSnapshot) -> Option<LifecycleSnapshot> {
    if raw.abi_version != ABI_VERSION {
        return None;
    }
    let state = match raw.state {
        0 => LifecycleState::Idle,
        1 => LifecycleState::Submitted,
        2 => LifecycleState::AwaitingUserApproval,
        3 => LifecycleState::Completed,
        4 => LifecycleState::WillCompleteAfterReboot,
        5 => LifecycleState::Failed,
        _ => return None,
    };
    let kind = match raw.request_kind {
        0 => RequestKind::None,
        1 => RequestKind::Activation,
        2 => RequestKind::Deactivation,
        _ => return None,
    };
    let error = match raw.error {
        0 => LifecycleError::None,
        1 => LifecycleError::UnsupportedPlatform,
        2 => LifecycleError::ConfirmationRequired,
        3 => LifecycleError::ExtensionNotEmbedded,
        4 => LifecycleError::SourceUnverified,
        5 => LifecycleError::RequestInFlight,
        6 => LifecycleError::SubmissionFailed,
        7 => LifecycleError::RequestFailed,
        8 => LifecycleError::NativeUnknown,
        9 => LifecycleError::MissingEntitlement,
        10 => LifecycleError::UnsupportedParentBundleLocation,
        11 => LifecycleError::ExtensionNotFound,
        12 => LifecycleError::InvalidExtensionIdentity,
        13 => LifecycleError::DuplicateExtensionIdentity,
        14 => LifecycleError::UnknownExtensionCategory,
        15 => LifecycleError::CodeSignatureInvalid,
        16 => LifecycleError::ValidationFailed,
        17 => LifecycleError::ForbiddenBySystemPolicy,
        18 => LifecycleError::RequestCanceled,
        19 => LifecycleError::RequestSuperseded,
        20 => LifecycleError::AuthorizationRequired,
        _ => return None,
    };
    let valid_relation = match state {
        LifecycleState::Idle => {
            kind == RequestKind::None && error == LifecycleError::SourceUnverified
        }
        LifecycleState::Submitted | LifecycleState::AwaitingUserApproval => {
            matches!(kind, RequestKind::Activation | RequestKind::Deactivation)
                && matches!(
                    error,
                    LifecycleError::SourceUnverified | LifecycleError::RequestInFlight
                )
        }
        LifecycleState::Completed | LifecycleState::WillCompleteAfterReboot => {
            matches!(kind, RequestKind::Activation | RequestKind::Deactivation)
                && error == LifecycleError::SourceUnverified
        }
        LifecycleState::Failed => {
            matches!(kind, RequestKind::Activation | RequestKind::Deactivation)
                && !matches!(
                    error,
                    LifecycleError::None
                        | LifecycleError::UnsupportedPlatform
                        | LifecycleError::ConfirmationRequired
                        | LifecycleError::SourceUnverified
                        | LifecycleError::RequestInFlight
                )
        }
    };
    if !valid_relation {
        return None;
    }
    let end = raw.detail.iter().position(|byte| *byte == 0)?;
    let detail = std::str::from_utf8(&raw.detail[..end]).ok()?.to_owned();
    if detail.is_empty() {
        return None;
    }
    Some(LifecycleSnapshot {
        abi_version: raw.abi_version,
        extension_id: SYSTEM_EXTENSION_ID,
        sequence: raw.sequence,
        request_kind: kind,
        state,
        error,
        detail,
        runtime_proven: false,
        telemetry_proven: false,
    })
}

#[cfg(target_os = "macos")]
fn invalid_snapshot(detail: &str) -> LifecycleSnapshot {
    LifecycleSnapshot {
        abi_version: ABI_VERSION,
        extension_id: SYSTEM_EXTENSION_ID,
        sequence: 0,
        request_kind: RequestKind::None,
        state: LifecycleState::Failed,
        error: LifecycleError::InvalidSnapshot,
        detail: detail.into(),
        runtime_proven: false,
        telemetry_proven: false,
    }
}

#[cfg(not(target_os = "macos"))]
fn unsupported() -> LifecycleSnapshot {
    LifecycleSnapshot {
        abi_version: ABI_VERSION,
        extension_id: SYSTEM_EXTENSION_ID,
        sequence: 0,
        request_kind: RequestKind::None,
        state: LifecycleState::Failed,
        error: LifecycleError::UnsupportedPlatform,
        detail: "unsupported_platform".into(),
        runtime_proven: false,
        telemetry_proven: false,
    }
}

pub fn snapshot() -> LifecycleSnapshot {
    #[cfg(target_os = "macos")]
    {
        native(tmd_sysext_snapshot)
    }
    #[cfg(not(target_os = "macos"))]
    {
        unsupported()
    }
}
pub fn request_activation(confirmed: bool) -> Result<LifecycleSnapshot, LifecycleError> {
    request(confirmed, RequestKind::Activation)
}
pub fn request_deactivation(confirmed: bool) -> Result<LifecycleSnapshot, LifecycleError> {
    request(confirmed, RequestKind::Deactivation)
}
fn request(confirmed: bool, kind: RequestKind) -> Result<LifecycleSnapshot, LifecycleError> {
    if !confirmed {
        return Err(LifecycleError::ConfirmationRequired);
    }
    #[cfg(target_os = "macos")]
    let value = match kind {
        RequestKind::Activation => native(tmd_sysext_request_activation),
        RequestKind::Deactivation => native(tmd_sysext_request_deactivation),
        RequestKind::None => unreachable!(),
    };
    #[cfg(not(target_os = "macos"))]
    let value = {
        let _ = kind;
        unsupported()
    };
    if matches!(
        value.error,
        LifecycleError::None | LifecycleError::SourceUnverified
    ) {
        Ok(value)
    } else {
        Err(value.error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reducer_has_approval_reboot_and_failure_states() {
        assert_eq!(
            reduce(LifecycleState::Idle, ReducerEvent::Submit),
            LifecycleState::Submitted
        );
        assert_eq!(
            reduce(LifecycleState::Submitted, ReducerEvent::NeedsApproval),
            LifecycleState::AwaitingUserApproval
        );
        assert_eq!(
            reduce(
                LifecycleState::AwaitingUserApproval,
                ReducerEvent::Finish(true)
            ),
            LifecycleState::WillCompleteAfterReboot
        );
        assert_eq!(
            reduce(LifecycleState::Submitted, ReducerEvent::Fail),
            LifecycleState::Failed
        );
    }
    #[test]
    fn confirmation_is_required_before_platform_dispatch() {
        assert_eq!(
            request_deactivation(false),
            Err(LifecycleError::ConfirmationRequired)
        );
    }
    #[cfg(not(target_os = "macos"))]
    #[test]
    fn unsupported_platform_uses_zero_ffi() {
        let value = snapshot();
        assert_eq!(value.error, LifecycleError::UnsupportedPlatform);
        assert!(!value.runtime_proven && !value.telemetry_proven);
    }
}
