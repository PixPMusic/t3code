import { describe, expect, it } from "vite-plus/test";

import { modelLabelBesideIcon } from "./modelLabel";

describe("modelLabelBesideIcon", () => {
  it("drops brand words the provider icon already shows", () => {
    expect(modelLabelBesideIcon("Claude Opus 5.5")).toBe("Opus 5.5");
    expect(modelLabelBesideIcon("Google Gemini 3 Pro")).toBe("Gemini 3 Pro");
    expect(modelLabelBesideIcon("Anthropic Claude Sonnet 5.5")).toBe("Sonnet 5.5");
  });

  it("keeps labels that start with the model family", () => {
    expect(modelLabelBesideIcon("GPT-6.1-Sol")).toBe("GPT-6.1-Sol");
    expect(modelLabelBesideIcon("Qwen3 Coder 480B A35B Instruct")).toBe(
      "Qwen3 Coder 480B A35B Instruct",
    );
    expect(modelLabelBesideIcon("gpt-5.4")).toBe("gpt-5.4");
  });

  it("never empties a label that is only a brand", () => {
    expect(modelLabelBesideIcon("Claude")).toBe("Claude");
    expect(modelLabelBesideIcon("Claude ")).toBe("Claude");
  });
});
