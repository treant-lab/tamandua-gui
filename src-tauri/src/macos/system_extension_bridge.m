#import <Foundation/Foundation.h>
#import <SystemExtensions/SystemExtensions.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define TMD_ABI_VERSION UINT32_C(1)
#define TMD_DETAIL_CAPACITY 192u

static NSString *const TMD_HOST_ID = @"com.tamandua.edr";
static NSString *const TMD_EXTENSION_ID =
    @"com.tamandua.agent.sysext.filemonitor";
static NSString *const TMD_EXTENSION_RELATIVE_PATH =
    @"Contents/Library/SystemExtensions/"
    @"com.tamandua.agent.sysext.filemonitor.systemextension";

typedef struct {
  uint32_t abi_version;
  uint32_t state;
  uint32_t request_kind;
  uint32_t error;
  uint64_t sequence;
  char detail[TMD_DETAIL_CAPACITY];
} tmd_sysext_snapshot_t;

_Static_assert(sizeof(tmd_sysext_snapshot_t) == 216,
               "tmd_sysext_snapshot_t size drift");
_Static_assert(_Alignof(tmd_sysext_snapshot_t) == 8,
               "tmd_sysext_snapshot_t alignment drift");
_Static_assert(offsetof(tmd_sysext_snapshot_t, sequence) == 16,
               "tmd_sysext_snapshot_t sequence offset drift");
_Static_assert(offsetof(tmd_sysext_snapshot_t, detail) == 24,
               "tmd_sysext_snapshot_t detail offset drift");

enum {
  TMD_IDLE = 0,
  TMD_SUBMITTED = 1,
  TMD_APPROVAL = 2,
  TMD_COMPLETED = 3,
  TMD_REBOOT = 4,
  TMD_FAILED = 5
};
enum { TMD_NONE = 0, TMD_ACTIVATION = 1, TMD_DEACTIVATION = 2 };
enum {
  TMD_OK = 0,
  TMD_UNSUPPORTED = 1,
  TMD_CONFIRMATION = 2,
  TMD_NOT_EMBEDDED = 3,
  TMD_SOURCE_UNVERIFIED = 4,
  TMD_IN_FLIGHT = 5,
  TMD_SUBMISSION_FAILED = 6,
  TMD_REQUEST_FAILED = 7,
  TMD_NATIVE_UNKNOWN = 8,
  TMD_MISSING_ENTITLEMENT = 9,
  TMD_PARENT_LOCATION = 10,
  TMD_EXTENSION_NOT_FOUND = 11,
  TMD_INVALID_IDENTITY = 12,
  TMD_DUPLICATE_IDENTITY = 13,
  TMD_UNKNOWN_CATEGORY = 14,
  TMD_SIGNATURE_INVALID = 15,
  TMD_VALIDATION_FAILED = 16,
  TMD_POLICY_FORBIDDEN = 17,
  TMD_CANCELED = 18,
  TMD_SUPERSEDED = 19,
  TMD_AUTHORIZATION_REQUIRED = 20
};

static void TMDSetDetail(tmd_sysext_snapshot_t *snapshot,
                         const char *detail) {
  memset(snapshot->detail, 0, sizeof(snapshot->detail));
  (void)snprintf(snapshot->detail, sizeof(snapshot->detail), "%s",
                 detail != NULL ? detail : "source_unverified");
}

@interface TMDSystemExtensionCoordinator
    : NSObject <OSSystemExtensionRequestDelegate>
@property(nonatomic, strong, readonly) dispatch_queue_t queue;
@property(nonatomic, strong, nullable) OSSystemExtensionRequest *request;
@property(nonatomic, assign) tmd_sysext_snapshot_t snapshot;
- (void)submitOnQueue:(uint32_t)kind output:(tmd_sysext_snapshot_t *)output;
@end

@implementation TMDSystemExtensionCoordinator

- (instancetype)init {
  self = [super init];
  if (self != nil) {
    _queue = dispatch_queue_create("com.tamandua.edr.sysext.lifecycle",
                                   DISPATCH_QUEUE_SERIAL);
    _snapshot = (tmd_sysext_snapshot_t){TMD_ABI_VERSION, TMD_IDLE, TMD_NONE,
                                        TMD_SOURCE_UNVERIFIED, 0, {0}};
    TMDSetDetail(&_snapshot, "source_unverified");
  }
  return self;
}

- (BOOL)inFlight {
  return self.request != nil &&
         (_snapshot.state == TMD_SUBMITTED || _snapshot.state == TMD_APPROVAL);
}

- (BOOL)embeddedSourceMatchesFixedIdentity {
  NSBundle *host = NSBundle.mainBundle;
  if (![host.bundleIdentifier isEqualToString:TMD_HOST_ID]) {
    return NO;
  }
  NSURL *expected = [host.bundleURL
      URLByAppendingPathComponent:TMD_EXTENSION_RELATIVE_PATH
                   isDirectory:YES];
  NSBundle *extension = [NSBundle bundleWithURL:expected];
  return extension != nil &&
         [extension.bundleIdentifier isEqualToString:TMD_EXTENSION_ID];
}

- (void)setState:(uint32_t)state
             kind:(uint32_t)kind
            error:(uint32_t)error
           detail:(const char *)detail {
  _snapshot.abi_version = TMD_ABI_VERSION;
  _snapshot.state = state;
  _snapshot.request_kind = kind;
  _snapshot.error = error;
  _snapshot.sequence += 1;
  TMDSetDetail(&_snapshot, detail);
}

- (void)submitOnQueue:(uint32_t)kind output:(tmd_sysext_snapshot_t *)output {
  if ([self inFlight]) {
    *output = _snapshot;
    output->error = TMD_IN_FLIGHT;
    TMDSetDetail(output, "request_in_flight");
    return;
  }
  if (![self embeddedSourceMatchesFixedIdentity]) {
    [self setState:TMD_FAILED
               kind:kind
              error:TMD_NOT_EMBEDDED
             detail:"extension_not_embedded_or_identity_mismatch"];
    *output = _snapshot;
    return;
  }

  OSSystemExtensionRequest *request =
      kind == TMD_ACTIVATION
          ? [OSSystemExtensionRequest activationRequestForExtension:TMD_EXTENSION_ID
                                                               queue:self.queue]
          : [OSSystemExtensionRequest deactivationRequestForExtension:TMD_EXTENSION_ID
                                                                 queue:self.queue];
  if (request == nil) {
    [self setState:TMD_FAILED
               kind:kind
              error:TMD_SUBMISSION_FAILED
             detail:"submission_failed"];
    *output = _snapshot;
    return;
  }
  self.request = request;
  request.delegate = self;
  [self setState:TMD_SUBMITTED
             kind:kind
            error:TMD_SOURCE_UNVERIFIED
           detail:"submitted_source_unverified"];
  [[OSSystemExtensionManager sharedManager] submitRequest:request];
  *output = _snapshot;
}

- (BOOL)isCurrentRequest:(OSSystemExtensionRequest *)request {
  return request != nil && request == self.request && [self inFlight];
}

- (nullable NSArray<NSNumber *> *)numericVersion:(NSString *)version {
  if (version.length == 0) {
    return nil;
  }
  NSArray<NSString *> *parts = [version componentsSeparatedByString:@"."];
  NSMutableArray<NSNumber *> *values =
      [NSMutableArray arrayWithCapacity:parts.count];
  NSCharacterSet *digits = NSCharacterSet.decimalDigitCharacterSet;
  for (NSString *part in parts) {
    if (part.length == 0 ||
        [part rangeOfCharacterFromSet:digits.invertedSet].location != NSNotFound) {
      return nil;
    }
    unsigned long long value = 0;
    NSScanner *scanner = [NSScanner scannerWithString:part];
    if (![scanner scanUnsignedLongLong:&value] || !scanner.isAtEnd) {
      return nil;
    }
    [values addObject:@(value)];
  }
  return values;
}

- (NSComparisonResult)compareNumericVersion:(NSArray<NSNumber *> *)left
                                         to:(NSArray<NSNumber *> *)right {
  NSUInteger count = MAX(left.count, right.count);
  for (NSUInteger index = 0; index < count; index += 1) {
    unsigned long long lhs =
        index < left.count ? left[index].unsignedLongLongValue : 0;
    unsigned long long rhs =
        index < right.count ? right[index].unsignedLongLongValue : 0;
    if (lhs < rhs) {
      return NSOrderedAscending;
    }
    if (lhs > rhs) {
      return NSOrderedDescending;
    }
  }
  return NSOrderedSame;
}

- (OSSystemExtensionReplacementAction)
                  request:(OSSystemExtensionRequest *)request
    actionForReplacingExtension:(OSSystemExtensionProperties *)existingExtension
                  withExtension:(OSSystemExtensionProperties *)extension {
  if (![self isCurrentRequest:request]) {
    return OSSystemExtensionReplacementActionCancel;
  }
  NSArray<NSNumber *> *oldVersion =
      [self numericVersion:existingExtension.bundleShortVersion];
  NSArray<NSNumber *> *newVersion =
      [self numericVersion:extension.bundleShortVersion];
  if (oldVersion == nil || newVersion == nil) {
    return OSSystemExtensionReplacementActionCancel;
  }
  return [self compareNumericVersion:newVersion to:oldVersion] ==
                 NSOrderedDescending
             ? OSSystemExtensionReplacementActionReplace
             : OSSystemExtensionReplacementActionCancel;
}

- (void)requestNeedsUserApproval:(OSSystemExtensionRequest *)request {
  if (![self isCurrentRequest:request] || _snapshot.state != TMD_SUBMITTED) {
    return;
  }
  [self setState:TMD_APPROVAL
             kind:_snapshot.request_kind
            error:TMD_SOURCE_UNVERIFIED
           detail:"awaiting_user_approval_source_unverified"];
}

- (void)request:(OSSystemExtensionRequest *)request
    didFinishWithResult:(OSSystemExtensionRequestResult)result {
  if (![self isCurrentRequest:request]) {
    return;
  }
  uint32_t kind = _snapshot.request_kind;
  if (result == OSSystemExtensionRequestCompleted) {
    [self setState:TMD_COMPLETED
               kind:kind
              error:TMD_SOURCE_UNVERIFIED
             detail:"completed_source_unverified"];
  } else if (result == OSSystemExtensionRequestWillCompleteAfterReboot) {
    [self setState:TMD_REBOOT
               kind:kind
              error:TMD_SOURCE_UNVERIFIED
             detail:"will_complete_after_reboot_source_unverified"];
  } else {
    [self setState:TMD_FAILED
               kind:kind
              error:TMD_NATIVE_UNKNOWN
             detail:"unknown_finish_result"];
  }
  self.request = nil;
}

- (uint32_t)categoryForError:(NSError *)error {
  if (![error.domain isEqualToString:OSSystemExtensionErrorDomain]) {
    return TMD_NATIVE_UNKNOWN;
  }
  switch (error.code) {
  case OSSystemExtensionErrorMissingEntitlement:
    return TMD_MISSING_ENTITLEMENT;
  case OSSystemExtensionErrorUnsupportedParentBundleLocation:
    return TMD_PARENT_LOCATION;
  case OSSystemExtensionErrorExtensionNotFound:
    return TMD_EXTENSION_NOT_FOUND;
  case OSSystemExtensionErrorExtensionMissingIdentifier:
    return TMD_INVALID_IDENTITY;
  case OSSystemExtensionErrorDuplicateExtensionIdentifer:
    return TMD_DUPLICATE_IDENTITY;
  case OSSystemExtensionErrorUnknownExtensionCategory:
    return TMD_UNKNOWN_CATEGORY;
  case OSSystemExtensionErrorCodeSignatureInvalid:
    return TMD_SIGNATURE_INVALID;
  case OSSystemExtensionErrorValidationFailed:
    return TMD_VALIDATION_FAILED;
  case OSSystemExtensionErrorForbiddenBySystemPolicy:
    return TMD_POLICY_FORBIDDEN;
  case OSSystemExtensionErrorRequestCanceled:
    return TMD_CANCELED;
  case OSSystemExtensionErrorRequestSuperseded:
    return TMD_SUPERSEDED;
  case OSSystemExtensionErrorAuthorizationRequired:
    return TMD_AUTHORIZATION_REQUIRED;
  case OSSystemExtensionErrorUnknown:
  default:
    return TMD_NATIVE_UNKNOWN;
  }
}

- (void)request:(OSSystemExtensionRequest *)request
    didFailWithError:(NSError *)error {
  if (![self isCurrentRequest:request]) {
    return;
  }
  uint32_t kind = _snapshot.request_kind;
  uint32_t category = [self categoryForError:error];
  [self setState:TMD_FAILED
             kind:kind
            error:category
           detail:"request_failed_categorical"];
  self.request = nil;
}

@end

static TMDSystemExtensionCoordinator *TMDCoordinator(void) {
  static TMDSystemExtensionCoordinator *value;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    value = [TMDSystemExtensionCoordinator new];
  });
  return value;
}

int32_t tmd_sysext_snapshot(tmd_sysext_snapshot_t *out) {
  if (out == NULL) {
    return -1;
  }
  TMDSystemExtensionCoordinator *coordinator = TMDCoordinator();
  dispatch_sync(coordinator.queue, ^{
    *out = coordinator.snapshot;
  });
  return 0;
}

static int32_t TMDRequest(uint32_t kind, tmd_sysext_snapshot_t *out) {
  if (out == NULL || (kind != TMD_ACTIVATION && kind != TMD_DEACTIVATION)) {
    return -1;
  }
  TMDSystemExtensionCoordinator *coordinator = TMDCoordinator();
  dispatch_sync(coordinator.queue, ^{
    [coordinator submitOnQueue:kind output:out];
  });
  return 0;
}

int32_t tmd_sysext_request_activation(tmd_sysext_snapshot_t *out) {
  return TMDRequest(TMD_ACTIVATION, out);
}

int32_t tmd_sysext_request_deactivation(tmd_sysext_snapshot_t *out) {
  return TMDRequest(TMD_DEACTIVATION, out);
}
