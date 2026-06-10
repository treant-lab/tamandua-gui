import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

// Types
export interface AuthAuditLogEntry {
  id: string;
  action: 'login' | 'logout' | 'failed_attempt' | 'password_changed' | 'biometric_enrolled' | 'lockout';
  timestamp: Date;
  details?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isSetupComplete: boolean;
  hasBiometrics: boolean;
  biometricsEnabled: boolean;
  sessionTimeRemaining: number;
  failedAttempts: number;
  isLockedOut: boolean;
  lockoutEndTime: Date | null;
  auditLog: AuthAuditLogEntry[];
  sessionTimeout: number; // in minutes
}

export interface AuthContextValue extends AuthState {
  requireAuth: () => Promise<boolean>;
  authenticate: (password: string, remember?: boolean) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<boolean>;
  setupPassword: (password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  lock: () => void;
  extendSession: () => void;
  setSessionTimeout: (minutes: number) => void;
  clearAuditLog: () => void;
  showPasswordDialog: boolean;
  setShowPasswordDialog: (show: boolean) => void;
  showSetupWizard: boolean;
  setShowSetupWizard: (show: boolean) => void;
  showBiometricPrompt: boolean;
  setShowBiometricPrompt: (show: boolean) => void;
}

const DEFAULT_SESSION_TIMEOUT = 15; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isSetupComplete: false,
    hasBiometrics: false,
    biometricsEnabled: false,
    sessionTimeRemaining: 0,
    failedAttempts: 0,
    isLockedOut: false,
    lockoutEndTime: null,
    auditLog: [],
    sessionTimeout: DEFAULT_SESSION_TIMEOUT,
  });

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null);

  // Check initial state on mount
  useEffect(() => {
    checkInitialState();
  }, []);

  // Session countdown timer
  useEffect(() => {
    if (!state.isAuthenticated || !sessionEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((sessionEndTime.getTime() - Date.now()) / 1000));

      if (remaining === 0) {
        lock();
      } else {
        setState(prev => ({ ...prev, sessionTimeRemaining: remaining }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, sessionEndTime]);

  // Lockout timer
  useEffect(() => {
    if (!state.isLockedOut || !state.lockoutEndTime) return;

    const timeout = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isLockedOut: false,
        lockoutEndTime: null,
        failedAttempts: 0,
      }));
    }, state.lockoutEndTime.getTime() - Date.now());

    return () => clearTimeout(timeout);
  }, [state.isLockedOut, state.lockoutEndTime]);

  const checkInitialState = async () => {
    try {
      // Check if password has been set up
      // SetupStatus is a Rust enum: "NotConfigured" | "Configured" | { Locked: { unlock_at: string } }
      const setupStatus = await invoke<string | { Locked?: { unlock_at: string } }>('get_auth_status').catch(() => 'NotConfigured');
      console.log('[AuthContext] setupStatus received:', setupStatus, typeof setupStatus);
      // Handle both string enum variants and object variants
      const isSetupComplete = setupStatus === 'Configured' ||
        (typeof setupStatus === 'object' && 'Locked' in setupStatus);
      console.log('[AuthContext] isSetupComplete:', isSetupComplete);

      // Check if biometrics are available on this device
      const biometricCapability = await invoke<{ available: boolean; enrolled: boolean }>('check_biometric_available').catch(() => ({ available: false, enrolled: false }));
      const hasBiometrics = biometricCapability.available;

      // Check if biometrics are enabled for this user (from localStorage since no backend endpoint)
      const storedBiometricsEnabled = localStorage.getItem('biometrics_enabled');
      const biometricsEnabled = storedBiometricsEnabled === 'true';

      // Load saved session timeout preference
      const savedTimeout = localStorage.getItem('auth_session_timeout');
      const sessionTimeout = savedTimeout ? parseInt(savedTimeout, 10) : DEFAULT_SESSION_TIMEOUT;

      // Load audit log
      const auditLog = await invoke<AuthAuditLogEntry[]>('get_auth_audit_log', { limit: 100 }).catch(() => []);

      setState(prev => ({
        ...prev,
        isSetupComplete,
        hasBiometrics,
        biometricsEnabled,
        sessionTimeout,
        auditLog,
      }));

      // Show setup wizard if not configured
      console.log('[AuthContext] Will show setup wizard:', !isSetupComplete);
      if (!isSetupComplete) {
        console.log('[AuthContext] SHOWING SETUP WIZARD');
        setShowSetupWizard(true);
      } else {
        console.log('[AuthContext] Auth is configured, NOT showing wizard');
      }
    } catch (error) {
      console.error('Failed to check auth state:', error);
    }
  };

  const addAuditEntry = useCallback((action: AuthAuditLogEntry['action'], details?: string) => {
    const entry: AuthAuditLogEntry = {
      id: crypto.randomUUID(),
      action,
      timestamp: new Date(),
      details,
    };

    setState(prev => ({
      ...prev,
      auditLog: [entry, ...prev.auditLog].slice(0, 100), // Keep last 100 entries
    }));

    // Persist to localStorage (backend doesn't have this endpoint)
    const storedLog = localStorage.getItem('auth_audit_log');
    const log = storedLog ? JSON.parse(storedLog) : [];
    log.unshift(entry);
    localStorage.setItem('auth_audit_log', JSON.stringify(log.slice(0, 100)));
  }, []);

  const startSession = useCallback(() => {
    const endTime = new Date(Date.now() + state.sessionTimeout * 60 * 1000);
    setSessionEndTime(endTime);
    setState(prev => ({
      ...prev,
      isAuthenticated: true,
      sessionTimeRemaining: state.sessionTimeout * 60,
      failedAttempts: 0,
    }));
  }, [state.sessionTimeout]);

  const lock = useCallback(() => {
    setSessionEndTime(null);
    setState(prev => ({
      ...prev,
      isAuthenticated: false,
      sessionTimeRemaining: 0,
    }));
    addAuditEntry('logout');
  }, [addAuditEntry]);

  const authenticate = useCallback(async (password: string, remember = false): Promise<boolean> => {
    if (state.isLockedOut) {
      return false;
    }

    try {
      // verify_password returns a Session on success, throws on failure
      const session = await invoke<{ token: string }>('verify_password', { password });
      const isValid = !!session?.token;

      if (isValid) {
        startSession();
        setShowPasswordDialog(false);
        addAuditEntry('login', 'Password authentication');

        if (remember) {
          // Extend session timeout for "remember" option
          const extendedEndTime = new Date(Date.now() + 15 * 60 * 1000);
          setSessionEndTime(extendedEndTime);
        }

        return true;
      } else {
        const newFailedAttempts = state.failedAttempts + 1;

        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockoutEndTime = new Date(Date.now() + LOCKOUT_DURATION);
          setState(prev => ({
            ...prev,
            failedAttempts: newFailedAttempts,
            isLockedOut: true,
            lockoutEndTime,
          }));
          addAuditEntry('lockout', `${MAX_FAILED_ATTEMPTS} failed attempts`);
        } else {
          setState(prev => ({
            ...prev,
            failedAttempts: newFailedAttempts,
          }));
          addAuditEntry('failed_attempt', `Attempt ${newFailedAttempts} of ${MAX_FAILED_ATTEMPTS}`);
        }

        return false;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }, [state.isLockedOut, state.failedAttempts, startSession, addAuditEntry]);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!state.hasBiometrics || !state.biometricsEnabled) {
      return false;
    }

    try {
      // authenticate_biometric returns a Session on success
      const session = await invoke<{ token: string }>('authenticate_biometric', { reason: 'Unlock Tamandua EDR' });
      const isValid = !!session?.token;

      if (isValid) {
        startSession();
        setShowBiometricPrompt(false);
        setShowPasswordDialog(false);
        addAuditEntry('login', 'Biometric authentication');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }, [state.hasBiometrics, state.biometricsEnabled, startSession, addAuditEntry]);

  const requireAuth = useCallback(async (): Promise<boolean> => {
    if (state.isAuthenticated) {
      return true;
    }

    // If biometrics are enabled, try that first
    if (state.biometricsEnabled && state.hasBiometrics) {
      setShowBiometricPrompt(true);
    } else {
      setShowPasswordDialog(true);
    }

    // Return a promise that resolves when auth completes
    return new Promise((resolve) => {
      const checkAuth = setInterval(() => {
        // Check current state
        if (!showPasswordDialog && !showBiometricPrompt) {
          clearInterval(checkAuth);
          resolve(state.isAuthenticated);
        }
      }, 100);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkAuth);
        resolve(false);
      }, 5 * 60 * 1000);
    });
  }, [state.isAuthenticated, state.biometricsEnabled, state.hasBiometrics, showPasswordDialog, showBiometricPrompt]);

  const setupPassword = useCallback(async (password: string): Promise<boolean> => {
    // Retry logic for IPC connection issues
    const maxRetries = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Calling setup_password (attempt ${attempt}/${maxRetries})...`);
        await invoke('setup_password', { password });
        console.log('setup_password succeeded!');
        setState(prev => ({ ...prev, isSetupComplete: true }));
        addAuditEntry('password_changed', 'Initial password setup');
        startSession();
        // Note: setShowSetupWizard(false) is called by the wizard on completion
        return true;
      } catch (error) {
        console.error(`Password setup attempt ${attempt} failed:`, error);
        lastError = error;

        // Don't retry for specific errors that won't resolve with retries
        const errorStr = String(error);
        if (errorStr.includes('Already set up') ||
            errorStr.includes('policy') ||
            errorStr.includes('Password does not meet')) {
          console.error('Non-retryable error, stopping:', errorStr);
          throw new Error(errorStr);
        }

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    console.error('Password setup failed after all retries:', lastError);
    // Throw the actual error so the UI can display it
    throw new Error(String(lastError) || 'Failed to set up password');
  }, [startSession, addAuditEntry]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      // change_password returns () on success, throws on failure
      await invoke('change_password', { current_password: currentPassword, new_password: newPassword });
      addAuditEntry('password_changed');
      return true;
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    }
  }, [addAuditEntry]);

  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      // No backend endpoint for this - store in localStorage
      localStorage.setItem('biometrics_enabled', 'true');
      setState(prev => ({ ...prev, biometricsEnabled: true }));
      addAuditEntry('biometric_enrolled');
      return true;
    } catch (error) {
      console.error('Biometric enrollment error:', error);
      return false;
    }
  }, [addAuditEntry]);

  const disableBiometrics = useCallback(async (): Promise<void> => {
    try {
      // No backend endpoint for this - store in localStorage
      localStorage.setItem('biometrics_enabled', 'false');
      setState(prev => ({ ...prev, biometricsEnabled: false }));
    } catch (error) {
      console.error('Biometric disable error:', error);
    }
  }, []);

  const extendSession = useCallback(() => {
    if (state.isAuthenticated) {
      const endTime = new Date(Date.now() + state.sessionTimeout * 60 * 1000);
      setSessionEndTime(endTime);
      setState(prev => ({
        ...prev,
        sessionTimeRemaining: state.sessionTimeout * 60,
      }));
    }
  }, [state.isAuthenticated, state.sessionTimeout]);

  const setSessionTimeout = useCallback((minutes: number) => {
    setState(prev => ({ ...prev, sessionTimeout: minutes }));
    localStorage.setItem('auth_session_timeout', minutes.toString());
  }, []);

  const clearAuditLog = useCallback(() => {
    setState(prev => ({ ...prev, auditLog: [] }));
    // No backend endpoint for this - clear localStorage
    localStorage.removeItem('auth_audit_log');
  }, []);

  const value: AuthContextValue = {
    ...state,
    requireAuth,
    authenticate,
    authenticateWithBiometrics,
    setupPassword,
    changePassword,
    enableBiometrics,
    disableBiometrics,
    lock,
    extendSession,
    setSessionTimeout,
    clearAuditLog,
    showPasswordDialog,
    setShowPasswordDialog,
    showSetupWizard,
    setShowSetupWizard,
    showBiometricPrompt,
    setShowBiometricPrompt,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
