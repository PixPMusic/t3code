import { beforeEach, expect, it, vi } from "vite-plus/test";

const { execFile } = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile }));

import { readWindowsWallpaperPath } from "./windowsWallpaper.ts";

beforeEach(() => {
  vi.resetAllMocks();
});

function returnOutput(stdout: string, error: Error | null = null) {
  execFile.mockImplementation((_command, _args, _options, callback) => callback(error, stdout));
}

it("preserves a native Windows path containing Unicode and PowerShell metacharacters", async () => {
  const path = String.raw`C:\Users\Example\Pictures\夜 $(private) 'sky'.jpg`;
  returnOutput(JSON.stringify(path) + "\r\n");
  expect(await readWindowsWallpaperPath()).toBe(path);
  // The returned path is data, never interpolated into the command being run.
  expect(execFile.mock.calls[0]?.[1].join(" ")).not.toContain(path);
});

it.each([
  "",
  "relative.png",
  "C:relative.png",
  "\\rooted.png",
  "\\\\server\\wallpaper.png",
  "C:\\bad\0.png",
  null,
  12,
])("rejects unavailable or nonlocal wallpaper paths: %j", async (path) => {
  returnOutput(JSON.stringify(path));
  await expect(readWindowsWallpaperPath()).rejects.toThrow("not a local image");
});

it.each(["", "native diagnostic with C:\\private.png"])(
  "sanitizes malformed output: %j",
  async (output) => {
    returnOutput(output);
    await expect(readWindowsWallpaperPath()).rejects.toThrow(
      /^Could not read the current wallpaper\.$/,
    );
  },
);

it("sanitizes native failures", async () => {
  returnOutput("", new Error("C:\\private.png: denied"));
  await expect(readWindowsWallpaperPath()).rejects.toThrow(
    /^Could not read the current wallpaper\.$/,
  );
});
