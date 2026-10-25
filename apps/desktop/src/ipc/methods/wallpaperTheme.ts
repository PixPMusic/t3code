import {
  DesktopWallpaperThemeColorsSchema,
  DesktopWallpaperThemeSourceSchema,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronDialog from "../../electron/ElectronDialog.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import { readSystemAccentColor } from "../../theme/systemAccentColor.ts";
import { extractWallpaperColors, readMacWallpaperPath } from "../../theme/wallpaperColor.ts";
import { readWindowsWallpaperPath } from "../../theme/windowsWallpaper.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

class WallpaperThemeError extends Schema.TaggedError<WallpaperThemeError>()("WallpaperThemeError", {
  message: Schema.String,
}) {}

export const getWallpaperThemeColors = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.GET_WALLPAPER_THEME_COLORS_CHANNEL,
  payload: DesktopWallpaperThemeSourceSchema,
  result: Schema.NullOr(DesktopWallpaperThemeColorsSchema),
  handler: Effect.fn("desktop.ipc.getWallpaperThemeColors")(function* (source) {
    const { platform } = yield* DesktopEnvironment.DesktopEnvironment;
    if (source === "accent") {
      if (platform !== "darwin" && platform !== "win32") {
        return yield* new WallpaperThemeError({
          message: "System accent lookup is available on macOS and Windows.",
        });
      }
      return yield* Effect.try({
        try: () => [readSystemAccentColor()] as const,
        catch: () =>
          new WallpaperThemeError({ message: "Could not read the system accent color." }),
      });
    }
    let imagePath: string;
    if (source === "wallpaper") {
      if (platform !== "darwin" && platform !== "win32") {
        return yield* new WallpaperThemeError({
          message:
            "Current wallpaper lookup is available on macOS and Windows. Choose an image on this platform.",
        });
      }
      imagePath = yield* Effect.tryPromise({
        try: () => (platform === "win32" ? readWindowsWallpaperPath() : readMacWallpaperPath()),
        catch: () =>
          new WallpaperThemeError({
            message: "Could not read the current wallpaper. Try choosing an image.",
          }),
      });
    } else {
      const dialog = yield* ElectronDialog.ElectronDialog;
      const window = yield* ElectronWindow.ElectronWindow;
      const paths = yield* dialog.pickFiles({
        owner: yield* window.focusedMainOrFirst,
        defaultPath: Option.none(),
        filters: [
          {
            name: "Images",
            extensions:
              platform === "darwin" ? ["png", "jpg", "jpeg", "heic"] : ["png", "jpg", "jpeg"],
          },
        ],
        multiple: false,
      });
      if (!paths[0]) return null;
      imagePath = paths[0];
    }
    return yield* Effect.tryPromise({
      try: () => extractWallpaperColors(imagePath, platform),
      // Filesystem and native decoder errors can contain private paths. Do not
      // send them across IPC or attach them to telemetry as error causes.
      catch: () =>
        new WallpaperThemeError({
          message: "Could not sample this image. Try a PNG or JPEG smaller than 32 MB.",
        }),
    });
  }),
});
