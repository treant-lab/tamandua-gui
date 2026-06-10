import {
  Shield,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe, formatRelativeSafe, parseDate } from '../utils/dateUtils';
import {
  License,
  LicenseUsage,
  LicenseStatus as LicenseStatusType,
  getLicenseTypeLabel,
  getLicenseTypeColor,
  getLicenseStatusColor,
} from '../hooks/useLicense';

interface LicenseStatusProps {
  license: License | null;
  usage: LicenseUsage | undefined;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function LicenseStatus({
  license,
  usage,
  onRefresh,
  isRefreshing,
}: LicenseStatusProps) {
  if (!license) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold mb-2">No License Activated</h3>
            <p className="text-gray-400 mb-4">
              Activate a license to unlock all features
            </p>
          </div>
        </div>
      </div>
    );
  }

  const expiresAt = parseDate(license.expires_at);
  const isExpiringSoon = license.days_remaining > 0 && license.days_remaining <= 30;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className={clsx(
          'p-6',
          license.license_type === 'enterprise'
            ? 'bg-gradient-to-r from-purple-900/50 to-gray-800'
            : license.license_type === 'professional'
            ? 'bg-gradient-to-r from-blue-900/50 to-gray-800'
            : 'bg-gray-800'
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div
              className={clsx(
                'p-3 rounded-lg',
                license.license_type === 'enterprise'
                  ? 'bg-purple-600'
                  : license.license_type === 'professional'
                  ? 'bg-blue-600'
                  : 'bg-gray-600'
              )}
            >
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={clsx(
                    'px-3 py-1 text-sm font-semibold rounded-full',
                    getLicenseTypeColor(license.license_type)
                  )}
                >
                  {getLicenseTypeLabel(license.license_type)}
                </span>
                <StatusBadge status={license.status} />
              </div>
              <h2 className="text-2xl font-bold mt-2">Tamandua EDR</h2>
            </div>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700"
            >
              <RefreshCw className={clsx('w-5 h-5', isRefreshing && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      {(license.in_grace_period || isExpiringSoon || license.status === 'expired') && (
        <div
          className={clsx(
            'px-6 py-3 flex items-center space-x-2',
            license.status === 'expired'
              ? 'bg-red-900/30 text-red-200'
              : license.in_grace_period
              ? 'bg-orange-900/30 text-orange-200'
              : 'bg-yellow-900/30 text-yellow-200'
          )}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            {license.status === 'expired'
              ? 'Your license has expired. Please renew to continue using all features.'
              : license.in_grace_period
              ? `License expired. Grace period active for ${license.days_remaining} more days.`
              : `License expires in ${license.days_remaining} days.`}
          </span>
        </div>
      )}

      {/* License Details */}
      <div className="p-6 space-y-6">
        {/* Key and Expiration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-gray-400">License Key</label>
            <div className="mt-1 font-mono text-lg">{license.license_key_masked}</div>
          </div>
          <div>
            <label className="text-sm text-gray-400">Expires</label>
            <div className="mt-1">
              <span className="text-lg">{formatDateSafe(license.expires_at, 'MMMM d, yyyy')}</span>
              <span className={clsx('ml-2 text-sm', getLicenseStatusColor(license.status))}>
                ({formatRelativeSafe(license.expires_at)})
              </span>
            </div>
          </div>
        </div>

        {/* Seats Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400 flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Endpoints Used</span>
            </label>
            <span className="text-sm">
              {license.seats_used} / {license.seats_total}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={clsx(
                'h-2 rounded-full transition-all',
                license.seats_used / license.seats_total > 0.9
                  ? 'bg-red-500'
                  : license.seats_used / license.seats_total > 0.7
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              )}
              style={{
                width: `${Math.min((license.seats_used / license.seats_total) * 100, 100)}%`,
              }}
            />
          </div>
          {license.seats_used >= license.seats_total && (
            <p className="text-xs text-red-400 mt-1">
              Seat limit reached. Upgrade to add more endpoints.
            </p>
          )}
        </div>

        {/* Features */}
        <div>
          <label className="text-sm text-gray-400 mb-3 block">Enabled Features</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {license.features
              .filter((f) => f.enabled)
              .slice(0, 9)
              .map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-center space-x-2 text-sm"
                >
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="truncate">{feature.description || feature.name}</span>
                </div>
              ))}
            {license.features.filter((f) => f.enabled).length > 9 && (
              <div className="text-sm text-gray-500">
                +{license.features.filter((f) => f.enabled).length - 9} more
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Usage Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <UsageStat
              label="Endpoints Protected"
              value={usage.endpoints_protected}
              icon={Shield}
            />
            <UsageStat
              label="Events (24h)"
              value={formatNumber(usage.events_processed_24h)}
              icon={RefreshCw}
            />
            <UsageStat
              label="Threats Blocked (24h)"
              value={usage.threats_blocked_24h}
              icon={AlertTriangle}
              highlight={usage.threats_blocked_24h > 0}
            />
            <UsageStat
              label="Storage Used"
              value={`${usage.storage_used_gb.toFixed(1)} GB`}
              icon={Clock}
              subtitle={`of ${usage.storage_limit_gb} GB`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: LicenseStatusType }) {
  const config: Record<LicenseStatusType, { icon: React.ComponentType<any>; label: string; class: string }> = {
    active: { icon: CheckCircle, label: 'Active', class: 'bg-green-900/30 text-green-400' },
    inactive: { icon: XCircle, label: 'Inactive', class: 'bg-gray-700 text-gray-400' },
    expired: { icon: XCircle, label: 'Expired', class: 'bg-red-900/30 text-red-400' },
    grace_period: { icon: Clock, label: 'Grace Period', class: 'bg-orange-900/30 text-orange-400' },
    no_license: { icon: XCircle, label: 'No License', class: 'bg-gray-700 text-gray-400' },
  };

  const { icon: Icon, label, class: className } = config[status];

  return (
    <span className={clsx('flex items-center space-x-1 px-2 py-0.5 text-xs rounded-full', className)}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </span>
  );
}

// Usage stat component
function UsageStat({
  label,
  value,
  icon: Icon,
  subtitle,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <Icon className={clsx('w-5 h-5 mx-auto mb-1', highlight ? 'text-red-400' : 'text-gray-500')} />
      <div className={clsx('text-xl font-semibold', highlight && 'text-red-400')}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {subtitle && <div className="text-xs text-gray-600">{subtitle}</div>}
    </div>
  );
}

// Compact license status card
export function LicenseStatusCompact({ license }: { license: License | null }) {
  if (!license) {
    return (
      <div className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <Shield className="w-8 h-8 text-gray-600" />
        <div>
          <div className="text-sm font-medium">No License</div>
          <div className="text-xs text-gray-500">Activate to unlock features</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
      <div
        className={clsx(
          'p-2 rounded-lg',
          license.license_type === 'enterprise'
            ? 'bg-purple-600'
            : license.license_type === 'professional'
            ? 'bg-blue-600'
            : 'bg-gray-600'
        )}
      >
        <Shield className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">
            {getLicenseTypeLabel(license.license_type)}
          </span>
          <StatusBadge status={license.status} />
        </div>
        <div className="text-xs text-gray-500">
          {license.days_remaining > 0
            ? `${license.days_remaining} days remaining`
            : 'Expired'}
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
