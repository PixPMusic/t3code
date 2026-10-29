import type { Notification, NotificationBehavior } from "expo-notifications";

import { extractAgentNotificationDeepLink } from "./notificationPayload";

const SHOW: NotificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};

const SUPPRESS: NotificationBehavior = {
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
};

export function foregroundNotificationBehavior(
  notification: Notification,
  deepLinkOnScreen: string | null,
  handledByHome = false,
): NotificationBehavior {
  const target = extractAgentNotificationDeepLink({ notification });
  if (handledByHome || (target !== null && target === deepLinkOnScreen)) {
    return SUPPRESS;
  }
  return SHOW;
}
