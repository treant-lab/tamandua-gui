import { useAuthContext } from '../context/AuthContext';

/**
 * Custom hook for authentication operations.
 * Provides a simplified API for common auth tasks.
 */
export function useAuth() {
  const context = useAuthContext();

  return {
    // State
    isAuthenticated: context.isAuthenticated,
    isSetupComplete: context.isSetupComplete,
    sessionTimeRemaining: context.sessionTimeRemaining,
    hasBiometrics: context.hasBiometrics,
    biometricsEnabled: context.biometricsEnabled,
    isLockedOut: context.isLockedOut,
    lockoutEndTime: context.lockoutEndTime,
    failedAttempts: context.failedAttempts,
    sessionTimeout: context.sessionTimeout,

    // Actions
    requireAuth: context.requireAuth,
    authenticate: context.authenticate,
    authenticateWithBiometrics: context.authenticateWithBiometrics,
    setupPassword: context.setupPassword,
    changePassword: context.changePassword,
    enableBiometrics: context.enableBiometrics,
    disableBiometrics: context.disableBiometrics,
    lock: context.lock,
    extendSession: context.extendSession,
    setSessionTimeout: context.setSessionTimeout,

    // UI State
    showPasswordDialog: context.showPasswordDialog,
    setShowPasswordDialog: context.setShowPasswordDialog,
    showSetupWizard: context.showSetupWizard,
    setShowSetupWizard: context.setShowSetupWizard,
    showBiometricPrompt: context.showBiometricPrompt,
    setShowBiometricPrompt: context.setShowBiometricPrompt,

    // Audit
    auditLog: context.auditLog,
    clearAuditLog: context.clearAuditLog,
  };
}

/**
 * Hook to protect critical actions with authentication.
 * Returns a wrapper function that requires auth before executing.
 */
export function useProtectedAction<T extends (...args: any[]) => Promise<any>>(
  action: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | null> {
  const { requireAuth } = useAuth();

  return async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
    const isAuthed = await requireAuth();
    if (!isAuthed) {
      return null;
    }
    return action(...args);
  };
}

/**
 * Calculate password strength score (0-100)
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
  level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return { score: 0, feedback: ['Password is required'], level: 'weak' };
  }

  // Length score
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  else if (password.length < 8) feedback.push('At least 8 characters');

  // Character type checks
  if (/[a-z]/.test(password)) score += 10;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 15;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score += 15;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 20;
  else feedback.push('Add special characters');

  // Bonus for variety
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= 10) score += 5;
  if (uniqueChars >= 15) score += 5;

  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Avoid repeated characters');
  }

  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 5;
    feedback.push('Mix letters with numbers/symbols');
  }

  if (/^[0-9]+$/.test(password)) {
    score -= 15;
    feedback.push('Don\'t use only numbers');
  }

  // Common password patterns
  const commonPatterns = [
    'password', '123456', 'qwerty', 'letmein', 'admin',
    'welcome', 'monkey', 'dragon', 'master', 'abc123'
  ];
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    score -= 20;
    feedback.push('Avoid common password patterns');
  }

  // Normalize score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  if (score < 25) level = 'weak';
  else if (score < 50) level = 'fair';
  else if (score < 70) level = 'good';
  else if (score < 90) level = 'strong';
  else level = 'excellent';

  return { score, feedback, level };
}

/**
 * Format remaining time as mm:ss
 */
export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
