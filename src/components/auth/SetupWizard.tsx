import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Fingerprint,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import { useAuth, calculatePasswordStrength } from '../../hooks/useAuth';
import clsx from 'clsx';
import icon128 from '../../assets/icons/icon-128.png';

export interface SetupWizardProps {
  isOpen: boolean;
  onComplete?: () => void;
}

type WizardStep = 'welcome' | 'password' | 'biometrics' | 'success';

export function SetupWizard({ isOpen, onComplete }: SetupWizardProps) {
  const {
    setupPassword,
    enableBiometrics,
    setShowSetupWizard,
    hasBiometrics,
  } = useAuth();

  const [step, setStep] = useState<WizardStep>('welcome');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollBiometrics, setEnrollBiometrics] = useState(false);

  const passwordStrength = calculatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword;
  const canProceedFromPassword =
    password.length >= 8 &&
    passwordStrength.score >= 50 &&
    passwordsMatch &&
    confirmPassword.length > 0;

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('welcome');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setEnrollBiometrics(false);
    }
  }, [isOpen]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!canProceedFromPassword) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await setupPassword(password);

      if (success) {
        if (hasBiometrics) {
          setStep('biometrics');
        } else {
          setStep('success');
        }
      }
      // Note: setupPassword now throws on failure instead of returning false
    } catch (err) {
      // Show the actual error message from the backend
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Clean up error message for display
      const cleanMessage = errorMessage
        .replace(/^Error:\s*/i, '')
        .replace('Already set up', 'Password has already been configured')
        .replace(/Password does not meet policy requirements:?\s*/i, '');
      setError(cleanMessage || 'An error occurred during setup');
      console.error('Password setup error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [canProceedFromPassword, password, setupPassword, hasBiometrics]);

  const handleBiometricsSubmit = useCallback(async () => {
    if (enrollBiometrics) {
      setIsLoading(true);
      try {
        await enableBiometrics();
      } catch (err) {
        console.error('Biometrics enrollment failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    setStep('success');
  }, [enrollBiometrics, enableBiometrics]);

  const handleComplete = useCallback(() => {
    setShowSetupWizard(false);
    onComplete?.();
  }, [setShowSetupWizard, onComplete]);

  const getStrengthColor = () => {
    switch (passwordStrength.level) {
      case 'weak':
        return 'bg-danger-500';
      case 'fair':
        return 'bg-orange-500';
      case 'good':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
      case 'excellent':
        return 'bg-primary-500';
    }
  };

  const getStrengthTextColor = () => {
    switch (passwordStrength.level) {
      case 'weak':
        return 'text-danger-400';
      case 'fair':
        return 'text-orange-400';
      case 'good':
        return 'text-yellow-400';
      case 'strong':
        return 'text-green-400';
      case 'excellent':
        return 'text-primary-400';
    }
  };

  const stepVariants = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
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
            className="absolute inset-0 bg-black/70 backdrop-blur-lg"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={clsx(
              'relative w-full max-w-lg mx-4 overflow-hidden rounded-2xl',
              'bg-gray-800/95 backdrop-blur-xl',
              'border border-gray-700/50',
              'shadow-2xl shadow-black/50'
            )}
          >
            {/* Progress Indicator */}
            <div className="h-1 bg-gray-700">
              <motion.div
                className="h-full bg-primary-500"
                initial={{ width: '0%' }}
                animate={{
                  width:
                    step === 'welcome'
                      ? '25%'
                      : step === 'password'
                      ? '50%'
                      : step === 'biometrics'
                      ? '75%'
                      : '100%',
                }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                {/* Welcome Step */}
                {step === 'welcome' && (
                  <motion.div
                    key="welcome"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    {/* Logo Animation */}
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                      className="w-24 h-24 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg"
                    >
                      <img src={icon128} alt="Tamandua EDR" className="w-full h-full object-cover" />
                    </motion.div>

                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-3xl font-bold text-white mb-2"
                    >
                      Welcome to Tamandua
                    </motion.h1>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-gray-400 mb-8"
                    >
                      Let's set up your security credentials to protect your EDR dashboard
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-4 text-left bg-gray-700/30 rounded-xl p-6 mb-8"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 rounded-full bg-primary-600/30 flex items-center justify-center mt-0.5">
                          <Check className="w-4 h-4 text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Create a secure password</p>
                          <p className="text-sm text-gray-400">Protect access to sensitive security controls</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 rounded-full bg-primary-600/30 flex items-center justify-center mt-0.5">
                          <Check className="w-4 h-4 text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Optional biometric setup</p>
                          <p className="text-sm text-gray-400">Enable quick unlock with fingerprint or face</p>
                        </div>
                      </div>
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      onClick={() => setStep('password')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={clsx(
                        'w-full py-3 px-4 rounded-lg font-medium',
                        'bg-primary-600 hover:bg-primary-500',
                        'text-white',
                        'transition-colors',
                        'flex items-center justify-center space-x-2'
                      )}
                    >
                      <span>Get Started</span>
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </motion.div>
                )}

                {/* Password Step */}
                {step === 'password' && (
                  <motion.div
                    key="password"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-2xl font-bold text-white mb-2 text-center">
                      Create Your Password
                    </h2>
                    <p className="text-gray-400 mb-6 text-center">
                      Choose a strong password to protect your dashboard
                    </p>

                    <div className="space-y-4">
                      {/* Password Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            className={clsx(
                              'w-full px-4 py-3 pr-12 rounded-lg',
                              'bg-gray-700/50 border border-gray-600/50',
                              'text-white placeholder-gray-500',
                              'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                              'transition-colors'
                            )}
                            placeholder="Enter a secure password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>

                        {/* Strength Meter */}
                        {password.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3"
                          >
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">Strength</span>
                              <span className={getStrengthTextColor()}>
                                {passwordStrength.level.charAt(0).toUpperCase() + passwordStrength.level.slice(1)}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <motion.div
                                className={clsx('h-full rounded-full', getStrengthColor())}
                                initial={{ width: 0 }}
                                animate={{ width: `${passwordStrength.score}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                            {passwordStrength.feedback.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {passwordStrength.feedback.slice(0, 3).map((tip, i) => (
                                  <li key={i} className="text-sm text-gray-400 flex items-center space-x-2">
                                    <span className="w-1 h-1 rounded-full bg-gray-500" />
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* Confirm Password Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            className={clsx(
                              'w-full px-4 py-3 pr-12 rounded-lg',
                              'bg-gray-700/50 border',
                              'text-white placeholder-gray-500',
                              'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                              'transition-colors',
                              confirmPassword.length > 0 && !passwordsMatch
                                ? 'border-danger-500'
                                : confirmPassword.length > 0 && passwordsMatch
                                ? 'border-green-500'
                                : 'border-gray-600/50'
                            )}
                            placeholder="Confirm your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {confirmPassword.length > 0 && !passwordsMatch && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 text-sm text-danger-400"
                          >
                            Passwords do not match
                          </motion.p>
                        )}
                      </div>

                      {/* Error Message */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-3 rounded-lg bg-danger-900/30 border border-danger-700/50"
                        >
                          <p className="text-danger-400 text-sm">{error}</p>
                        </motion.div>
                      )}

                      {/* Actions */}
                      <div className="flex space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setStep('welcome')}
                          className={clsx(
                            'px-4 py-3 rounded-lg',
                            'bg-gray-700/50 hover:bg-gray-700',
                            'text-gray-300 hover:text-white',
                            'transition-colors',
                            'flex items-center space-x-2'
                          )}
                        >
                          <ChevronLeft className="w-5 h-5" />
                          <span>Back</span>
                        </button>
                        <motion.button
                          type="button"
                          onClick={handlePasswordSubmit}
                          disabled={!canProceedFromPassword || isLoading}
                          whileHover={canProceedFromPassword ? { scale: 1.02 } : {}}
                          whileTap={canProceedFromPassword ? { scale: 0.98 } : {}}
                          className={clsx(
                            'flex-1 py-3 px-4 rounded-lg font-medium',
                            'bg-primary-600 hover:bg-primary-500',
                            'text-white',
                            'transition-colors',
                            'flex items-center justify-center space-x-2',
                            (!canProceedFromPassword || isLoading) && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Setting up...</span>
                            </>
                          ) : (
                            <>
                              <span>Continue</span>
                              <ChevronRight className="w-5 h-5" />
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Biometrics Step */}
                {step === 'biometrics' && (
                  <motion.div
                    key="biometrics"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-600/20 border-2 border-primary-500/50 flex items-center justify-center"
                    >
                      <Fingerprint className="w-10 h-10 text-primary-400" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                      Enable Biometrics?
                    </h2>
                    <p className="text-gray-400 mb-8">
                      Use your fingerprint or face to quickly unlock the dashboard
                    </p>

                    <label className="flex items-center justify-center space-x-3 cursor-pointer mb-8">
                      <motion.div
                        className={clsx(
                          'w-12 h-7 rounded-full relative transition-colors',
                          enrollBiometrics ? 'bg-primary-600' : 'bg-gray-600'
                        )}
                        onClick={() => setEnrollBiometrics(!enrollBiometrics)}
                      >
                        <motion.div
                          className="absolute w-5 h-5 rounded-full bg-white top-1 shadow-md"
                          animate={{ left: enrollBiometrics ? '26px' : '4px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </motion.div>
                      <span className="text-gray-300">
                        {enrollBiometrics ? 'Enabled' : 'Skip for now'}
                      </span>
                    </label>

                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => setStep('password')}
                        className={clsx(
                          'px-4 py-3 rounded-lg',
                          'bg-gray-700/50 hover:bg-gray-700',
                          'text-gray-300 hover:text-white',
                          'transition-colors',
                          'flex items-center space-x-2'
                        )}
                      >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Back</span>
                      </button>
                      <motion.button
                        type="button"
                        onClick={handleBiometricsSubmit}
                        disabled={isLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={clsx(
                          'flex-1 py-3 px-4 rounded-lg font-medium',
                          'bg-primary-600 hover:bg-primary-500',
                          'text-white',
                          'transition-colors',
                          'flex items-center justify-center space-x-2',
                          isLoading && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Enrolling...</span>
                          </>
                        ) : (
                          <>
                            <span>Continue</span>
                            <ChevronRight className="w-5 h-5" />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Success Step */}
                {step === 'success' && (
                  <motion.div
                    key="success"
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-24 h-24 mx-auto mb-6"
                    >
                      <motion.div
                        className="w-full h-full rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center"
                        animate={{
                          scale: [1, 1.1, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(34, 197, 94, 0)',
                            '0 0 0 15px rgba(34, 197, 94, 0.2)',
                            '0 0 0 0 rgba(34, 197, 94, 0)',
                          ],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: 2,
                          ease: 'easeInOut',
                        }}
                      >
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.2, type: 'spring' }}
                        >
                          <PartyPopper className="w-12 h-12 text-green-400" />
                        </motion.div>
                      </motion.div>
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-2xl font-bold text-white mb-2"
                    >
                      All Set!
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-gray-400 mb-8"
                    >
                      Your security settings are configured. You can change them anytime in Settings.
                    </motion.p>

                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      onClick={handleComplete}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={clsx(
                        'w-full py-3 px-4 rounded-lg font-medium',
                        'bg-primary-600 hover:bg-primary-500',
                        'text-white',
                        'transition-colors'
                      )}
                    >
                      Open Dashboard
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
