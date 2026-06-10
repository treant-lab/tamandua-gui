import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, ScanFace, KeyRound, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import clsx from 'clsx';

export interface BiometricPromptProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  onFallbackToPassword?: () => void;
}

type BiometricType = 'fingerprint' | 'face' | 'unknown';

export function BiometricPrompt({
  isOpen,
  onClose,
  onSuccess,
  onFallbackToPassword,
}: BiometricPromptProps) {
  const {
    authenticateWithBiometrics,
    setShowBiometricPrompt,
    setShowPasswordDialog,
  } = useAuth();

  const [status, setStatus] = useState<'waiting' | 'scanning' | 'success' | 'error'>('waiting');
  const [biometricType, setBiometricType] = useState<BiometricType>('fingerprint');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect platform and biometric type
  useEffect(() => {
    if (isOpen) {
      detectBiometricType();
      // Auto-start scanning when opened
      setTimeout(() => startScan(), 300);
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStatus('waiting');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const detectBiometricType = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad')) {
      setBiometricType('face'); // Face ID common on Apple devices
    } else if (platform.includes('win')) {
      setBiometricType('fingerprint'); // Windows Hello fingerprint common
    } else {
      setBiometricType('fingerprint'); // Default to fingerprint
    }
  };

  const startScan = useCallback(async () => {
    setStatus('scanning');
    setErrorMessage(null);

    try {
      const success = await authenticateWithBiometrics();

      if (success) {
        setStatus('success');
        setTimeout(() => {
          setShowBiometricPrompt(false);
          onSuccess?.();
        }, 800);
      } else {
        setStatus('error');
        setErrorMessage('Biometric verification failed');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Biometric scan was cancelled or failed');
    }
  }, [authenticateWithBiometrics, setShowBiometricPrompt, onSuccess]);

  const handleFallbackToPassword = useCallback(() => {
    setShowBiometricPrompt(false);
    setShowPasswordDialog(true);
    onFallbackToPassword?.();
  }, [setShowBiometricPrompt, setShowPasswordDialog, onFallbackToPassword]);

  const handleClose = useCallback(() => {
    setShowBiometricPrompt(false);
    onClose?.();
  }, [setShowBiometricPrompt, onClose]);

  const handleRetry = useCallback(() => {
    startScan();
  }, [startScan]);

  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;

  const getPlatformMessage = () => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
      return biometricType === 'face' ? 'Look at your camera for Face ID' : 'Touch the Touch ID sensor';
    } else if (platform.includes('win')) {
      return 'Use Windows Hello to authenticate';
    } else if (platform.includes('linux')) {
      return 'Authenticate with your fingerprint';
    }
    return 'Use biometrics to authenticate';
  };

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
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={clsx(
              'relative w-full max-w-md mx-4 p-8 rounded-2xl',
              'bg-gray-800/90 backdrop-blur-xl',
              'border border-gray-700/50',
              'shadow-2xl shadow-black/40'
            )}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">Biometric Authentication</h2>
              <p className="text-gray-400 mt-1">{getPlatformMessage()}</p>
            </div>

            {/* Biometric Icon Animation */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                {/* Outer ring animation */}
                <motion.div
                  className={clsx(
                    'absolute inset-0 rounded-full',
                    status === 'scanning' && 'bg-primary-500/20',
                    status === 'success' && 'bg-green-500/20',
                    status === 'error' && 'bg-danger-500/20'
                  )}
                  animate={
                    status === 'scanning'
                      ? {
                          scale: [1, 1.5, 1],
                          opacity: [0.5, 0, 0.5],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1.5,
                    repeat: status === 'scanning' ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
                  style={{ width: 120, height: 120 }}
                />

                {/* Inner ring animation */}
                <motion.div
                  className={clsx(
                    'absolute inset-0 rounded-full',
                    status === 'scanning' && 'border-2 border-primary-500/50',
                    status === 'success' && 'border-2 border-green-500/50',
                    status === 'error' && 'border-2 border-danger-500/50'
                  )}
                  animate={
                    status === 'scanning'
                      ? {
                          scale: [1, 1.3, 1],
                          opacity: [1, 0.3, 1],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1.5,
                    repeat: status === 'scanning' ? Infinity : 0,
                    ease: 'easeInOut',
                    delay: 0.2,
                  }}
                  style={{ width: 120, height: 120 }}
                />

                {/* Icon container */}
                <motion.div
                  className={clsx(
                    'w-[120px] h-[120px] rounded-full flex items-center justify-center',
                    'border-2 transition-colors duration-300',
                    status === 'waiting' && 'bg-gray-700/50 border-gray-600',
                    status === 'scanning' && 'bg-primary-600/20 border-primary-500',
                    status === 'success' && 'bg-green-600/20 border-green-500',
                    status === 'error' && 'bg-danger-600/20 border-danger-500'
                  )}
                  animate={
                    status === 'success'
                      ? { scale: [1, 1.1, 1] }
                      : status === 'error'
                      ? { x: [0, -10, 10, -10, 10, 0] }
                      : {}
                  }
                  transition={{
                    duration: status === 'error' ? 0.5 : 0.3,
                  }}
                >
                  {status === 'scanning' ? (
                    <Loader2
                      className={clsx(
                        'w-14 h-14 animate-spin',
                        'text-primary-400'
                      )}
                    />
                  ) : status === 'success' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <BiometricIcon className="w-14 h-14 text-green-400" />
                    </motion.div>
                  ) : status === 'error' ? (
                    <XCircle className="w-14 h-14 text-danger-400" />
                  ) : (
                    <BiometricIcon
                      className={clsx(
                        'w-14 h-14 text-gray-400'
                      )}
                    />
                  )}
                </motion.div>
              </div>
            </div>

            {/* Status Message */}
            <div className="text-center mb-6">
              {status === 'waiting' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-400"
                >
                  Preparing biometric scan...
                </motion.p>
              )}
              {status === 'scanning' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-primary-400"
                >
                  {biometricType === 'face' ? 'Looking for your face...' : 'Place your finger on the sensor'}
                </motion.p>
              )}
              {status === 'success' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-green-400"
                >
                  Authentication successful!
                </motion.p>
              )}
              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-danger-400">{errorMessage}</p>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {status === 'error' && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  type="button"
                  onClick={handleRetry}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={clsx(
                    'w-full py-3 px-4 rounded-lg font-medium',
                    'bg-primary-600 hover:bg-primary-500',
                    'text-white',
                    'transition-colors'
                  )}
                >
                  Try Again
                </motion.button>
              )}

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                type="button"
                onClick={handleFallbackToPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                  'w-full py-3 px-4 rounded-lg',
                  'bg-gray-700/50 hover:bg-gray-700',
                  'border border-gray-600/50',
                  'text-gray-300 hover:text-white',
                  'transition-colors',
                  'flex items-center justify-center space-x-2'
                )}
              >
                <KeyRound className="w-5 h-5" />
                <span>Use Password Instead</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
