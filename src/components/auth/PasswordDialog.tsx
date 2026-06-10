import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Fingerprint, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth, formatTimeRemaining } from '../../hooks/useAuth';
import clsx from 'clsx';

export interface PasswordDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
  showBiometricOption?: boolean;
}

export function PasswordDialog({
  isOpen,
  onClose,
  onSuccess,
  title = 'Authentication Required',
  subtitle = 'Enter your password to continue',
  showBiometricOption = true,
}: PasswordDialogProps) {
const {
    authenticate,
    setShowPasswordDialog,
    setShowBiometricPrompt,
    isLockedOut,
    lockoutEndTime,
    failedAttempts,
    hasBiometrics,
    biometricsEnabled,
  } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setIsLoading(false);
      setShake(false);
    }
  }, [isOpen]);

  // Lockout countdown
  useEffect(() => {
    if (isLockedOut && lockoutEndTime) {
      const updateRemaining = () => {
        const remaining = Math.max(0, Math.ceil((lockoutEndTime.getTime() - Date.now()) / 1000));
        setLockoutRemaining(remaining);
      };

      updateRemaining();
      const interval = setInterval(updateRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [isLockedOut, lockoutEndTime]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut || isLoading || !password.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await authenticate(password, remember);

      if (success) {
        setShowPasswordDialog(false);
        onSuccess?.();
      } else {
        setError('Incorrect password');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setError('Authentication failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  }, [password, remember, isLockedOut, isLoading, authenticate, setShowPasswordDialog, onSuccess]);

  const handleBiometricClick = useCallback(() => {
    setShowPasswordDialog(false);
    setShowBiometricPrompt(true);
  }, [setShowPasswordDialog, setShowBiometricPrompt]);

  const handleClose = useCallback(() => {
    setShowPasswordDialog(false);
    onClose?.();
  }, [setShowPasswordDialog, onClose]);

  const canUseBiometrics = showBiometricOption && hasBiometrics && biometricsEnabled;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: shake ? [0, -10, 10, -10, 10, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
              x: { duration: 0.4 },
            }}
            className={clsx(
              'relative w-full max-w-md mx-4 p-8 rounded-2xl',
              'bg-gray-800/90 backdrop-blur-xl',
              'border border-gray-700/50',
              'shadow-2xl shadow-black/40'
            )}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-600/20 flex items-center justify-center"
              >
                <Lock className="w-8 h-8 text-primary-400" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <p className="text-gray-400 mt-1">{subtitle}</p>
            </div>

            {/* Lockout Warning */}
            {isLockedOut && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-4 p-4 rounded-lg bg-danger-900/30 border border-danger-700/50"
              >
                <div className="flex items-center space-x-2 text-danger-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Too many failed attempts</span>
                </div>
                <p className="text-danger-300 text-sm mt-1">
                  Try again in {formatTimeRemaining(lockoutRemaining)}
                </p>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLockedOut || isLoading}
                    autoComplete="current-password"
                    className={clsx(
                      'w-full px-4 py-3 pr-12 rounded-lg',
                      'bg-gray-700/50 border',
                      'text-white placeholder-gray-500',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                      'transition-colors',
                      error ? 'border-danger-500' : 'border-gray-600/50',
                      isLockedOut && 'opacity-50 cursor-not-allowed'
                    )}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLockedOut}
                    className={clsx(
                      'absolute right-3 top-1/2 -translate-y-1/2',
                      'text-gray-400 hover:text-gray-300 transition-colors',
                      isLockedOut && 'opacity-50'
                    )}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Error Message */}
                <AnimatePresence>
                  {error && !isLockedOut && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-2 text-sm text-danger-400"
                    >
                      {error} ({5 - failedAttempts} attempts remaining)
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Remember Checkbox */}
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={isLockedOut}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500/50"
                />
                <span className="text-sm text-gray-300">Remember for 15 minutes</span>
              </label>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLockedOut || isLoading || !password.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                  'w-full py-3 px-4 rounded-lg font-medium',
                  'bg-primary-600 hover:bg-primary-500',
                  'text-white',
                  'transition-colors',
                  'flex items-center justify-center space-x-2',
                  (isLockedOut || isLoading || !password.trim()) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Unlock</span>
                )}
              </motion.button>
            </form>

            {/* Biometric Option */}
            {canUseBiometrics && (
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <motion.button
                  type="button"
                  onClick={handleBiometricClick}
                  disabled={isLockedOut}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={clsx(
                    'w-full py-3 px-4 rounded-lg',
                    'bg-gray-700/50 hover:bg-gray-700',
                    'border border-gray-600/50',
                    'text-gray-300 hover:text-white',
                    'transition-colors',
                    'flex items-center justify-center space-x-2',
                    isLockedOut && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Fingerprint className="w-5 h-5" />
                  <span>Use Biometrics</span>
                </motion.button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
