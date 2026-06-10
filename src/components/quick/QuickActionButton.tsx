import { forwardRef } from 'react';
import {
  Zap,
  Search,
  RefreshCw,
  Wifi,
  Download,
  ShieldOff,
  XCircle,
  RotateCcw,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickActionDefinition } from '@/hooks/useQuickActions';

// =============================================================================
// Icon Mapping
// =============================================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Zap,
  Search,
  RefreshCw,
  Wifi,
  Download,
  ShieldOff,
  XCircle,
  RotateCcw,
};

// =============================================================================
// QuickActionButton Component
// =============================================================================

export interface QuickActionButtonProps {
  action: QuickActionDefinition;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const QuickActionButton = forwardRef<HTMLButtonElement, QuickActionButtonProps>(
  ({ action, onClick, isLoading = false, disabled = false, className }, ref) => {
    const Icon = ICON_MAP[action.icon] || Zap;

    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled || isLoading}
        className={cn(
          'group relative flex flex-col items-center justify-center gap-2 p-4',
          'rounded-xl border transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900',
          action.dangerous
            ? [
                'border-red-500/30 bg-red-500/10',
                'hover:border-red-500/50 hover:bg-red-500/20',
                'text-red-400 hover:text-red-300',
              ]
            : [
                'border-gray-700 bg-gray-800/50',
                'hover:border-primary-500/50 hover:bg-gray-800',
                'text-gray-300 hover:text-white',
              ],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        title={`${action.description} (${action.shortcutLabel})`}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
            action.dangerous
              ? 'bg-red-500/20 group-hover:bg-red-500/30'
              : 'bg-gray-700/50 group-hover:bg-primary-500/20'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>

        {/* Label */}
        <span className="text-sm font-medium text-center leading-tight">
          {action.label}
        </span>

        {/* Keyboard Shortcut Badge */}
        <span
          className={cn(
            'absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-mono rounded',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            action.dangerous
              ? 'bg-red-500/30 text-red-300'
              : 'bg-gray-700 text-gray-400'
          )}
        >
          {action.shortcutLabel.replace('Ctrl+Shift+', '')}
        </span>

        {/* Danger indicator */}
        {action.dangerous && (
          <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>
    );
  }
);

QuickActionButton.displayName = 'QuickActionButton';

export default QuickActionButton;
