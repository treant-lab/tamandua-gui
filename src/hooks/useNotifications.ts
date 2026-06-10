import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import { useEventListener } from './useTauri';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'alert' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string; // Route to navigate to when clicked
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  showAlerts: boolean;
  showWarnings: boolean;
  showInfo: boolean;
  showSuccess: boolean;
}

export interface GroupedNotifications {
  today: Notification[];
  yesterday: Notification[];
  earlier: Notification[];
}

// ============================================================================
// Local Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  READ_STATE: 'tamandua_notifications_read',
  PREFERENCES: 'tamandua_notification_preferences',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

function getReadState(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.READ_STATE);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function saveReadState(readIds: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.READ_STATE, JSON.stringify([...readIds]));
  } catch {
    // Ignore storage errors
  }
}

function normalizeNotificationId(id: unknown): string {
  return String(id ?? '');
}

function getPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {
    soundEnabled: true,
    desktopEnabled: true,
    showAlerts: true,
    showWarnings: true,
    showInfo: true,
    showSuccess: true,
  };
}

function savePreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

export function groupNotificationsByDate(notifications: Notification[]): GroupedNotifications {
  const groups: GroupedNotifications = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const notification of notifications) {
    const date = new Date(notification.timestamp);
    if (isToday(date)) {
      groups.today.push(notification);
    } else if (isYesterday(date)) {
      groups.yesterday.push(notification);
    } else {
      groups.earlier.push(notification);
    }
  }

  return groups;
}

export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Main hook for fetching and managing notifications
 */
export function useNotifications() {
  const query = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const alerts = await invoke<any[]>('get_alerts', { since: null, limit: 50 });
      return alerts.map((alert) => ({
        id: normalizeNotificationId(alert.id),
        type: alert.severity === 'critical' || alert.severity === 'high' ? 'alert' : 'warning',
        title: alert.title || 'Security alert',
        message: alert.description || alert.message || '',
        timestamp: alert.created_at || alert.timestamp || new Date().toISOString(),
        read: Boolean(alert.dismissed || alert.acknowledged),
        link: '/alerts',
        metadata: { alertId: alert.id, severity: alert.severity },
      }));
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Merge read state with notifications
  const notifications = useMemo(() => {
    if (!query.data) return [];
    const readIds = getReadState();
    return query.data.map((n) => ({
      ...n,
      read: n.read || readIds.has(n.id),
    }));
  }, [query.data]);

  // Compute unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Group by date
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(notifications);
  }, [notifications]);

  return {
    notifications,
    groupedNotifications,
    unreadCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for marking a single notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const normalizedId = normalizeNotificationId(notificationId);
      const readIds = getReadState();
      readIds.add(normalizedId);
      saveReadState(readIds);
      return normalizedId;
    },
    onSuccess: (notificationId) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (notifications = []) =>
        notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    },
  });
}

/**
 * Hook for marking all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds?: string[]) => {
      const notifications = queryClient.getQueryData<Notification[]>(['notifications']) || [];
      const readIds = getReadState();
      const idsToMark = notificationIds?.length
        ? notificationIds
        : notifications.map((notification) => notification.id);
      idsToMark.forEach((id) => readIds.add(normalizeNotificationId(id)));
      saveReadState(readIds);
      return true;
    },
    onMutate: async (notificationIds?: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);
      const idsToMark = new Set((notificationIds || []).map(normalizeNotificationId));

      queryClient.setQueryData<Notification[]>(['notifications'], (notifications = []) =>
        notifications.map((notification) =>
          idsToMark.size === 0 || idsToMark.has(notification.id)
            ? { ...notification, read: true }
            : notification
        )
      );

      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications'], context.previousNotifications);
      }
    },
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(['notifications'], (notifications = []) =>
        notifications.map((notification) => ({ ...notification, read: true }))
      );
    },
  });
}

/**
 * Hook for deleting a notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const normalizedId = normalizeNotificationId(notificationId);
      const readIds = getReadState();
      readIds.add(normalizedId);
      saveReadState(readIds);
      return normalizedId;
    },
    onSuccess: (notificationId) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (notifications = []) =>
        notifications.filter((notification) => notification.id !== notificationId)
      );
    },
  });
}

/**
 * Hook for subscribing to new notifications in real-time
 */
export function useNotificationSubscription(
  onNewNotification?: (notification: Notification) => void
) {
  const queryClient = useQueryClient();
  const [preferences] = useNotificationPreferences();

  const handleNewNotification = useCallback(
    (notification: Notification) => {
      // Play sound if enabled
      if (preferences.soundEnabled) {
        playNotificationSound(notification.type);
      }

      // Show desktop notification if enabled
      if (preferences.desktopEnabled) {
        showDesktopNotification(notification);
      }

      // Call custom handler
      onNewNotification?.(notification);

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [preferences, onNewNotification, queryClient]
  );

  // Listen for new-notification events from Tauri
  useEventListener<Notification>('new-notification', handleNewNotification);

  // Also listen for alerts that should become notifications
  useEventListener<{ title: string; message: string; severity: string }>(
    'new-alert',
    (alert) => {
      const notification: Notification = {
        id: normalizeNotificationId(`notif-${Date.now()}`),
        type: alert.severity === 'critical' || alert.severity === 'high' ? 'alert' : 'warning',
        title: alert.title,
        message: alert.message,
        timestamp: new Date().toISOString(),
        read: false,
        link: '/alerts',
      };
      handleNewNotification(notification);
    }
  );
}

/**
 * Hook for managing notification preferences
 */
export function useNotificationPreferences(): [
  NotificationPreferences,
  (prefs: Partial<NotificationPreferences>) => void
] {
  const [preferences, setPreferencesState] = useState<NotificationPreferences>(() =>
    getPreferences()
  );

  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferencesState((prev) => {
      const newPrefs = { ...prev, ...updates };
      savePreferences(newPrefs);
      return newPrefs;
    });
  }, []);

  return [preferences, updatePreferences];
}

/**
 * Hook for clearing all notifications
 */
export function useClearAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const notifications = queryClient.getQueryData<Notification[]>(['notifications']) || [];
      const readIds = getReadState();
      notifications.forEach((n) => readIds.add(normalizeNotificationId(n.id)));
      saveReadState(readIds);
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(['notifications'], []);
    },
  });
}

// ============================================================================
// Sound & Desktop Notification Helpers
// ============================================================================

const NOTIFICATION_SOUNDS: Record<NotificationType, string> = {
  alert: '/sounds/alert.mp3',
  warning: '/sounds/warning.mp3',
  info: '/sounds/info.mp3',
  success: '/sounds/success.mp3',
};

function playNotificationSound(type: NotificationType): void {
  try {
    // Check if we have audio context available
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    // Create a simple beep sound based on type
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different frequencies for different types
    const frequencies: Record<NotificationType, number> = {
      alert: 880, // A5 - urgent
      warning: 660, // E5 - attention
      info: 440, // A4 - neutral
      success: 523.25, // C5 - positive
    };

    oscillator.frequency.value = frequencies[type];
    oscillator.type = type === 'alert' ? 'square' : 'sine';
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);

    // Clean up after sound plays
    setTimeout(() => ctx.close(), 200);
  } catch {
    // Ignore audio errors
  }
}

function showDesktopNotification(notification: Notification): void {
  // Check if notifications are supported and permission granted
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(notification.title, {
      body: notification.message,
      icon: '/tamandua-icon.png',
      tag: notification.id,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/tamandua-icon.png',
          tag: notification.id,
        });
      }
    });
  }
}

/**
 * Request desktop notification permission
 */
export function useRequestNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}

// ============================================================================
// Utility Type Helpers
// ============================================================================

export function getNotificationTypeColor(type: NotificationType): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  const colors: Record<NotificationType, { bg: string; text: string; border: string; icon: string }> = {
    alert: {
      bg: 'bg-red-900/20',
      text: 'text-red-400',
      border: 'border-red-800',
      icon: 'text-red-500',
    },
    warning: {
      bg: 'bg-yellow-900/20',
      text: 'text-yellow-400',
      border: 'border-yellow-800',
      icon: 'text-yellow-500',
    },
    info: {
      bg: 'bg-blue-900/20',
      text: 'text-blue-400',
      border: 'border-blue-800',
      icon: 'text-blue-500',
    },
    success: {
      bg: 'bg-green-900/20',
      text: 'text-green-400',
      border: 'border-green-800',
      icon: 'text-green-500',
    },
  };

  return colors[type];
}
