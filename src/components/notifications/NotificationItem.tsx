import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Notification,
  NotificationType,
  formatNotificationTime,
  getNotificationTypeColor,
} from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
}

const NOTIFICATION_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  alert: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

/**
 * Single notification item component
 * Shows icon, title, message, timestamp with actions
 */
export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const colors = getNotificationTypeColor(notification.type);
  const Icon = NOTIFICATION_ICONS[notification.type];

  const handleClick = () => {
    // Mark as read
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // Navigate to linked page if available
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(notification.id);
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer',
        'hover:bg-gray-700/50',
        notification.read ? 'opacity-60' : '',
        colors.bg
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Unread indicator dot */}
      {!notification.read && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary-500 rounded-full" />
      )}

      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={cn(
              'text-sm font-medium truncate',
              notification.read ? 'text-gray-400' : 'text-gray-100'
            )}
          >
            {notification.title}
          </h4>
          <span className="flex-shrink-0 text-xs text-gray-500">
            {formatNotificationTime(notification.timestamp)}
          </span>
        </div>

        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{notification.message}</p>

        {/* Link indicator */}
        {notification.link && (
          <div className="mt-2 flex items-center gap-1 text-xs text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-3 h-3" />
            <span>View details</span>
          </div>
        )}
      </div>

      {/* Actions (shown on hover) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <button
            onClick={handleMarkAsRead}
            className="p-1 rounded hover:bg-gray-600 transition-colors"
            title="Mark as read"
            aria-label="Mark as read"
          >
            <CheckCircle className="w-4 h-4 text-gray-400 hover:text-green-400" />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-gray-600 transition-colors"
          title="Dismiss"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}
