import { useState, type CSSProperties } from 'react';
import {
  Key,
  Shield,
  CreditCard,
  HelpCircle,
  ExternalLink,
  Bell,
  X,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe } from '../utils/dateUtils';

import {
  useLicense,
  useLicenseUsage,
  useLicenseNotifications,
  useAcknowledgeLicenseNotification,
  LicenseType,
} from '../hooks/useLicense';
import { LicenseStatus } from '../components/LicenseStatus';
import { LicenseActivation, LicenseDeactivation } from '../components/LicenseActivation';
import { FeatureComparison, UpgradeBanner } from '../components/FeatureComparison';

type Tab = 'overview' | 'activate' | 'features' | 'billing';

export function License() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: license, isLoading: licenseLoading, refetch: refetchLicense } = useLicense();
  const { data: usage } = useLicenseUsage();
  const { data: notifications = [] } = useLicenseNotifications();
  const acknowledgeNotification = useAcknowledgeLicenseNotification();

  const unacknowledgedNotifications = notifications.filter((n) => !n.acknowledged);

  const handleUpgrade = (tier: LicenseType) => {
    // Open upgrade page or contact form
    window.open(
      `https://treantlab.org/upgrade?tier=${tier}`,
      '_blank'
    );
  };

  const handleRefresh = async () => {
    await refetchLicense();
  };

  const handleAcknowledgeNotification = async (id: string) => {
    try {
      await acknowledgeNotification.mutateAsync(id);
    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
    }
  };

  if (licenseLoading) {
    return (
      <div className="p-8" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex items-center justify-center h-64">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2"
            style={{ borderColor: 'var(--emerald-400)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3" style={{ color: 'var(--fg)' }}>
            <Key className="w-8 h-8" />
            <span>License Management</span>
          </h1>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>
            Manage your Tamandua EDR license and subscription
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Notifications */}
          {unacknowledgedNotifications.length > 0 && (
            <div className="relative">
              <Bell className="w-6 h-6" style={{ color: 'var(--high)' }} />
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center"
                style={{ backgroundColor: 'var(--crit)', color: 'var(--fg)' }}
              >
                {unacknowledgedNotifications.length}
              </span>
            </div>
          )}

          <a
            href="https://support.treantlab.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3 py-2 text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--muted)' }}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Help</span>
          </a>
        </div>
      </div>

      {/* Notifications Banner */}
      {unacknowledgedNotifications.length > 0 && (
        <div className="space-y-2">
          {unacknowledgedNotifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start justify-between p-4 rounded-lg border"
              style={{
                backgroundColor:
                  notification.type === 'expired'
                    ? 'color-mix(in srgb, var(--crit) 15%, transparent)'
                    : notification.type === 'expiration_warning'
                    ? 'color-mix(in srgb, var(--high) 15%, transparent)'
                    : 'color-mix(in srgb, var(--emerald-400) 15%, transparent)',
                borderColor:
                  notification.type === 'expired'
                    ? 'var(--crit)'
                    : notification.type === 'expiration_warning'
                    ? 'var(--high)'
                    : 'var(--emerald-400)',
              }}
            >
              <div className="flex items-start space-x-3">
                <AlertTriangle
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  style={{
                    color:
                      notification.type === 'expired'
                        ? 'var(--crit)'
                        : notification.type === 'expiration_warning'
                        ? 'var(--high)'
                        : 'var(--emerald-400)',
                  }}
                />
                <div>
                  <p style={{ color: 'var(--fg)' }}>
                    {notification.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAcknowledgeNotification(notification.id)}
                className="p-1 transition-colors hover:opacity-80"
                style={{ color: 'var(--muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b" style={{ borderColor: 'var(--surface)' }}>
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'activate', label: 'Activation', icon: Key },
            { id: 'features', label: 'Features', icon: CreditCard },
            { id: 'billing', label: 'Billing', icon: CreditCard },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as Tab)}
              className="flex items-center space-x-2 px-1 py-4 border-b-2 text-sm font-medium transition-colors"
              style={{
                borderColor: activeTab === id ? 'var(--emerald-400)' : 'transparent',
                color: activeTab === id ? 'var(--emerald-400)' : 'var(--muted)',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <LicenseStatus
              license={license ?? null}
              usage={usage}
              onRefresh={handleRefresh}
              isRefreshing={licenseLoading}
            />

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QuickActionCard
                title="Renew License"
                description="Extend your license before it expires"
                icon={CreditCard}
                onClick={() => window.open('https://treantlab.org/renew', '_blank')}
              />
              <QuickActionCard
                title="Add Endpoints"
                description="Purchase additional endpoint seats"
                icon={Shield}
                onClick={() => window.open('https://treantlab.org/add-seats', '_blank')}
              />
              <QuickActionCard
                title="Contact Support"
                description="Get help with licensing issues"
                icon={HelpCircle}
                onClick={() => window.open('mailto:contato@treantlab.org', '_blank')}
              />
            </div>

            {/* Upgrade Prompt */}
            {license && license.license_type !== 'enterprise' && (
              <UpgradeBanner
                feature="Advanced Features"
                requiredTier="enterprise"
                onUpgrade={() => handleUpgrade('enterprise')}
              />
            )}
          </>
        )}

        {/* Activation Tab */}
        {activeTab === 'activate' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LicenseActivation onSuccess={handleRefresh} />

            {license && (
              <div className="space-y-6">
                {/* Current License Info */}
                <div
                  className="rounded-lg border p-6"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'color-mix(in srgb, var(--surface) 80%, var(--fg) 20%)',
                  }}
                >
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>
                    Current License
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--muted)' }}>Key</span>
                      <span className="font-mono" style={{ color: 'var(--fg)' }}>
                        {license.license_key_masked}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--muted)' }}>Type</span>
                      <span className="capitalize" style={{ color: 'var(--fg)' }}>
                        {license.license_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--muted)' }}>Status</span>
                      <span
                        className="capitalize"
                        style={{
                          color:
                            license.status === 'active'
                              ? 'var(--emerald-400)'
                              : license.status === 'expired'
                              ? 'var(--crit)'
                              : 'var(--high)',
                        }}
                      >
                        {license.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deactivation */}
                <LicenseDeactivation onSuccess={handleRefresh} />
              </div>
            )}
          </div>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <FeatureComparison
            currentTier={license?.license_type}
            onUpgrade={handleUpgrade}
          />
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Billing Summary */}
            <div
              className="rounded-lg border p-6"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'color-mix(in srgb, var(--surface) 80%, var(--fg) 20%)',
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--fg)' }}>
                Billing Summary
              </h3>

              {license ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm" style={{ color: 'var(--muted)' }}>
                        Current Plan
                      </span>
                      <p className="text-lg font-semibold capitalize" style={{ color: 'var(--fg)' }}>
                        {license.license_type}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: 'var(--muted)' }}>
                        Billing Cycle
                      </span>
                      <p className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
                        Annual
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: 'var(--muted)' }}>
                        Endpoints
                      </span>
                      <p className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
                        {license.seats_used} / {license.seats_total}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: 'var(--muted)' }}>
                        Next Renewal
                      </span>
                      <p className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
                        {formatDateSafe(license.expires_at, 'PP')}
                      </p>
                    </div>
                  </div>

                  <div
                    className="pt-4 border-t"
                    style={{ borderColor: 'color-mix(in srgb, var(--surface) 80%, var(--fg) 20%)' }}
                  >
                    <a
                      href="https://treantlab.org/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 transition-colors hover:opacity-80"
                      style={{ color: 'var(--emerald-400)' }}
                    >
                      <span>Manage billing in customer portal</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                  <p>No active license</p>
                  <button
                    onClick={() => setActiveTab('activate')}
                    className="mt-2 transition-colors hover:opacity-80"
                    style={{ color: 'var(--emerald-400)' }}
                  >
                    Activate a license
                  </button>
                </div>
              )}
            </div>

            {/* Invoice History */}
            <div
              className="rounded-lg border p-6"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'color-mix(in srgb, var(--surface) 80%, var(--fg) 20%)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
                  Invoice History
                </h3>
                <a
                  href="https://treantlab.org/invoices"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center space-x-1 transition-colors hover:opacity-80"
                  style={{ color: 'var(--emerald-400)' }}
                >
                  <span>View all</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                <p>Invoice history available in customer portal</p>
              </div>
            </div>

            {/* Payment Methods */}
            <div
              className="rounded-lg border p-6"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'color-mix(in srgb, var(--surface) 80%, var(--fg) 20%)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
                  Payment Methods
                </h3>
                <a
                  href="https://treantlab.org/payment-methods"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center space-x-1 transition-colors hover:opacity-80"
                  style={{ color: 'var(--emerald-400)' }}
                >
                  <span>Manage</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                <p>Payment methods managed in customer portal</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: CSSProperties }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg border transition-colors text-left hover:opacity-90"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'color-mix(in srgb, var(--surface) 80%, var(--fg) 20%)',
      }}
    >
      <Icon className="w-8 h-8 mb-3" style={{ color: 'var(--emerald-400)' }} />
      <h4 className="font-semibold" style={{ color: 'var(--fg)' }}>{title}</h4>
      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{description}</p>
    </button>
  );
}
