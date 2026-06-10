import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Clock, AlertTriangle } from 'lucide-react';
import { useAuth, formatTimeRemaining } from '../../hooks/useAuth';
import clsx from 'clsx';

export interface SessionIndicatorProps {
  className?: string;
  showTimer?: boolean;
  compact?: boolean;
}

export function SessionIndicator({
  className,
  showTimer = true,
  compact = false,
}: SessionIndicatorProps) {
  const {
    isAuthenticated,
    sessionTimeRemaining,
    lock,
    extendSession,
    sessionTimeout,
  } = useAuth();

  // Calculate warning threshold (20% of session time)
  const warningThreshold = useMemo(
    () => Math.floor(sessionTimeout * 60 * 0.2),
    [sessionTimeout]
  );

  const isWarning = sessionTimeRemaining > 0 && sessionTimeRemaining <= warningThreshold;
  const isCritical = sessionTimeRemaining > 0 && sessionTimeRemaining <= 60;

  const handleLockClick = () => {
    if (isAuthenticated) {
      lock();
    }
  };

  const handleExtendClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    extendSession();
  };

  // Compact version for small spaces
  if (compact) {
    return (
      <motion.button
        onClick={handleLockClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={clsx(
          'flex items-center space-x-1 px-2 py-1.5 rounded-lg',
          'transition-colors cursor-pointer',
          isAuthenticated
            ? isCritical
              ? 'bg-danger-900/30 text-danger-400'
              : isWarning
              ? 'bg-orange-900/30 text-orange-400'
              : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700',
          className
        )}
        title={isAuthenticated ? 'Click to lock' : 'Locked'}
      >
        <motion.div
          animate={isCritical ? { rotate: [0, -10, 10, 0] } : {}}
          transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
        >
          {isAuthenticated ? (
            <Unlock className="w-4 h-4" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
        </motion.div>
        {showTimer && isAuthenticated && (
          <span className="text-xs font-mono">
            {formatTimeRemaining(sessionTimeRemaining)}
          </span>
        )}
      </motion.button>
    );
  }

  // Full version
  return (
    <div className={clsx('relative', className)}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={clsx(
          'flex items-center space-x-3 px-4 py-2.5 rounded-xl',
          'border transition-all duration-300 cursor-pointer',
          isAuthenticated
            ? isCritical
              ? 'bg-danger-900/20 border-danger-700/50 hover:bg-danger-900/30'
              : isWarning
              ? 'bg-orange-900/20 border-orange-700/50 hover:bg-orange-900/30'
              : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
            : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
        )}
        onClick={handleLockClick}
      >
        {/* Lock Icon */}
        <motion.div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            isAuthenticated
              ? isCritical
                ? 'bg-danger-600/30'
                : isWarning
                ? 'bg-orange-600/30'
                : 'bg-green-600/30'
              : 'bg-gray-700'
          )}
          animate={
            isCritical
              ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, 0],
                }
              : {}
          }
          transition={{
            duration: 0.5,
            repeat: isCritical ? Infinity : 0,
          }}
        >
          {isAuthenticated ? (
            <Unlock
              className={clsx(
                'w-5 h-5',
                isCritical
                  ? 'text-danger-400'
                  : isWarning
                  ? 'text-orange-400'
                  : 'text-green-400'
              )}
            />
          ) : (
            <Lock className="w-5 h-5 text-gray-400" />
          )}
        </motion.div>

        {/* Status Text */}
        <div className="flex-1 min-w-0">
          <p
            className={clsx(
              'text-sm font-medium',
              isAuthenticated
                ? isCritical
                  ? 'text-danger-300'
                  : isWarning
                  ? 'text-orange-300'
                  : 'text-gray-200'
                : 'text-gray-300'
            )}
          >
            {isAuthenticated ? 'Session Active' : 'Locked'}
          </p>
          {isAuthenticated && showTimer && (
            <div className="flex items-center space-x-1">
              <Clock
                className={clsx(
                  'w-3 h-3',
                  isCritical
                    ? 'text-danger-400'
                    : isWarning
                    ? 'text-orange-400'
                    : 'text-gray-500'
                )}
              />
              <span
                className={clsx(
                  'text-xs font-mono',
                  isCritical
                    ? 'text-danger-400'
                    : isWarning
                    ? 'text-orange-400'
                    : 'text-gray-500'
                )}
              >
                {formatTimeRemaining(sessionTimeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Extend Session Button */}
        <AnimatePresence>
          {isAuthenticated && isWarning && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleExtendClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium',
                'transition-colors',
                isCritical
                  ? 'bg-danger-600 hover:bg-danger-500 text-white'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              )}
            >
              Extend
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Warning Tooltip */}
      <AnimatePresence>
        {isCritical && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={clsx(
              'absolute top-full left-0 right-0 mt-2 p-3 rounded-lg',
              'bg-danger-900/90 backdrop-blur-sm border border-danger-700/50',
              'text-danger-200 text-sm',
              'flex items-center space-x-2'
            )}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Session expiring soon. Click "Extend" to continue working.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
