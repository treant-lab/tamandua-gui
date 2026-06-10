import { useState, useRef, useEffect } from 'react';
import { Bell, Volume2, VolumeX, Monitor, MonitorOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useNotificationSubscription,
  useNotificationPreferences,
  useRequestNotificationPermission,
} from '@/hooks/useNotifications';
import { NotificationBadge } from './NotificationBadge';
import { NotificationList } from './NotificationList';
import { Switch } from '@/components/ui/switch';

interface NotificationCenterProps {
  className?: string;
}

/**
 * Bell icon with dropdown notification panel
 * Integrates with header area of Layout
 */
export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { notifications, groupedNotifications, unreadCount, isLoading } = useNotifications();
  const [preferences, updatePreferences] = useNotificationPreferences();
  const { permission, requestPermission } = useRequestNotificationPermission();

  // Subscribe to new notifications
  useNotificationSubscription();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowSettings(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setShowSettings(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowSettings(false);
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  const handleBackFromSettings = () => {
    setShowSettings(false);
  };

  const handleEnableDesktop = async () => {
    if (permission !== 'granted') {
      await requestPermission();
    }
    updatePreferences({ desktopEnabled: true });
  };

  return (
    <div className={cn('relative', className)}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          'hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500',
          isOpen && 'bg-gray-700'
        )}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell
          className={cn(
            'w-5 h-5 transition-colors',
            unreadCount > 0 ? 'text-gray-100' : 'text-gray-400'
          )}
        />
        <NotificationBadge count={unreadCount} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute right-0 top-full mt-2 z-50',
            'w-96 max-w-[calc(100vw-2rem)]',
            'bg-gray-800 border border-gray-700 rounded-lg shadow-xl',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200'
          )}
          role="dialog"
          aria-label="Notifications"
        >
          {showSettings ? (
            <NotificationSettings
              preferences={preferences}
              updatePreferences={updatePreferences}
              permission={permission}
              onEnableDesktop={handleEnableDesktop}
              onBack={handleBackFromSettings}
            />
          ) : (
            <NotificationList
              notifications={notifications}
              groupedNotifications={groupedNotifications}
              isLoading={isLoading}
              onClose={handleClose}
              onOpenSettings={handleOpenSettings}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Notification Settings Panel
// ============================================================================

interface NotificationSettingsProps {
  preferences: {
    soundEnabled: boolean;
    desktopEnabled: boolean;
    showAlerts: boolean;
    showWarnings: boolean;
    showInfo: boolean;
    showSuccess: boolean;
  };
  updatePreferences: (updates: Partial<NotificationSettingsProps['preferences']>) => void;
  permission: NotificationPermission | 'unsupported';
  onEnableDesktop: () => void;
  onBack: () => void;
}

function NotificationSettings({
  preferences,
  updatePreferences,
  permission,
  onEnableDesktop,
  onBack,
}: NotificationSettingsProps) {
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-gray-700 transition-colors"
          aria-label="Back to notifications"
        >
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-100">Notification Settings</h3>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        {/* Sound */}
        <SettingRow
          icon={preferences.soundEnabled ? Volume2 : VolumeX}
          label="Sound notifications"
          description="Play a sound when new notifications arrive"
        >
          <Switch
            checked={preferences.soundEnabled}
            onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
          />
        </SettingRow>

        {/* Desktop */}
        <SettingRow
          icon={preferences.desktopEnabled ? Monitor : MonitorOff}
          label="Desktop notifications"
          description={
            permission === 'denied'
              ? 'Permission denied. Enable in browser settings.'
              : permission === 'unsupported'
              ? 'Not supported in this browser'
              : 'Show system notifications for new alerts'
          }
        >
          {permission === 'granted' ? (
            <Switch
              checked={preferences.desktopEnabled}
              onCheckedChange={(checked) => updatePreferences({ desktopEnabled: checked })}
            />
          ) : permission === 'default' ? (
            <button
              onClick={onEnableDesktop}
              className="px-3 py-1 text-xs font-medium text-primary-400 bg-primary-900/30 rounded hover:bg-primary-900/50 transition-colors"
            >
              Enable
            </button>
          ) : (
            <span className="text-xs text-gray-500">
              {permission === 'denied' ? 'Blocked' : 'Unavailable'}
            </span>
          )}
        </SettingRow>

        {/* Divider */}
        <div className="border-t border-gray-700 my-4" />

        {/* Type filters */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Show notification types
          </h4>
          <div className="space-y-3">
            <TypeToggle
              label="Alerts"
              description="Critical security threats"
              checked={preferences.showAlerts}
              onChange={(checked) => updatePreferences({ showAlerts: checked })}
              color="red"
            />
            <TypeToggle
              label="Warnings"
              description="Suspicious activity"
              checked={preferences.showWarnings}
              onChange={(checked) => updatePreferences({ showWarnings: checked })}
              color="yellow"
            />
            <TypeToggle
              label="Info"
              description="Scans, updates, status changes"
              checked={preferences.showInfo}
              onChange={(checked) => updatePreferences({ showInfo: checked })}
              color="blue"
            />
            <TypeToggle
              label="Success"
              description="Completed actions, resolved threats"
              checked={preferences.showSuccess}
              onChange={(checked) => updatePreferences({ showSuccess: checked })}
              color="green"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ icon: Icon, label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-200">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface TypeToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  color: 'red' | 'yellow' | 'blue' | 'green';
}

function TypeToggle({ label, description, checked, onChange, color }: TypeToggleProps) {
  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full', colorClasses[color])} />
        <div>
          <p className="text-sm text-gray-300">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Re-export components for convenience
export { NotificationBadge } from './NotificationBadge';
export { NotificationItem } from './NotificationItem';
export { NotificationList } from './NotificationList';
