import { expect, it } from "@effect/vitest";
import { beforeEach, vi } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const { readPath, readWindowsPath, readAccent, extractColors } = vi.hoisted(() => ({
  readPath: vi.fn(),
  readWindowsPath: vi.fn(),
  readAccent: vi.fn(),
  extractColors: vi.fn(),
}));
vi.mock("../../theme/windowsWallpaper.ts", () => ({ readWindowsWallpaperPath: readWindowsPath }));
vi.mock("../../theme/systemAccentColor.ts", () => ({ readSystemAccentColor: readAccent }));
vi.mock("../../theme/wallpaperColor.ts", () => ({
  readMacWallpaperPath: readPath,
  extractWallpaperColors: extractColors,
}));

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as ElectronDialog from "../../electron/ElectronDialog.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import { getWallpaperThemeColors } from "./wallpaperTheme.ts";

const pickFiles = vi.fn();
function run(source: unknown, platform: NodeJS.Platform = "darwin") {
  return getWallpaperThemeColors.handler(source).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(DesktopEnvironment.DesktopEnvironment, {
          platform,
        } as DesktopEnvironment.DesktopEnvironment["Service"]),
        Layer.mock(ElectronWindow.ElectronWindow, { focusedMainOrFirst: Effect.succeedNone }),
        Layer.mock(ElectronDialog.ElectronDialog, { pickFiles }),
      ),
    ),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  readPath.mockResolvedValue("/private/wallpaper.heic");
  readWindowsPath.mockResolvedValue("C:\\private\\wallpaper.jpg");
  readAccent.mockReturnValue("#ff00ff");
  extractColors.mockResolvedValue(["#ff0000"]);
  pickFiles.mockReturnValue(Effect.succeed([]));
});

it.effect("samples the Windows desktop wallpaper without using macOS lookup", () =>
  Effect.gen(function* () {
    expect(yield* run("wallpaper", "win32")).toEqual(["#ff0000"]);
    expect(extractColors).toHaveBeenCalledWith("C:\\private\\wallpaper.jpg", "win32");
    expect(readPath).not.toHaveBeenCalled();
    expect(pickFiles).not.toHaveBeenCalled();
  }),
);

it.effect.each(["darwin", "win32"] as const)(
  "uses the %s accent without reading any image",
  (platform) =>
    Effect.gen(function* () {
      expect(yield* run("accent", platform)).toEqual(["#ff00ff"]);
      expect(readPath).not.toHaveBeenCalled();
      expect(readWindowsPath).not.toHaveBeenCalled();
      expect(extractColors).not.toHaveBeenCalled();
      expect(pickFiles).not.toHaveBeenCalled();
    }),
);

it.effect("does not call the system accent API on unsupported platforms", () =>
  Effect.gen(function* () {
    expect(
      yield* run("accent", "linux").pipe(
        Effect.match({ onSuccess: () => null, onFailure: (e) => e }),
      ),
    ).toMatchObject({ message: "System accent lookup is available on macOS and Windows." });
    expect(readAccent).not.toHaveBeenCalled();
  }),
);

it.effect("sanitizes accent lookup errors", () =>
  Effect.gen(function* () {
    readAccent.mockImplementation(() => {
      throw new Error("private native error");
    });
    expect(
      yield* run("accent").pipe(Effect.match({ onSuccess: () => null, onFailure: (e) => e })),
    ).toMatchObject({ message: "Could not read the system accent color." });
  }),
);

it.effect("sanitizes Windows lookup errors before IPC", () =>
  Effect.gen(function* () {
    readWindowsPath.mockRejectedValue(new Error("C:\\private.png"));
    expect(
      yield* run("wallpaper", "win32").pipe(
        Effect.match({ onSuccess: () => null, onFailure: (e) => e }),
      ),
    ).toMatchObject({ message: "Could not read the current wallpaper. Try choosing an image." });
    expect(extractColors).not.toHaveBeenCalled();
  }),
);

it.effect("returns only ranked colors from the wallpaper on the desktop machine", () =>
  Effect.gen(function* () {
    extractColors.mockResolvedValue(["#ff00ff", "#00ffff"]);
    expect(yield* run("wallpaper")).toEqual(["#ff00ff", "#00ffff"]);
    expect(extractColors).toHaveBeenCalledWith("/private/wallpaper.heic", "darwin");
    expect(pickFiles).not.toHaveBeenCalled();
  }),
);

it.effect.each([
  { colors: [] },
  { colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff"] },
  { colors: ["#ff0000", "#ff0000"] },
  { colors: ["/private/wallpaper.heic"] },
  { colors: ["#ff00ff", "not-a-color"] },
])("rejects invalid extracted choices at the IPC boundary: %j", ({ colors }) =>
  Effect.gen(function* () {
    extractColors.mockResolvedValue(colors);
    expect(
      yield* run("wallpaper").pipe(
        Effect.match({ onSuccess: () => null, onFailure: (error) => error }),
      ),
    ).not.toBeNull();
  }),
);

it.effect("cancelling the picker reads no wallpaper or image", () =>
  Effect.gen(function* () {
    expect(yield* run("image")).toBeNull();
    expect(readPath).not.toHaveBeenCalled();
    expect(extractColors).not.toHaveBeenCalled();
  }),
);

it.effect.each(["win32", "linux"] as const)("allows chosen images on %s", (platform) =>
  Effect.gen(function* () {
    pickFiles.mockReturnValue(Effect.succeed(["/chosen/image.png"]));
    expect(yield* run("image", platform)).toEqual(["#ff0000"]);
    expect(readPath).not.toHaveBeenCalled();
  }),
);

it.effect("does not attempt macOS wallpaper lookup on another platform", () =>
  Effect.gen(function* () {
    expect(
      yield* run("wallpaper", "linux").pipe(
        Effect.match({ onSuccess: () => null, onFailure: (error) => error }),
      ),
    ).toMatchObject({
      message: expect.stringContaining("available on macOS"),
    });
    expect(readPath).not.toHaveBeenCalled();
  }),
);

it.effect("does not expose a decoder's private path through IPC", () =>
  Effect.gen(function* () {
    extractColors.mockRejectedValue(new Error("Unreadable /private/wallpaper.heic"));
    expect(
      yield* run("wallpaper").pipe(
        Effect.match({ onSuccess: () => null, onFailure: (error) => error }),
      ),
    ).toMatchObject({
      message: "Could not sample this image. Try a PNG or JPEG smaller than 32 MB.",
    });
  }),
);

it.effect("rejects arbitrary path requests at the IPC boundary", () =>
  Effect.gen(function* () {
    expect(
      yield* run("/private/other-file").pipe(
        Effect.match({ onSuccess: () => null, onFailure: (error) => error }),
      ),
    ).not.toBeNull();
    expect(readPath).not.toHaveBeenCalled();
    expect(pickFiles).not.toHaveBeenCalled();
    expect(extractColors).not.toHaveBeenCalled();
  }),
);
