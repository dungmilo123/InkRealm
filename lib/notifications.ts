/**
 * Browser Notifications utility for long-running background tasks.
 *
 * Wraps the Web Notifications API with permission management, feature
 * detection, and a simple send interface. Designed for use cases like
 * notifying users when a translation job completes while the tab is
 * in the background.
 */

/** Whether the Notifications API is available in this environment */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current permission state — 'unsupported' if API unavailable */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 * Safe to call multiple times — if already granted/denied, resolves immediately.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    // Safari may throw on the promise-based API
    return Notification.permission;
  }
}

export type NotifyOptions = {
  /** Notification title (required) */
  title: string;
  /** Notification body text */
  body?: string;
  /** Icon URL (defaults to app favicon) */
  icon?: string;
  /** Tag to replace existing notifications with the same tag */
  tag?: string;
  /** Callback when notification is clicked */
  onClick?: () => void;
  /** Auto-close after N milliseconds (0 = no auto-close) */
  autoCloseMs?: number;
};

/**
 * Show a browser notification. No-ops silently if:
 * - Notifications API unsupported
 * - Permission not granted
 * - Tab is currently visible (user can see in-app toast instead)
 *
 * @param options Notification content and behavior
 * @returns The Notification instance, or null if not shown
 */
export function sendNotification(options: NotifyOptions): Notification | null {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== "granted") return null;

  // Don't show browser notification if user is looking at the tab —
  // in-app toasts handle that case
  if (document.visibilityState === "visible") return null;

  const notification = new Notification(options.title, {
    body: options.body,
    icon: options.icon ?? "/icon.svg",
    tag: options.tag,
  });

  if (options.onClick) {
    const handler = options.onClick;
    notification.onclick = () => {
      // Focus the tab that sent the notification
      window.focus();
      handler();
      notification.close();
    };
  }

  if (options.autoCloseMs && options.autoCloseMs > 0) {
    setTimeout(() => notification.close(), options.autoCloseMs);
  }

  return notification;
}
