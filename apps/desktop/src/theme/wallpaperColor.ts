// @effect-diagnostics nodeBuiltinImport:off -- Local wallpaper lookup and decoding are a desktop platform boundary.

import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  argbFromRgb,
  hexFromArgb,
  QuantizerCelebi,
  Score,
} from "@material/material-color-utilities";
import { nativeImage } from "electron";

const SAMPLE_SIZE = 112;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

// AppKit reports DefaultDesktop.heic for Apple's video wallpapers. Their
// selected asset and cached still live in the local wallpaper store instead.
// Only resolve an unambiguous shared wallpaper; don't guess the active Space.
const MAC_WALLPAPER_SCRIPT = `
ObjC.import("AppKit");
const screen = $.NSScreen.screens.firstObject;
const url = $.NSWorkspace.sharedWorkspace.desktopImageURLForScreen(screen);
if (url.isNil()) throw new Error("No wallpaper image is available");
let aerialAssetId = null;
try {
  const storePath = ObjC.unwrap($.NSHomeDirectory()) + "/Library/Application Support/com.apple.wallpaper/Store/Index.plist";
  const store = ObjC.deepUnwrap($.NSDictionary.dictionaryWithContentsOfFile(storePath));
  if (!Object.keys(store.Spaces || {}).length && !Object.keys(store.Displays || {}).length) {
    const shared = store.AllSpacesAndDisplays;
    const content = (shared.Type === "linked" ? shared.Linked : shared.Desktop).Content;
    const choices = content.Choices;
    if ((!content.Shuffle || content.Shuffle === "$null") && choices.length === 1 &&
        choices[0].Provider === "com.apple.wallpaper.choice.aerials") {
      const configuration = $.NSPropertyListSerialization.propertyListWithDataOptionsFormatError(
        choices[0].Configuration, 0, null, null);
      aerialAssetId = ObjC.deepUnwrap(configuration).assetID || null;
    }
  }
} catch (_) {
  // Older macOS versions and unsupported providers can still expose a file.
}
JSON.stringify({ path: ObjC.unwrap(url.path), aerialAssetId });
`;

// Quick Look can return a generic file icon when it cannot preview an image.
// Verify that AppKit can decode the file before treating a thumbnail as pixels.
const MAC_VALIDATE_IMAGE_SCRIPT = `
ObjC.import("AppKit");
function run(args) {
  const image = $.NSImage.alloc.initWithContentsOfFile(args[0]);
  if (image.isNil() || !image.isValid) throw new Error("Could not decode image");
}
`;

function validateMacImage(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    NodeChildProcess.execFile(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", MAC_VALIDATE_IMAGE_SCRIPT, path],
      { timeout: 5_000, maxBuffer: 16 * 1024 },
      (error) => {
        if (error) reject(new Error("Could not decode the image. Try a PNG or JPEG."));
        else resolve();
      },
    );
  });
}

export async function readMacWallpaperPath(): Promise<string> {
  const output = await new Promise<string>((resolve, reject) => {
    NodeChildProcess.execFile(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", MAC_WALLPAPER_SCRIPT],
      { timeout: 5_000, maxBuffer: 16 * 1024, encoding: "utf8" },
      (error, stdout) => {
        if (error)
          reject(new Error("Could not read the current wallpaper. Try choosing an image."));
        else resolve(stdout);
      },
    );
  });
  const source: unknown = JSON.parse(output);
  if (typeof source !== "object" || source === null || !("path" in source)) {
    throw new Error("Could not read the current wallpaper. Try choosing an image.");
  }
  const path = source.path;
  if (typeof path !== "string" || !NodePath.isAbsolute(path)) {
    throw new Error("The current wallpaper is not a local image. Try choosing an image.");
  }
  if ("aerialAssetId" in source && source.aerialAssetId !== null) {
    const assetId = source.aerialAssetId;
    if (
      typeof assetId !== "string" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(assetId)
    ) {
      throw new Error("Could not read the current wallpaper. Try choosing an image.");
    }
    return NodePath.join(
      NodeOS.homedir(),
      "Library/Application Support/com.apple.wallpaper/aerials/thumbnails",
      `${assetId}.png`,
    );
  }
  if (
    path === "/System/Library/CoreServices/DefaultDesktop.heic" ||
    path === "/System/Library/Wallpapers/.default/DefaultAerial.heic"
  ) {
    throw new Error("macOS did not expose the current wallpaper image. Try choosing an image.");
  }
  return path;
}

/** Electron's bitmap is BGRA on our little-endian desktop targets. Ignore
 * transparent pixels rather than treating premultiplied channels as colors. */
function sourceColorsFromBitmap(bitmap: Uint8Array): [string, ...string[]] {
  const pixels: number[] = [];
  for (let offset = 0; offset + 3 < bitmap.length; offset += 4) {
    if (bitmap[offset + 3] !== 255) continue;
    pixels.push(argbFromRgb(bitmap[offset + 2]!, bitmap[offset + 1]!, bitmap[offset]!));
  }
  if (pixels.length === 0) throw new Error("The image has no opaque pixels to sample.");
  const colors = QuantizerCelebi.quantize(pixels, 128);
  const [source, ...alternatives] = Score.score(colors, { desired: 4 });
  if (source === undefined) throw new Error("Could not find a theme color in this image.");
  return [hexFromArgb(source), ...alternatives.map(hexFromArgb)];
}

/** Only the ranked seeds leave the main process; image bytes and paths
 * never enter client settings, the renderer, or a connected environment. */
export async function extractWallpaperColors(
  path: string,
  platform: NodeJS.Platform,
): Promise<[string, ...string[]]> {
  const file = await NodeFSP.stat(path);
  if (!file.isFile() || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 32 MB.");
  }

  if (platform === "darwin") await validateMacImage(path);

  // Native thumbnailing handles HEIC on macOS and avoids decoding a full-size
  // wallpaper in JS. Electron only exposes this API on macOS and Windows.
  const image =
    platform === "darwin" || platform === "win32"
      ? await nativeImage.createThumbnailFromPath(path, {
          width: SAMPLE_SIZE,
          height: SAMPLE_SIZE,
        })
      : nativeImage.createFromPath(path);
  if (image.isEmpty()) throw new Error("Could not decode the image. Try a PNG or JPEG.");
  const { width, height } = image.getSize();
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height));
  const sample = image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: "good",
  });
  return sourceColorsFromBitmap(sample.toBitmap({ scaleFactor: 1 }));
}
