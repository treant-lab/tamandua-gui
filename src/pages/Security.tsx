import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  Fingerprint,
  Clock,
  History,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Check,
  Trash2,
  Key,
  Loader2,
} from 'lucide-react';
import { useAuth, calculatePasswordStrength } from '../hooks/useAuth';
import { useConfirm } from '../components/ConfirmDialog';
import { formatDateSafe } from '../utils/dateUtils';
import clsx from 'clsx';

export function Security() {
  const {
    isAuthenticated,
    biometricsEnabled,
    hasBiometrics,
    sessionTimeout,
    auditLog,
    changePassword,
    enableBiometrics,
    disableBiometrics,
    setSessionTimeout,
    clearAuditLog,
    requireAuth,
  } = useAuth();
  const confirm = useConfirm();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const newPasswordStrength = calculatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const canChangePassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPasswordStrength.score >= 50 &&
    passwordsMatch &&
    confirmPassword.length > 0;

  const handleChangePassword = useCallback(async () => {
    if (!canChangePassword) return;

    // Require auth before changing password
    const authed = await requireAuth();
    if (!authed) return;

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const success = await changePassword(currentPassword, newPassword);

      if (success) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError('Current password is incorrect');
      }
    } catch (err) {
      setPasswordError('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  }, [canChangePassword, currentPassword, newPassword, changePassword, requireAuth]);

  const handleToggleBiometrics = useCallback(async () => {
    // Require auth before changing biometric settings
    const authed = await requireAuth();
    if (!authed) return;

    setIsBiometricLoading(true);

    try {
      if (biometricsEnabled) {
        await disableBiometrics();
      } else {
        await enableBiometrics();
      }
    } catch (err) {
      console.error('Biometric toggle failed:', err);
    } finally {
      setIsBiometricLoading(false);
    }
  }, [biometricsEnabled, enableBiometrics, disableBiometrics, requireAuth]);

  const handleClearAuditLog = useCallback(async () => {
    // Require auth before clearing audit log
    const authed = await requireAuth();
    if (!authed) return;

    const confirmed = await confirm({
      title: 'Clear Authentication History',
      message: 'This will permanently delete all authentication history. This action cannot be undone.',
      confirmText: 'Clear History',
      variant: 'danger',
    });

    if (confirmed) {
      clearAuditLog();
    }
  }, [clearAuditLog, requireAuth, confirm]);

  const getStrengthColor = () => {
    switch (newPasswordStrength.level) {
      case 'weak':
        return 'var(--crit)';
      case 'fair':
        return 'var(--high)';
      case 'good':
        return 'var(--high)';
      case 'strong':
        return 'var(--emerald-400)';
      case 'excellent':
        return 'var(--emerald-500)';
    }
  };

  const getStrengthTextColor = () => {
    switch (newPasswordStrength.level) {
      case 'weak':
        return 'var(--crit)';
      case 'fair':
        return 'var(--high)';
      case 'good':
        return 'var(--high)';
      case 'strong':
        return 'var(--emerald-400)';
      case 'excellent':
        return 'var(--emerald-400)';
    }
  };

  const getAuditActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <Check className="w-4 h-4" style={{ color: 'var(--emerald-400)' }} />;
      case 'logout':
        return <Lock className="w-4 h-4" style={{ color: 'var(--muted)' }} />;
      case 'failed_attempt':
        return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--high)' }} />;
      case 'password_changed':
        return <Key className="w-4 h-4" style={{ color: 'var(--emerald-400)' }} />;
      case 'biometric_enrolled':
        return <Fingerprint className="w-4 h-4" style={{ color: 'var(--emerald-400)' }} />;
      case 'lockout':
        return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--crit)' }} />;
      default:
        return <History className="w-4 h-4" style={{ color: 'var(--muted)' }} />;
    }
  };

  const getAuditActionText = (action: string) => {
    switch (action) {
      case 'login':
        return 'Authenticated';
      case 'logout':
        return 'Session ended';
      case 'failed_attempt':
        return 'Failed authentication';
      case 'password_changed':
        return 'Password changed';
      case 'biometric_enrolled':
        return 'Biometrics enrolled';
      case 'lockout':
        return 'Account locked out';
      default:
        return action;
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center space-x-3" style={{ color: 'var(--fg)' }}>
          <Shield className="w-8 h-8" style={{ color: 'var(--emerald-400)' }} />
          <span>Security Settings</span>
        </h1>
        <p className="mt-1" style={{ color: 'var(--muted)' }}>
          Manage your authentication and security preferences
        </p>
      </div>

      {/* Auth Status Banner */}
      {!isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4"
          style={{
            background: 'var(--high-bg)',
            border: '1px solid rgba(245, 165, 36, 0.3)',
          }}
        >
          <div className="flex items-center space-x-3">
            <Lock className="w-5 h-5" style={{ color: 'var(--high)' }} />
            <p style={{ color: 'var(--high)' }}>
              Session locked. Authenticate to change security settings.
            </p>
          </div>
        </motion.div>
      )}

      {/* Change Password */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
          <Key className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
          <span>Change Password</span>
        </h2>

        <div className="space-y-4 max-w-md">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 rounded-lg transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                  '--tw-ring-color': 'var(--emerald-400)',
                } as React.CSSProperties}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-12 rounded-lg transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                  '--tw-ring-color': 'var(--emerald-400)',
                } as React.CSSProperties}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Strength Meter */}
            {newPassword.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3"
              >
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: 'var(--muted)' }}>Strength</span>
                  <span style={{ color: getStrengthTextColor() }}>
                    {newPasswordStrength.level.charAt(0).toUpperCase() +
                      newPasswordStrength.level.slice(1)}
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: getStrengthColor() }}
                    initial={{ width: 0 }}
                    animate={{ width: `${newPasswordStrength.score}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 pr-12 rounded-lg transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--surface-2)',
                  border: `1px solid ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'var(--crit)'
                      : confirmPassword.length > 0 && passwordsMatch
                      ? 'var(--emerald-400)'
                      : 'var(--border)'
                  }`,
                  color: 'var(--fg)',
                  '--tw-ring-color': 'var(--emerald-400)',
                } as React.CSSProperties}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-sm"
                style={{ color: 'var(--crit)' }}
              >
                Passwords do not match
              </motion.p>
            )}
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {passwordError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-lg"
                style={{
                  background: 'var(--crit-bg)',
                  border: '1px solid rgba(240, 80, 110, 0.3)',
                }}
              >
                <p className="text-sm" style={{ color: 'var(--crit)' }}>{passwordError}</p>
              </motion.div>
            )}
            {passwordSuccess && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-lg flex items-center space-x-2"
                style={{
                  background: 'rgba(47, 196, 113, 0.12)',
                  border: '1px solid rgba(47, 196, 113, 0.3)',
                }}
              >
                <Check className="w-4 h-4" style={{ color: 'var(--emerald-400)' }} />
                <p className="text-sm" style={{ color: 'var(--emerald-400)' }}>Password changed successfully</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            type="button"
            onClick={handleChangePassword}
            disabled={!canChangePassword || isChangingPassword}
            whileHover={canChangePassword ? { scale: 1.02 } : {}}
            whileTap={canChangePassword ? { scale: 0.98 } : {}}
            className={clsx(
              'w-full py-3 px-4 rounded-lg font-medium',
              'transition-colors',
              'flex items-center justify-center space-x-2',
              (!canChangePassword || isChangingPassword) && 'opacity-50 cursor-not-allowed'
            )}
            style={{
              background: 'var(--emerald-500)',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              if (canChangePassword && !isChangingPassword) {
                e.currentTarget.style.background = 'var(--emerald-400)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--emerald-500)';
            }}
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Changing...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Change Password</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Biometric Settings */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
          <Fingerprint className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
          <span>Biometric Authentication</span>
        </h2>

        {hasBiometrics ? (
          <div className="flex items-center justify-between max-w-md">
            <div>
              <p style={{ color: 'var(--fg-2)' }}>Use biometrics to unlock</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {biometricsEnabled
                  ? 'Quick unlock with fingerprint or face'
                  : 'Enable for faster authentication'}
              </p>
            </div>
            <motion.button
              onClick={handleToggleBiometrics}
              disabled={isBiometricLoading}
              className="w-14 h-8 rounded-full relative transition-colors"
              style={{
                background: biometricsEnabled ? 'var(--emerald-500)' : 'var(--surface-3)',
              }}
            >
              <motion.div
                className="absolute w-6 h-6 rounded-full top-1 shadow-md flex items-center justify-center"
                style={{ background: '#fff' }}
                animate={{ left: biometricsEnabled ? '30px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {isBiometricLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--surface-3)' }} />
                )}
              </motion.div>
            </motion.button>
          </div>
        ) : (
          <div
            className="p-4 rounded-lg"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ color: 'var(--muted)' }}>
              Biometric authentication is not available on this device.
            </p>
          </div>
        )}
      </div>

      {/* Session Settings */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
          <Clock className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
          <span>Session Settings</span>
        </h2>

        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              Auto-lock after inactivity
            </label>
            <select
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                '--tw-ring-color': 'var(--emerald-400)',
              } as React.CSSProperties}
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Dashboard will auto-lock after this period of inactivity
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
            <History className="w-5 h-5" style={{ color: 'var(--emerald-400)' }} />
            <span>Authentication History</span>
          </h2>
          {auditLog.length > 0 && (
            <button
              onClick={handleClearAuditLog}
              className="flex items-center space-x-1 text-sm transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {auditLog.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {auditLog.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center space-x-3 p-3 rounded-lg"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--surface-3)' }}
                >
                  {getAuditActionIcon(entry.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--fg-2)' }}>
                    {getAuditActionText(entry.action)}
                  </p>
                  {entry.details && (
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{entry.details}</p>
                  )}
                </div>
                <p className="text-xs whitespace-nowrap" style={{ color: 'var(--subtle)' }}>
                  {formatDateSafe(entry.timestamp, 'MMM d, h:mm a')}
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No authentication history</p>
          </div>
        )}
      </div>

      {/* Emergency Recovery */}
      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderLeft: '4px solid var(--high)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--high)' }} />
          <span>Emergency Recovery</span>
        </h2>
        <p className="mb-4" style={{ color: 'var(--muted)' }}>
          Set up recovery options in case you forget your password or lose access.
        </p>
        <div
          className="rounded-lg p-4"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Emergency recovery options are not yet available. If you forget your password,
            you will need to reset the application settings.
          </p>
        </div>
      </div>
    </div>
  );
}
