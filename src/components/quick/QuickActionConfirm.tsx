import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickActionDefinition } from '@/hooks/useQuickActions';

// =============================================================================
// QuickActionConfirm Component
// =============================================================================

export interface QuickActionConfirmProps {
  action: QuickActionDefinition;
  onConfirm: (params?: { pid?: number }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  pidValue?: string;
  onPidChange?: (value: string) => void;
}

export function QuickActionConfirm({
  action,
  onConfirm,
  onCancel,
  isLoading = false,
  pidValue = '',
  onPidChange,
}: QuickActionConfirmProps) {
  const [localPid, setLocalPid] = useState(pidValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens (for PID input)
  useEffect(() => {
    if (action.requiresInput === 'pid' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [action.requiresInput]);

  const handlePidChange = (value: string) => {
    setLocalPid(value);
    onPidChange?.(value);
  };

  const handleConfirm = () => {
    if (action.requiresInput === 'pid') {
      const pid = parseInt(localPid, 10);
      if (isNaN(pid) || pid <= 0) {
        return; // Invalid PID
      }
      onConfirm({ pid });
    } else {
      onConfirm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleConfirm();
    }
  };

  const isConfirmDisabled =
    isLoading || (action.requiresInput === 'pid' && (!localPid || parseInt(localPid, 10) <= 0));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative bg-gray-800 border rounded-xl shadow-2xl max-w-md w-full mx-4',
          'animate-in zoom-in-95 fade-in duration-150',
          action.dangerous ? 'border-red-500/50' : 'border-gray-700'
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center mb-4',
              action.dangerous ? 'text-red-400 bg-red-500/20' : 'text-amber-400 bg-amber-500/20'
            )}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-white mb-2">
            {action.requiresInput === 'pid' ? 'Enter Process ID' : 'Confirm Action'}
          </h2>

          {/* Description */}
          <p className="text-gray-400 mb-4">{action.description}</p>

          {/* Warning message for dangerous actions */}
          {action.dangerous && (
            <div
              className={cn(
                'mb-4 p-3 rounded-lg text-sm',
                'bg-red-500/10 border border-red-500/30 text-red-300'
              )}
            >
              {action.id === 'network_isolate' && (
                <>
                  <strong>Warning:</strong> This will block all network traffic except
                  communication with the Tamandua backend. You may need physical access to
                  restore connectivity.
                </>
              )}
              {action.id === 'restart_agent' && (
                <>
                  <strong>Warning:</strong> The agent will temporarily stop monitoring
                  during restart. This typically takes 5-10 seconds.
                </>
              )}
              {action.id === 'kill_process' && (
                <>
                  <strong>Warning:</strong> Terminating a process may cause data loss or
                  system instability. Ensure you have the correct PID.
                </>
              )}
            </div>
          )}

          {/* PID Input */}
          {action.requiresInput === 'pid' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Process ID (PID)
              </label>
              <input
                ref={inputRef}
                type="number"
                min="1"
                value={localPid}
                onChange={(e) => handlePidChange(e.target.value)}
                placeholder="Enter PID..."
                disabled={isLoading}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-500',
                  'bg-gray-900 border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  action.dangerous
                    ? 'border-red-500/30 focus:border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:border-primary-500 focus:ring-primary-500/50'
                )}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Find the PID in the Processes page or use Task Manager
              </p>
            </div>
          )}

          {/* Action label reminder */}
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <span>Action:</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded font-medium',
                action.dangerous ? 'bg-red-500/20 text-red-300' : 'bg-gray-700 text-gray-200'
              )}
            >
              {action.label}
            </span>
            <span className="text-gray-500">({action.shortcutLabel})</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'bg-gray-700 hover:bg-gray-600 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'flex items-center gap-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                action.dangerous
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-primary-600 hover:bg-primary-500 text-white'
              )}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {action.requiresInput === 'pid' ? 'Kill Process' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickActionConfirm;
