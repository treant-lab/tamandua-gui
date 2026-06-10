import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export type LicenseType = 'community' | 'professional' | 'enterprise';
export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'grace_period' | 'no_license';

export interface License {
  id: string;
  organization_id: string;
  license_type: LicenseType;
  license_key_masked: string; // e.g., "XXXX-XXXX-XXXX-1234"
  expires_at: string;
  issued_at: string;
  status: LicenseStatus;
  features: LicenseFeature[];
  seats_used: number;
  seats_total: number;
  days_remaining: number;
  in_grace_period: boolean;
}

export interface LicenseFeature {
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'advanced' | 'enterprise' | 'mssp' | 'addon';
}

export interface LicenseUsage {
  endpoints_protected: number;
  events_processed: number;
  events_processed_24h: number;
  threats_blocked: number;
  threats_blocked_24h: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  api_calls_24h: number;
  api_calls_limit: number;
}

export interface ActivationRequest {
  license_key: string;
  organization_id?: string;
}

export interface OfflineActivationRequest {
  request_code: string;
}

export interface FeatureComparison {
  feature: string;
  description: string;
  community: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

export interface LicenseNotification {
  id: string;
  type: 'expiration_warning' | 'expired' | 'usage_limit' | 'feature_disabled';
  message: string;
  created_at: string;
  acknowledged: boolean;
}

// Hook for fetching current license
const EMPTY_LICENSE_USAGE: LicenseUsage = {
  endpoints_protected: 0,
  events_processed: 0,
  events_processed_24h: 0,
  threats_blocked: 0,
  threats_blocked_24h: 0,
  storage_used_gb: 0,
  storage_limit_gb: 0,
  api_calls_24h: 0,
  api_calls_limit: 0,
};

function unsupportedLicense(feature: string): Promise<never> {
  return Promise.reject(
    new Error(`${feature} is not wired to the local agent in this build.`)
  );
}

export function useLicense() {
  return useQuery<License | null>({
    queryKey: ['license'],
    queryFn: async () => null,
    refetchInterval: 60000, // Check every minute
  });
}

// Hook for fetching license usage statistics
export function useLicenseUsage() {
  return useQuery<LicenseUsage>({
    queryKey: ['license-usage'],
    queryFn: async () => EMPTY_LICENSE_USAGE,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Hook for activating a license (online)
export function useActivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ActivationRequest) =>
      unsupportedLicense('License activation'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license'] });
      queryClient.invalidateQueries({ queryKey: ['license-usage'] });
    },
  });
}

// Hook for generating offline activation request
export function useGenerateOfflineRequest() {
  return useMutation({
    mutationFn: (licenseKey: string) =>
      unsupportedLicense('Offline license request generation'),
  });
}

// Hook for completing offline activation
export function useCompleteOfflineActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activationResponse: string) =>
      unsupportedLicense('Offline license activation'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license'] });
      queryClient.invalidateQueries({ queryKey: ['license-usage'] });
    },
  });
}

// Hook for QR code activation
export function useGenerateQRActivation() {
  return useMutation({
    mutationFn: (licenseKey: string) =>
      unsupportedLicense('QR license activation'),
  });
}

// Hook for deactivating a license
export function useDeactivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unsupportedLicense('License deactivation'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license'] });
      queryClient.invalidateQueries({ queryKey: ['license-usage'] });
    },
  });
}

// Hook for validating a license key (without activating)
export function useValidateLicenseKey() {
  return useMutation({
    mutationFn: async (licenseKey: string) => ({
      valid: false,
      message: licenseKey.trim()
        ? 'License validation is not wired to the local agent in this build.'
        : 'Enter a license key.',
    }),
  });
}

// Hook for checking feature availability
export function useFeatureEnabled(feature: string) {
  const { data: license } = useLicense();

  if (!license) return false;

  return license.features.some(f => f.name === feature && f.enabled);
}

// Hook for fetching license notifications
export function useLicenseNotifications() {
  return useQuery<LicenseNotification[]>({
    queryKey: ['license-notifications'],
    queryFn: async () => [],
    refetchInterval: 300000, // Check every 5 minutes
  });
}

// Hook for acknowledging a notification
export function useAcknowledgeLicenseNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      unsupportedLicense('License notification acknowledgement'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-notifications'] });
    },
  });
}

// Feature comparison data
export function getFeatureComparison(): FeatureComparison[] {
  return [
    // Core Protection
    {
      feature: 'Real-time threat detection',
      description: 'YARA and Sigma rule-based detection',
      community: true,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'ML-powered malware detection',
      description: 'Advanced ML-based threat detection',
      community: 'Limited',
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Endpoints protected',
      description: 'Number of agents supported',
      community: '10',
      professional: '100',
      enterprise: 'Unlimited',
    },
    {
      feature: 'Data retention',
      description: 'How long event data is stored',
      community: '7 days',
      professional: '90 days',
      enterprise: '365 days',
    },
    // Response Actions
    {
      feature: 'Basic response actions',
      description: 'Kill process, quarantine file',
      community: true,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Network isolation',
      description: 'Isolate compromised endpoints',
      community: false,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Automated playbooks',
      description: 'Automated response workflows',
      community: false,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Live response',
      description: 'Interactive remote shell',
      community: false,
      professional: false,
      enterprise: true,
    },
    // Analysis
    {
      feature: 'Threat hunting',
      description: 'Custom query hunting',
      community: false,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Behavioral analytics',
      description: 'UEBA capabilities',
      community: false,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Advanced forensics',
      description: 'Memory and disk forensics',
      community: false,
      professional: false,
      enterprise: true,
    },
    // Integration
    {
      feature: 'REST API access',
      description: 'API for integrations',
      community: 'Read-only',
      professional: true,
      enterprise: true,
    },
    {
      feature: 'SIEM integration',
      description: 'Splunk, Elastic, etc.',
      community: false,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Custom integrations',
      description: 'Build custom connectors',
      community: false,
      professional: false,
      enterprise: true,
    },
    // Enterprise
    {
      feature: 'Single Sign-On (SSO)',
      description: 'SAML, OIDC, Azure AD, Okta',
      community: false,
      professional: false,
      enterprise: true,
    },
    {
      feature: 'Compliance reporting',
      description: 'SOC2, HIPAA, PCI-DSS reports',
      community: false,
      professional: false,
      enterprise: true,
    },
    {
      feature: 'Multi-tenant support',
      description: 'MSSP capabilities',
      community: false,
      professional: false,
      enterprise: true,
    },
    // Support
    {
      feature: 'Community support',
      description: 'Forums and documentation',
      community: true,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Email support',
      description: 'Direct email support',
      community: false,
      professional: true,
      enterprise: true,
    },
    {
      feature: 'Priority support',
      description: '24/7 phone + dedicated CSM',
      community: false,
      professional: false,
      enterprise: true,
    },
  ];
}

// Utility functions
export function getLicenseTypeLabel(type: LicenseType): string {
  const labels: Record<LicenseType, string> = {
    community: 'Community',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };
  return labels[type] || type;
}

export function getLicenseTypeColor(type: LicenseType): string {
  const colors: Record<LicenseType, string> = {
    community: 'bg-gray-600 text-gray-200',
    professional: 'bg-blue-600 text-blue-100',
    enterprise: 'bg-purple-600 text-purple-100',
  };
  return colors[type] || 'bg-gray-600 text-gray-200';
}

export function getLicenseStatusColor(status: LicenseStatus): string {
  const colors: Record<LicenseStatus, string> = {
    active: 'text-green-500',
    inactive: 'text-gray-500',
    expired: 'text-red-500',
    grace_period: 'text-orange-500',
    no_license: 'text-gray-500',
  };
  return colors[status] || 'text-gray-500';
}

export function formatLicenseKey(key: string, mask: boolean = true): string {
  if (!key) return '';

  // Format: XXXX-XXXX-XXXX-XXXX
  const cleaned = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const groups = cleaned.match(/.{1,4}/g) || [];
  const formatted = groups.join('-');

  if (mask && formatted.length >= 19) {
    return `XXXX-XXXX-XXXX-${formatted.slice(-4)}`;
  }

  return formatted;
}
