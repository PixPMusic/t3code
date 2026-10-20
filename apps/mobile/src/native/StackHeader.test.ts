import { createElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { optionsSignature } from "./StackHeader";

vi.mock("@react-navigation/native", () => ({ useNavigation: () => null }));

function Spinner(_props: { readonly color: string }) {
  return null;
}

describe("optionsSignature", () => {
  it("does not walk a custom header element's owner", () => {
    const element = createElement(Spinner, { color: "red" });
    // Development elements point at their owner fiber, whose graph reaches
    // navigation context defaults that throw when read outside a navigator.
    const ownedElement = {
      ...element,
      _owner: {
        get getIsInitial() {
          throw new Error("Couldn't find a navigation context.");
        },
      },
    };

    expect(() =>
      optionsSignature([{ type: "custom", element: ownedElement }], new WeakSet()),
    ).not.toThrow();
  });

  it("changes when a custom header element renders differently", () => {
    const signature = (color: string) =>
      optionsSignature([{ type: "custom", element: createElement(Spinner, { color }) }]);

    expect(signature("red")).toBe(signature("red"));
    expect(signature("red")).not.toBe(signature("blue"));
  });
});
