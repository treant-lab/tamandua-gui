import { Bell, CheckCheck, Settings, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Notification,
  GroupedNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';

interface NotificationListProps {
  notifications: Notification[];
  groupedNotifications: GroupedNotifications;
  isLoading?: boolean;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

/**
 * List of notifications grouped by date
 * Includes header with actions and empty state
 */
export function NotificationList({
  notifications,
  groupedNotifications,
  isLoading,
  onClose,
  onOpenSettings,
}: NotificationListProps) {
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const hasUnread = notifications.some((n) => !n.read);
  const isEmpty = notifications.length === 0;

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteNotification.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate(notifications.map((notification) => notification.id));
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] min-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-100">Notifications</h3>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
              className="text-xs text-gray-400 hover:text-gray-100"
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4 mr-1" />
              )}
              Mark all read
            </Button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded hover:bg-gray-700 transition-colors"
              title="Notification settings"
              aria-label="Notification settings"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="p-2 space-y-4">
            {/* Today */}
            {groupedNotifications.today.length > 0 && (
              <NotificationGroup
                title="Today"
                notifications={groupedNotifications.today}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onClose={onClose}
              />
            )}

            {/* Yesterday */}
            {groupedNotifications.yesterday.length > 0 && (
              <NotificationGroup
                title="Yesterday"
                notifications={groupedNotifications.yesterday}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onClose={onClose}
              />
            )}

            {/* Earlier */}
            {groupedNotifications.earlier.length > 0 && (
              <NotificationGroup
                title="Earlier"
                notifications={groupedNotifications.earlier}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onClose={onClose}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="px-4 py-2 border-t border-gray-700">
          <p className="text-xs text-center text-gray-500">
            {notifications.filter((n) => !n.read).length} unread of {notifications.length} total
          </p>
        </div>
      )}
    </div>
  );
}

interface NotificationGroupProps {
  title: string;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

function NotificationGroup({
  title,
  notifications,
  onMarkAsRead,
  onDelete,
  onClose,
}: NotificationGroupProps) {
  return (
    <div>
      <h4 className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-1">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-4">
        <Bell className="w-6 h-6 text-gray-500" />
      </div>
      <h4 className="text-sm font-medium text-gray-300 mb-1">No notifications</h4>
      <p className="text-xs text-gray-500 text-center">
        You're all caught up! New alerts and updates will appear here.
      </p>
    </div>
  );
}
