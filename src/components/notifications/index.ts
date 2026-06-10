// Notification Center Components
export { NotificationCenter } from './NotificationCenter';
export { NotificationList } from './NotificationList';
export { NotificationItem } from './NotificationItem';
export { NotificationBadge } from './NotificationBadge';

// Re-export types and hooks for convenience
export {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useNotificationSubscription,
  useNotificationPreferences,
  useClearAllNotifications,
  useRequestNotificationPermission,
  formatNotificationTime,
  groupNotificationsByDate,
  getNotificationTypeColor,
} from '@/hooks/useNotifications';

export type {
  Notification,
  NotificationType,
  NotificationPreferences,
  GroupedNotifications,
} from '@/hooks/useNotifications';
