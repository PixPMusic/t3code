import { expect, it, vi } from "vite-plus/test";

it.each([
  ["android", "Samsung", undefined, true],
  ["android", "samsung", "0", true],
  ["android", "Google", undefined, false],
  ["android", null, undefined, false],
  ["android", "Google", "1", true],
  ["android", null, "1", true],
  ["ios", "Samsung", "1", false],
  ["web", null, "1", false],
] as const)(
  "gates floating tabs for %s / %s with flag %s",
  async (platform, manufacturer, flag, enabled) => {
    vi.resetModules();
    vi.doMock("react-native", () => ({ Platform: { OS: platform } }));
    vi.doMock("expo-device", () => ({ manufacturer }));
    vi.stubEnv("EXPO_PUBLIC_T3_FLOATING_TABS", flag);
    try {
      const { ANDROID_FLOATING_TABS } = await import("./floating-workspace-tabs");
      expect(ANDROID_FLOATING_TABS).toBe(enabled);
    } finally {
      vi.doUnmock("react-native");
      vi.doUnmock("expo-device");
      vi.unstubAllEnvs();
    }
  },
);
