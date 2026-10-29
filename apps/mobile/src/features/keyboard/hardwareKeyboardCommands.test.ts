import { describe, expect, it } from "vite-plus/test";

import { parseActiveThreadPath } from "./hardwareKeyboardCommands";

describe("parseActiveThreadPath", () => {
  it("decodes route components", () => {
    expect(parseActiveThreadPath("/threads/local%20machine/thread%2Fone/review")).toEqual({
      environmentId: "local machine",
      threadId: "thread/one",
    });
    expect(parseActiveThreadPath("/home-agent/mac/home%3Aagent")).toEqual({
      environmentId: "mac",
      threadId: "home:agent",
    });
  });

  it("ignores malformed encoded route components", () => {
    expect(parseActiveThreadPath("/threads/%E0%A4%A/thread-1")).toBeNull();
  });
});
