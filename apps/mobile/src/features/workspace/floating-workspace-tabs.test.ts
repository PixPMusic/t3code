import { expect, it } from "vite-plus/test";

import { resolveAndroidNavigationStyle } from "../../lib/androidNavigationStyle";

it.each([
  [undefined, "Samsung", false, "one-ui"],
  [undefined, "samsung", false, "one-ui"],
  [undefined, "Google", false, "material"],
  [undefined, null, false, "material"],
  [undefined, "Google", true, "one-ui"],
  ["material", "Samsung", false, "material"],
  ["one-ui", "Google", false, "one-ui"],
  ["material", "Google", true, "material"],
] as const)(
  "resolves navigation preference %s on %s with preview %s",
  (preference, manufacturer, preview, expected) => {
    expect(resolveAndroidNavigationStyle(preference, manufacturer, preview)).toBe(expected);
  },
);
