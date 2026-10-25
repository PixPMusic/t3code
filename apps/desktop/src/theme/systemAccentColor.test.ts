import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { getAccentColor } = vi.hoisted(() => ({ getAccentColor: vi.fn() }));
vi.mock("electron", () => ({ systemPreferences: { getAccentColor } }));

import { readSystemAccentColor } from "./systemAccentColor.ts";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("system accent color", () => {
  it.each([
    ["FF00FFFF", "#ff00ff"],
    ["00AACC80", "#00aacc"],
    ["12345600", "#123456"],
    ["000000ff", "#000000"],
    ["ffffffff", "#ffffff"],
  ])("converts Electron RGBA %s to RGB %s", (rgba, expected) => {
    getAccentColor.mockReturnValue(rgba);
    expect(readSystemAccentColor()).toBe(expected);
  });

  it.each(["", "ff00ff", "#ff00ffff", "gg00ffff", "ff00ffgg", "ff00ffff00", null, 12345678])(
    "rejects an unavailable or malformed native color: %j",
    (rgba) => {
      getAccentColor.mockReturnValue(rgba);
      expect(() => readSystemAccentColor()).toThrow("system accent color is unavailable");
    },
  );
});
