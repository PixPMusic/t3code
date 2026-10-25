import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { execFile, stat, thumbnail, fromPath, resize, bitmap } = vi.hoisted(() => ({
  execFile: vi.fn(),
  stat: vi.fn(),
  thumbnail: vi.fn(),
  fromPath: vi.fn(),
  resize: vi.fn(),
  bitmap: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFile }));
vi.mock("node:fs/promises", () => ({ stat }));
vi.mock("electron", () => ({
  nativeImage: { createThumbnailFromPath: thumbnail, createFromPath: fromPath },
}));

import { extractWallpaperColors, readMacWallpaperPath } from "./wallpaperColor.ts";

beforeEach(() => {
  vi.resetAllMocks();
  execFile.mockImplementation((_command, _args, _options, callback) => callback(null, ""));
  stat.mockResolvedValue({ isFile: () => true, size: 1024 });
  bitmap.mockReturnValue(Buffer.from([0, 0, 255, 255]));
  resize.mockReturnValue({ toBitmap: bitmap });
  const image = { isEmpty: () => false, getSize: () => ({ width: 400, height: 200 }), resize };
  thumbnail.mockResolvedValue(image);
  fromPath.mockReturnValue(image);
});

describe("wallpaper color sampling", () => {
  it("offers both vivid magenta and cyan from a two-color wallpaper", async () => {
    bitmap.mockReturnValue(Buffer.from([255, 0, 255, 255, 255, 255, 0, 255]));
    const colors = await extractWallpaperColors("/wallpaper.png", "darwin");
    expect(colors).toHaveLength(2);
    expect(colors).toEqual(expect.arrayContaining(["#ff00ff", "#00ffff"]));
  });

  it("caps a colorful image at four distinct choices", async () => {
    bitmap.mockReturnValue(
      Buffer.from([
        0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255, 255, 255, 0, 255, 255, 0, 255, 255, 0, 255,
        255, 255,
      ]),
    );
    const colors = await extractWallpaperColors("/wallpaper.png", "darwin");
    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("ranks the dominant vivid color before another candidate", async () => {
    bitmap.mockReturnValue(
      Buffer.from([...Array.from({ length: 9 }, () => [0, 0, 255, 255]).flat(), 255, 255, 0, 255]),
    );
    expect(await extractWallpaperColors("/wallpaper.png", "darwin")).toEqual([
      "#ff0000",
      "#00ffff",
    ]);
  });

  it("still offers one fallback choice for a neutral wallpaper", async () => {
    bitmap.mockReturnValue(Buffer.from([128, 128, 128, 255]));
    const colors = await extractWallpaperColors("/wallpaper.png", "darwin");
    expect(colors).toHaveLength(1);
    expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(["darwin", "win32", "linux"] as const)(
    "samples red with the correct bitmap channel order on %s",
    async (platform) => {
      expect(await extractWallpaperColors("/wallpaper.png", platform)).toEqual(["#ff0000"]);
      expect(resize).toHaveBeenCalledWith({ width: 112, height: 56, quality: "good" });
      expect(bitmap).toHaveBeenCalledWith({ scaleFactor: 1 });
      expect(thumbnail).toHaveBeenCalledTimes(platform === "linux" ? 0 : 1);
      expect(fromPath).toHaveBeenCalledTimes(platform === "linux" ? 1 : 0);
    },
  );

  it("excludes transparent and partially transparent pixels from the palette", async () => {
    bitmap.mockReturnValue(
      Buffer.from([0, 0, 255, 255, 255, 0, 0, 0, 255, 0, 0, 128, 255, 0, 0, 128]),
    );
    expect(await extractWallpaperColors("/wallpaper.png", "darwin")).toEqual(["#ff0000"]);
    bitmap.mockReturnValue(Buffer.from([0, 0, 0, 0]));
    await expect(extractWallpaperColors("/wallpaper.png", "darwin")).rejects.toThrow(
      "opaque pixels",
    );
  });

  it.each([0, 32 * 1024 * 1024 + 1])("rejects %i-byte files before decoding", async (size) => {
    stat.mockResolvedValue({ isFile: () => true, size });
    await expect(extractWallpaperColors("/wallpaper.png", "darwin")).rejects.toThrow("32 MB");
    expect(thumbnail).not.toHaveBeenCalled();
    expect(fromPath).not.toHaveBeenCalled();
  });

  it("rejects undecodable images", async () => {
    thumbnail.mockResolvedValue({ isEmpty: () => true });
    await expect(extractWallpaperColors("/wallpaper.png", "darwin")).rejects.toThrow("decode");
  });

  it("rejects invalid macOS images before Quick Look can substitute a file icon", async () => {
    execFile.mockImplementation((_command, _args, _options, callback) =>
      callback(new Error("Could not decode image")),
    );
    await expect(extractWallpaperColors("/broken.heic", "darwin")).rejects.toThrow("decode");
    expect(thumbnail).not.toHaveBeenCalled();
  });
});

describe("macOS wallpaper lookup", () => {
  function returnOutput(stdout: string, error: Error | null = null) {
    execFile.mockImplementation((_command, _args, _options, callback) => callback(error, stdout));
  }

  it("preserves spaces, quotes, and Unicode in the native wallpaper path", async () => {
    const path = '/Users/example/Pictures/夜 "sky".heic';
    returnOutput(JSON.stringify({ path, aerialAssetId: null }) + "\n");
    expect(await readMacWallpaperPath()).toBe(path);
  });

  it("uses the selected aerial's cached image instead of macOS's generic default", async () => {
    const assetId = "C42AADA1-9110-472A-BF86-B1EF306DA846";
    returnOutput(
      JSON.stringify({
        path: "/System/Library/CoreServices/DefaultDesktop.heic",
        aerialAssetId: assetId,
      }),
    );
    expect(await readMacWallpaperPath()).toMatch(
      new RegExp(
        `/Library/Application Support/com.apple.wallpaper/aerials/thumbnails/${assetId}\\.png$`,
      ),
    );
  });

  it.each([
    "/System/Library/CoreServices/DefaultDesktop.heic",
    "/System/Library/Wallpapers/.default/DefaultAerial.heic",
  ])(
    "does not sample the wrong default when the selected wallpaper cannot be resolved: %s",
    async (path) => {
      returnOutput(JSON.stringify({ path, aerialAssetId: null }));
      await expect(readMacWallpaperPath()).rejects.toThrow("current wallpaper image");
    },
  );

  it.each(["../../private", "", 12])(
    "rejects an invalid aerial asset id: %s",
    async (aerialAssetId) => {
      returnOutput(JSON.stringify({ path: "/wallpaper.heic", aerialAssetId }));
      await expect(readMacWallpaperPath()).rejects.toThrow("current wallpaper");
    },
  );

  it.each(["", "relative.png", null])("rejects unavailable paths: %s", async (path) => {
    returnOutput(JSON.stringify({ path, aerialAssetId: null }));
    await expect(readMacWallpaperPath()).rejects.toThrow("not a local image");
  });

  it("hides native errors that might contain private paths", async () => {
    returnOutput("", new Error("/Users/example/private.png: denied"));
    await expect(readMacWallpaperPath()).rejects.toThrow(/^Could not read the current wallpaper/);
  });
});
