import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import notificationListener, {
  NotificationEvent,
  NotificationRemovedEvent,
} from '@/modules/notification-listener/src';

/**
 * Hook to listen for incoming notifications from other apps.
 * Requires Android NotificationListenerService permission.
 *
 * @param onNotification   Callback when a notification is received
 * @param onRemoved        Callback when a notification is dismissed/removed (optional)
 * @param enabledPackages  Set of package names to listen to (empty = listen to all)
 * @param enabled          Whether listening is active
 */
export function useNotificationListener(
  onNotification: (event: NotificationEvent) => void,
  onRemoved: ((event: NotificationRemovedEvent) => void) | null,
  enabledPackages: Set<string>,
  enabled: boolean
) {
  const onNotificationRef = useRef(onNotification);
  const onRemovedRef = useRef(onRemoved);
  const enabledPackagesRef = useRef(enabledPackages);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    onRemovedRef.current = onRemoved;
  }, [onRemoved]);

  useEffect(() => {
    enabledPackagesRef.current = enabledPackages;
  }, [enabledPackages]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    if (!notificationListener.isAvailable()) return;

    // Subscribe to new notifications
    const subscription = notificationListener.addListener((event: NotificationEvent) => {
      const packages = enabledPackagesRef.current;
      if (packages.size === 0 || packages.has(event.packageName)) {
        onNotificationRef.current(event);
      }
    });

    // Subscribe to removed notifications
    const removedSubscription = notificationListener.addRemovedListener(
      (event: NotificationRemovedEvent) => {
        if (onRemovedRef.current) {
          const packages = enabledPackagesRef.current;
          if (packages.size === 0 || packages.has(event.packageName)) {
            onRemovedRef.current(event);
          }
        }
      }
    );

    return () => {
      subscription.remove();
      removedSubscription.remove();
    };
  }, [enabled]);
}
