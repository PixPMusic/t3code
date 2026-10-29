import * as Notifications from "expo-notifications";
import { isHomeWatchedLaunch } from "@t3tools/client-runtime/state/home";
import { appAtomRegistry } from "../../state/atom-registry";
import { environmentServerConfigsAtom } from "../../state/server";
import { parseActiveThreadPath } from "../keyboard/hardwareKeyboardCommands";

import { setAndroidThreadOnScreen } from "./androidNotifications";
import { foregroundNotificationBehavior } from "./foregroundNotificationBehavior";
import {
  extractAgentNotificationDeepLink,
  routeAgentNotificationResponseOnce,
  threadDeepLinkOnScreen,
} from "./notificationPayload";
import { consumeLastAgentNotificationResponse } from "./notificationResponseConsumer";

let deepLinkOnScreen: string | null = null;

/** Called with the workspace pathname on every root navigation state change. */
export function setAgentNotificationPathname(pathname: string): void {
  deepLinkOnScreen = threadDeepLinkOnScreen(pathname);
  setAndroidThreadOnScreen(deepLinkOnScreen);
}

/**
 * App-lifetime notification routing: foreground presentation suppresses the
 * thread already on screen, and taps (including the cold-start tap) open the
 * notification's deep link through `navigate`.
 */
export function installAgentNotificationNavigation(navigate: (href: string) => void): () => void {
  const handledResponseIds = new Set<string>();
  Notifications.setNotificationHandler({
    handleNotification: (notification) => {
      const link = extractAgentNotificationDeepLink({ notification });
      const target = link === null ? null : parseActiveThreadPath(link);
      const handledByHome =
        target !== null &&
        [...appAtomRegistry.get(environmentServerConfigsAtom).values()].some((config) =>
          isHomeWatchedLaunch(config.settings.home, target),
        );
      return Promise.resolve(
        foregroundNotificationBehavior(notification, deepLinkOnScreen, handledByHome),
      );
    },
  });

  const handleResponse = (response: Notifications.NotificationResponse): void => {
    routeAgentNotificationResponseOnce({ handledResponseIds, response, navigate });
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  void consumeLastAgentNotificationResponse({
    getLastResponse: () => Notifications.getLastNotificationResponseAsync(),
    clearLastResponse: () => Notifications.clearLastNotificationResponseAsync(),
    handleResponse,
  });

  return () => {
    subscription.remove();
    Notifications.setNotificationHandler(null);
  };
}
